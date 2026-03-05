import type { PhotoKind } from '../types/onboarding';
import { sleep } from '../utils/sleep';
import { clamp } from '../utils/format';

export type ImageAiResult = {
  labels: string[];
  aiGeneratedProbability: number;
  webMatchProbability: number;
  crmDuplicateProbability: number;
  imageQualityScore: number;
};

const randomBetween = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const kindLabelMap: Record<PhotoKind, string> = {
  fachada: 'fachada de comercio',
  interior: 'interior de comercio',
  inventario: 'inventario en exhibicion'
};

export const simulateImageValidation = async (kind: PhotoKind, image: Blob): Promise<ImageAiResult> => {
  await sleep(1100 + Math.random() * 1000);

  const primary = Math.random() > 0.82 ? 'escena no concluyente' : kindLabelMap[kind];
  const aiGeneratedProbability = clamp(randomBetween(0, 15) + (image.size < 35_000 ? 20 : 0), 0, 99);
  const webMatchProbability = clamp(randomBetween(0, 10), 0, 99);
  const crmDuplicateProbability = clamp(randomBetween(0, 8), 0, 99);
  const imageQualityScore = clamp(randomBetween(72, 96) - (image.size < 50_000 ? 18 : 0), 35, 99);

  return {
    labels: [primary],
    aiGeneratedProbability,
    webMatchProbability,
    crmDuplicateProbability,
    imageQualityScore
  };
};
