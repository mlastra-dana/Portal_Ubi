type OcrPayload = { rawText: string; confidence: number };
type OcrOptions = { fast?: boolean };

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/+esm';
const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs';
const PDFJS_WORKER_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';

let tesseractModulePromise: Promise<any> | null = null;
let pdfJsModulePromise: Promise<any> | null = null;

const loadTesseract = async () => {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import(/* @vite-ignore */ TESSERACT_CDN);
  }
  return tesseractModulePromise;
};

const loadPdfJs = async () => {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import(/* @vite-ignore */ PDFJS_CDN).then((module) => {
      module.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      return module;
    });
  }
  return pdfJsModulePromise;
};

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
  const pdfjsLib = await loadPdfJs();
  const data = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  const firstPage = await pdfDoc.getPage(1);
  const viewport = firstPage.getViewport({ scale: fast ? 1 : 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar canvas para PDF.');
  await firstPage.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
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
): Promise<{ text: string; confidence: number }> => {
  const module = await loadTesseract();
  const worker = await module.createWorker(language, 1, {
    logger(message: any) {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        onProgress?.(Math.round(message.progress * 100));
      }
    }
  });
  try {
    const result = await worker.recognize(canvas);
    return {
      text: result?.data?.text ?? '',
      confidence: result?.data?.confidence ?? 0
    };
  } finally {
    await worker.terminate();
  }
};

export async function ocrFile(file: File, onProgress?: (p: number) => void): Promise<OcrPayload> {
  const canvas = await toCanvas(file);
  onProgress?.(5);
  try {
    const primary = await runTesseract('spa+eng', canvas, onProgress);
    onProgress?.(100);
    return { rawText: primary.text, confidence: primary.confidence };
  } catch {
    const fallback = await runTesseract('eng', canvas, onProgress);
    onProgress?.(100);
    return { rawText: fallback.text, confidence: fallback.confidence };
  }
}

export async function ocrFileFast(file: File, onProgress?: (p: number) => void): Promise<OcrPayload> {
  const canvas = await toCanvas(file, { fast: true });
  onProgress?.(5);
  try {
    const primary = await runTesseract('spa', canvas, onProgress);
    onProgress?.(100);
    return { rawText: primary.text, confidence: primary.confidence };
  } catch {
    const fallback = await runTesseract('eng', canvas, onProgress);
    onProgress?.(100);
    return { rawText: fallback.text, confidence: fallback.confidence };
  }
}
