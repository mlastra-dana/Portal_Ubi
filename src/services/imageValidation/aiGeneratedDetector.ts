import type { PerceptionFeatures, QualitySignals } from './types';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const hashBytes = (bytes: Uint8Array): number => {
  let hash = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    hash = (hash * 33 + bytes[index]) >>> 0;
  }
  return hash;
};

const sizeScore = (size: number): number => {
  if (size < 70_000) return 32;
  if (size < 180_000) return 46;
  if (size < 500_000) return 58;
  return 68;
};

export const detectAiGeneratedProbability = async (
  fileOrBlob: Blob | File,
  features: PerceptionFeatures,
  quality: QualitySignals
): Promise<number> => {
  const sample = new Uint8Array(await fileOrBlob.slice(0, 18_000).arrayBuffer());
  const hash = hashBytes(sample) ^ fileOrBlob.size;
  const variation = (hash % 17) - 8;
  const businessSignalBoost = features.buildingExterior || features.commercialInterior || features.productsVisible ? 4 : 0;
  const facePenalty = features.personVisible ? -20 : 0;
  const darkPenalty = quality.brightness < 30 ? -10 : 0;
  return clamp(sizeScore(fileOrBlob.size) + businessSignalBoost + variation + facePenalty + darkPenalty, 3, 97);
};
