export type RequestedBusinessCategory = 'FACHADA' | 'INTERIOR' | 'INVENTARIO';
export type DetectedBusinessCategory = RequestedBusinessCategory | 'PERSONA' | 'NO_CLASIFICADA';
export type ValidationResult = 'VALIDADA' | 'REVISAR' | 'NO COINCIDE';
export type MismatchReason = 'PERSONA_DETECTADA' | 'OTRA_CATEGORIA' | 'IMAGEN_AMBIGUA' | 'CALIDAD_BAJA' | 'CONTENIDO_IRRELEVANTE' | null;
export type AiGeneratedLabel = 'NO_EVIDENTE' | 'POSIBLE_IA' | 'ALTA_SOSPECHA_IA';

export type PerceptionFeatures = {
  personVisible: boolean;
  buildingExterior: boolean;
  commercialInterior: boolean;
  productsVisible: boolean;
};

export type PerceptionResult = {
  description: string;
  features: PerceptionFeatures;
  aiGeneratedProbability: number;
};

export type BusinessImageAnalysisResult = {
  description: string;
  features?: PerceptionFeatures;
  detectedCategory: DetectedBusinessCategory;
  requestedCategory: RequestedBusinessCategory;
  categoryMatch: boolean;
  categoryProbability: number;
  aiGeneratedProbability?: number;
  aiGeneratedLabel?: AiGeneratedLabel;
  validationResult: ValidationResult;
  mismatchReason: MismatchReason;
  warnings: string[];
};

export type ClassificationResult = {
  detectedCategory: DetectedBusinessCategory;
};

export type QualitySignals = {
  brightness: number;
  blurry: boolean;
  centerSkinRatio: number;
};

export type DecisionResult = {
  detectedCategory: DetectedBusinessCategory;
  categoryMatch: boolean;
  categoryProbability: number;
  validationResult: ValidationResult;
  mismatchReason: MismatchReason;
};
