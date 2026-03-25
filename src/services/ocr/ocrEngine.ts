import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PSM, createWorker } from 'tesseract.js';
import tesseractWorker from 'tesseract.js/dist/worker.min.js?url';
import tesseractCore from 'tesseract.js-core/tesseract-core-simd.wasm.js?url';

type OcrPayload = { rawText: string; confidence: number };
type OcrOptions = { fast?: boolean };
type OcrRunResult = { text: string; confidence: number };

GlobalWorkerOptions.workerSrc = pdfWorker;
const tesseractLangPath = (import.meta.env.VITE_TESSERACT_LANG_PATH ?? '').trim().replace(/\/+$/, '');

const RELEVANT_TOKEN_REGEX =
  /\b(V|E|J|G|P)\s*[-.]?\s*\d{6,10}\b|\b\d{2}[/-]\d{2}[/-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\b(CEDULA|C[ÉE]DULA|RIF|NOMBRE|NOMBRES|APELLIDOS|RAZON SOCIAL)\b/gi;

const fileToImageBitmap = async (file: File): Promise<ImageBitmap> => {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const renderPdfToCanvas = async (file: File, fast = false): Promise<HTMLCanvasElement> => {
  const data = await file.arrayBuffer();
  const pdfDoc = await getDocument({ data }).promise;
  const firstPage = await pdfDoc.getPage(1);
  const viewport = firstPage.getViewport({ scale: fast ? 1 : 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar canvas para PDF.');
  await firstPage.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
};

const resizeCanvas = (source: HTMLCanvasElement, scale: number): HTMLCanvasElement => {
  const scaled = document.createElement('canvas');
  scaled.width = Math.max(1, Math.round(source.width * scale));
  scaled.height = Math.max(1, Math.round(source.height * scale));
  const ctx = scaled.getContext('2d');
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, scaled.width, scaled.height);
  return scaled;
};

const buildPreprocessedCanvas = (source: HTMLCanvasElement, variant: 'contrast' | 'binary'): HTMLCanvasElement => {
  const output = document.createElement('canvas');
  output.width = source.width;
  output.height = source.height;
  const ctx = output.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);

  const image = ctx.getImageData(0, 0, output.width, output.height);
  const data = image.data;

  let luminanceSum = 0;
  const luminance = new Uint8Array(output.width * output.height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    luminance[p] = gray;
    luminanceSum += gray;
  }

  const mean = luminanceSum / luminance.length;
  const threshold = Math.max(85, Math.min(190, Math.round(mean - 8)));

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const gray = luminance[p];
    let next = gray;
    if (variant === 'contrast') {
      const contrast = 1.4;
      next = Math.max(0, Math.min(255, Math.round((gray - 128) * contrast + 128)));
    } else {
      next = gray > threshold ? 255 : 0;
    }
    data[i] = next;
    data[i + 1] = next;
    data[i + 2] = next;
  }

  ctx.putImageData(image, 0, 0);
  return output;
};

const getQualityScore = (text: string): number => {
  const compact = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!compact) return 0;
  const words = compact.split(' ').filter((word) => word.length >= 2).length;
  const hints = (compact.match(RELEVANT_TOKEN_REGEX) ?? []).length;
  return Math.min(25, words * 0.4) + Math.min(25, hints * 5);
};

const shouldRetryWithEnhancedPass = (result: OcrRunResult): boolean => {
  if (result.confidence < 82) return true;
  const quality = getQualityScore(result.text);
  return quality < 20;
};

const pickBestResult = (a: OcrRunResult, b: OcrRunResult): OcrRunResult => {
  const scoreA = a.confidence + getQualityScore(a.text);
  const scoreB = b.confidence + getQualityScore(b.text);
  return scoreB > scoreA ? b : a;
};

const toCanvas = async (file: File, options?: OcrOptions): Promise<HTMLCanvasElement> => {
  const fast = Boolean(options?.fast);
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return renderPdfToCanvas(file, fast);

  const bitmap = await fileToImageBitmap(file);
  const canvas = document.createElement('canvas');
  if (fast) {
    const maxWidth = 1280;
    const ratio = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
  } else {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
  }
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar canvas para imagen.');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
};

const runTesseract = async (
  language: string,
  canvas: HTMLCanvasElement,
  onProgress?: (p: number) => void
): Promise<OcrRunResult> => {
  const execute = async (langPath?: string): Promise<OcrRunResult> => {
    const worker = await createWorker(language, 1, {
      workerPath: tesseractWorker,
      corePath: tesseractCore,
      langPath,
      gzip: true,
      logger(message: any) {
        if (message.status === 'recognizing text' && typeof message.progress === 'number') {
          onProgress?.(Math.round(message.progress * 100));
        }
      }
    });
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300'
      });
      const result = await worker.recognize(canvas);
      return {
        text: result?.data?.text ?? '',
        confidence: result?.data?.confidence ?? 0
      };
    } finally {
      await worker.terminate();
    }
  };

  if (!tesseractLangPath) return execute(undefined);

  try {
    return await execute(tesseractLangPath);
  } catch {
    // Si falla la ruta local de idiomas, vuelve a comportamiento por defecto (CDN).
    return execute(undefined);
  }
};

const makePrimaryCanvas = async (file: File, options?: OcrOptions): Promise<HTMLCanvasElement> => {
  const source = await toCanvas(file, options);
  const upscaleForReading = source.width < 1300 ? 1.6 : 1;
  return upscaleForReading > 1 ? resizeCanvas(source, upscaleForReading) : source;
};

export async function ocrFile(file: File, onProgress?: (p: number) => void): Promise<OcrPayload> {
  const canvas = await makePrimaryCanvas(file);
  onProgress?.(5);
  try {
    const primary = await runTesseract('spa+eng', canvas, (progress) => {
      onProgress?.(Math.round(5 + progress * 0.75));
    });
    let best = primary;
    if (shouldRetryWithEnhancedPass(primary)) {
      const enhanced = buildPreprocessedCanvas(canvas, 'contrast');
      const retried = await runTesseract('spa+eng', enhanced, (progress) => {
        onProgress?.(Math.round(80 + progress * 0.2));
      });
      best = pickBestResult(primary, retried);
    }
    onProgress?.(100);
    return { rawText: best.text, confidence: best.confidence };
  } catch {
    const fallback = await runTesseract('eng', canvas, onProgress);
    onProgress?.(100);
    return { rawText: fallback.text, confidence: fallback.confidence };
  }
}

export async function ocrFileFast(file: File, onProgress?: (p: number) => void): Promise<OcrPayload> {
  const canvas = await makePrimaryCanvas(file, { fast: true });
  onProgress?.(5);
  try {
    const preprocessed = buildPreprocessedCanvas(canvas, 'binary');
    const primary = await runTesseract('spa', preprocessed, onProgress);
    onProgress?.(100);
    return { rawText: primary.text, confidence: primary.confidence };
  } catch {
    const fallback = await runTesseract('eng', canvas, onProgress);
    onProgress?.(100);
    return { rawText: fallback.text, confidence: fallback.confidence };
  }
}
