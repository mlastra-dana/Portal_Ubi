import { detectAiGeneratedProbability } from './aiGeneratedDetector';
import { buildImageDescription } from './imageDescription';
import type { PerceptionFeatures, PerceptionResult, QualitySignals } from './types';

const keywordSignal = (name: string, pattern: RegExp): boolean => pattern.test(name.toLowerCase());

const detectFaces = async (blob: Blob): Promise<number> => {
  if (typeof window === 'undefined' || !('FaceDetector' in window)) return 0;
  try {
    const detector = new (window as typeof window & { FaceDetector: new () => { detect: (source: ImageBitmap) => Promise<unknown[]> } }).FaceDetector();
    const bitmap = await createImageBitmap(blob);
    try {
      const faces = await detector.detect(bitmap);
      return faces.length;
    } finally {
      bitmap.close();
    }
  } catch {
    return 0;
  }
};

const readVisualSignals = async (blob: Blob): Promise<QualitySignals> => {
  if (typeof window === 'undefined' || typeof createImageBitmap === 'undefined') return { brightness: 55, blurry: false, centerSkinRatio: 0 };
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      bitmap.close();
      return { brightness: 55, blurry: false, centerSkinRatio: 0 };
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    bitmap.close();

    let totalLum = 0;
    let edgeSum = 0;
    let centerPixels = 0;
    let centerSkinPixels = 0;
    const width = canvas.width;
    for (let index = 0; index < pixels.length; index += 4) {
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      totalLum += lum;
      const pixelIndex = index / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      if (x >= 7 && x <= 20 && y >= 7 && y <= 20) {
        centerPixels += 1;
        const isSkinLike = r > 70 && g > 45 && b > 35 && r > g && r > b && Math.abs(r - g) > 8;
        if (isSkinLike) centerSkinPixels += 1;
      }
      if (pixelIndex % width !== width - 1) {
        const right = index + 4;
        const rr = pixels[right];
        const rg = pixels[right + 1];
        const rb = pixels[right + 2];
        const rightLum = 0.2126 * rr + 0.7152 * rg + 0.0722 * rb;
        edgeSum += Math.abs(lum - rightLum);
      }
    }
    const brightness = Math.round(totalLum / (pixels.length / 4));
    const sharpness = edgeSum / (pixels.length / 4);
    const centerSkinRatio = centerPixels > 0 ? centerSkinPixels / centerPixels : 0;
    return { brightness, blurry: sharpness < 7, centerSkinRatio };
  } catch {
    return { brightness: 55, blurry: false, centerSkinRatio: 0 };
  }
};

const deriveFeatures = (fileOrBlob: Blob | File, faceCount: number, quality: QualitySignals): PerceptionFeatures => {
  const fileName = fileOrBlob instanceof File ? fileOrBlob.name.toLowerCase() : '';
  const personVisible =
    faceCount > 0 || keywordSignal(fileName, /(selfie|retrato|portrait|face|persona)/) || quality.centerSkinRatio > 0.18;
  const buildingExterior = keywordSignal(fileName, /(fachada|frente|exterior|entrada|storefront|outdoor)/);
  const commercialInterior = keywordSignal(fileName, /(interior|mostrador|caja|counter|shop|tienda|local)/);
  const productsVisible = keywordSignal(fileName, /(inventario|producto|mercancia|stock|shelf|estante|anaquel|warehouse)/);

  if (quality.brightness < 25) {
    return {
      personVisible,
      buildingExterior: false,
      commercialInterior: false,
      productsVisible: false
    };
  }

  return { personVisible, buildingExterior, commercialInterior, productsVisible };
};

export const perceiveBusinessImage = async (fileOrBlob: Blob | File): Promise<PerceptionResult & { quality: QualitySignals }> => {
  const [faceCount, quality] = await Promise.all([detectFaces(fileOrBlob), readVisualSignals(fileOrBlob)]);
  const features = deriveFeatures(fileOrBlob, faceCount, quality);
  const aiGeneratedProbability = await detectAiGeneratedProbability(fileOrBlob, features, quality);
  const description = buildImageDescription(features, quality);
  return {
    description,
    features,
    aiGeneratedProbability,
    quality
  };
};
