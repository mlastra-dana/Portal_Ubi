import { classifyDetectedCategory } from './categoryClassifier';
import type { DecisionResult, PerceptionFeatures, QualitySignals, RequestedBusinessCategory } from './types';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const probabilityByRange = (seed: number, min: number, max: number): number => {
  const span = max - min + 1;
  return clamp(min + (seed % span), min, max);
};

const requestedIndicatorPresent = (requestedCategory: RequestedBusinessCategory, features: PerceptionFeatures): boolean => {
  if (requestedCategory === 'FACHADA') return features.buildingExterior;
  if (requestedCategory === 'INTERIOR') return features.commercialInterior;
  return features.productsVisible;
};

const findOtherBusinessCategory = (
  requestedCategory: RequestedBusinessCategory,
  features: PerceptionFeatures
): DecisionResult['detectedCategory'] | null => {
  if (requestedCategory !== 'INVENTARIO' && features.productsVisible) return 'INVENTARIO';
  if (requestedCategory !== 'INTERIOR' && features.commercialInterior) return 'INTERIOR';
  if (requestedCategory !== 'FACHADA' && features.buildingExterior) return 'FACHADA';
  return null;
};

export const normalizeImageResult = (
  requestedCategory: RequestedBusinessCategory,
  features: PerceptionFeatures,
  quality: QualitySignals,
  seed: number,
  aiGeneratedProbability: number
): DecisionResult => {
  const preliminaryDetected = classifyDetectedCategory(features, quality);
  const hasAnyBusinessSignal = features.buildingExterior || features.commercialInterior || features.productsVisible;
  const requestedPresent = requestedIndicatorPresent(requestedCategory, features);

  // Selfie / persona dominante sin señales del tipo solicitado.
  if (features.personVisible && !requestedPresent && !hasAnyBusinessSignal) {
    return {
      detectedCategory: 'PERSONA',
      categoryMatch: false,
      categoryProbability: probabilityByRange(seed, 0, 10),
      validationResult: 'NO COINCIDE',
      mismatchReason: 'PERSONA_DETECTADA'
    };
  }

  // Caso válido para el tipo solicitado.
  if (requestedPresent) {
    return {
      detectedCategory: requestedCategory,
      categoryMatch: true,
      categoryProbability: probabilityByRange(seed, 90, 100),
      validationResult: aiGeneratedProbability > 60 ? 'REVISAR' : 'VALIDADA',
      mismatchReason: null
    };
  }

  // Imagen reconocible, pero de otra categoría de negocio.
  const otherBusinessCategory = findOtherBusinessCategory(requestedCategory, features);
  if (otherBusinessCategory) {
    return {
      detectedCategory: otherBusinessCategory,
      categoryMatch: false,
      categoryProbability: probabilityByRange(seed, 10, 25),
      validationResult: 'NO COINCIDE',
      mismatchReason: 'OTRA_CATEGORIA'
    };
  }

  // Escena ambigua o de baja calidad sin señales útiles.
  return {
    detectedCategory: preliminaryDetected === 'PERSONA' ? 'PERSONA' : 'NO_CLASIFICADA',
    categoryMatch: false,
    categoryProbability:
      preliminaryDetected === 'PERSONA' ? probabilityByRange(seed, 0, 10) : probabilityByRange(seed, 30, 60),
    validationResult: preliminaryDetected === 'PERSONA' ? 'NO COINCIDE' : 'REVISAR',
    mismatchReason:
      preliminaryDetected === 'PERSONA'
        ? 'PERSONA_DETECTADA'
        : quality.brightness < 28 || quality.blurry
        ? 'CALIDAD_BAJA'
        : 'IMAGEN_AMBIGUA'
  };
};
