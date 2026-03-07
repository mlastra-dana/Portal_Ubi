import type { DetectedBusinessCategory, PerceptionFeatures, QualitySignals } from './types';

export const classifyDetectedCategory = (features: PerceptionFeatures, quality: QualitySignals): DetectedBusinessCategory => {
  const businessSignals = Number(features.buildingExterior) + Number(features.commercialInterior) + Number(features.productsVisible);
  if (features.personVisible && businessSignals === 0) return 'PERSONA';
  if (quality.brightness < 28 || quality.blurry) return 'NO_CLASIFICADA';
  if (features.productsVisible) return 'INVENTARIO';
  if (features.commercialInterior) return 'INTERIOR';
  if (features.buildingExterior) return 'FACHADA';
  return 'NO_CLASIFICADA';
};
