import { sleep } from '../../utils/sleep';
import { perceiveBusinessImage } from './aiPerception';
import { normalizeImageResult } from './normalizeImageResult';
import type { BusinessImageAnalysisResult, RequestedBusinessCategory } from './types';

const buildSeed = async (fileOrBlob: Blob | File): Promise<number> => {
  const sample = new Uint8Array(await fileOrBlob.slice(0, 8_000).arrayBuffer());
  let hash = fileOrBlob.size;
  for (let index = 0; index < sample.length; index += 1) {
    hash = (hash * 31 + sample[index]) >>> 0;
  }
  return hash;
};

const mismatchWarningByRequested: Record<RequestedBusinessCategory, string> = {
  FACHADA: 'La imagen no corresponde a una fachada de negocio.',
  INTERIOR: 'La imagen no corresponde al interior de un negocio.',
  INVENTARIO: 'La imagen no corresponde al inventario de un negocio.'
};

export const analyzeBusinessImage = async (
  fileOrBlob: Blob | File,
  requestedCategory: RequestedBusinessCategory
): Promise<BusinessImageAnalysisResult> => {
  await sleep(700 + Math.random() * 700);

  const [seed, perception] = await Promise.all([buildSeed(fileOrBlob), perceiveBusinessImage(fileOrBlob)]);
  const decision = normalizeImageResult(requestedCategory, perception.features, perception.quality, seed, perception.aiGeneratedProbability);

  const warnings: string[] = [];
  if (decision.mismatchReason === 'IMAGEN_AMBIGUA' || decision.mismatchReason === 'CALIDAD_BAJA') {
    warnings.push('No se pudo confirmar con suficiente certeza que la imagen corresponda al tipo solicitado.');
  } else if (decision.validationResult === 'REVISAR' && decision.categoryProbability < 90) {
    warnings.push('La probabilidad de que esta imagen corresponda al tipo solicitado es baja');
  } else if (decision.validationResult === 'NO COINCIDE') {
    warnings.push(mismatchWarningByRequested[requestedCategory]);
  }
  if (perception.aiGeneratedProbability > 60) {
    warnings.push('Posible imagen generada por inteligencia artificial');
  }
  const uniqueWarnings = Array.from(new Set(warnings));

  return {
    description: perception.description,
    features: perception.features,
    detectedCategory: decision.detectedCategory,
    requestedCategory,
    categoryMatch: decision.categoryMatch,
    categoryProbability: decision.categoryProbability,
    aiGeneratedProbability: perception.aiGeneratedProbability,
    validationResult: decision.validationResult,
    mismatchReason: decision.mismatchReason,
    warnings: uniqueWarnings
  };
};
