import { sleep } from '../utils/sleep';
import type { ImageAnalysis, ImageKind } from '../types/onboarding';

const randomBetween = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const descriptions: Record<ImageKind, string[]> = {
  fachada: ['Fachada de local comercial con señalizacion visible', 'Entrada principal de comercio a pie de calle'],
  interior: ['Area interna del local con mostrador y zona de atencion', 'Interior de comercio con espacio operativo visible'],
  inventario: ['Productos organizados en estantes con inventario visible', 'Zona de inventario con mercancia almacenada']
};

export const analyzeImage = async (blob: Blob, kind: ImageKind): Promise<ImageAnalysis> => {
  await sleep(1200 + Math.random() * 1000);

  const expectedTypeProbability = Math.max(55, Math.min(99, randomBetween(78, 98) - (blob.size < 50_000 ? 12 : 0)));
  const aiGeneratedProbability = Math.max(0, Math.min(99, randomBetween(4, 70)));

  const warnings: string[] = [];
  if (expectedTypeProbability < 90) warnings.push('Probabilidad baja de que sea la foto solicitada');
  if (aiGeneratedProbability > 60) warnings.push('Posible imagen generada por IA');

  return {
    kind,
    description: descriptions[kind][randomBetween(0, descriptions[kind].length - 1)],
    expectedTypeProbability,
    aiGeneratedProbability,
    warnings
  };
};
