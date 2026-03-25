export type DocKind = 'CEDULA' | 'RIF' | 'ACTA' | 'REGISTRO' | 'ACTA_REGISTRO' | 'CEDULA_REPRESENTANTE';

export type OcrExtractedFields = {
  nombres: string | null;
  numeroId: string | null;
  fechaVencimiento: string | null;
};

export type UploadedDocumentResult = {
  id: string;
  file: File;
  previewUrl?: string;
  progress: number;
  processing: boolean;
  rawText: string;
  ocrDisplayText?: string;
  confidence: number | null;
  fields: OcrExtractedFields;
  validationStatus?: 'VALIDO' | 'REVISAR';
  validationMessage?: string;
  parseWarning?: string;
  error?: string;
};

export type CommerceImageKind = 'fachada' | 'interior' | 'inventario';
export type BusinessImageCategory = 'FACHADA' | 'INTERIOR' | 'INVENTARIO';
export type DetectedBusinessImageCategory = BusinessImageCategory | 'PERSONA' | 'NO_CLASIFICADA';
export type ValidationResult = 'VALIDADA' | 'REVISAR' | 'NO COINCIDE';
export type MismatchReason = 'PERSONA_DETECTADA' | 'OTRA_CATEGORIA' | 'IMAGEN_AMBIGUA' | 'CALIDAD_BAJA' | 'CONTENIDO_IRRELEVANTE' | null;
export type PerceptionFeatures = {
  personVisible: boolean;
  buildingExterior: boolean;
  commercialInterior: boolean;
  productsVisible: boolean;
};

export type CommerceImageAnalysis = {
  description: string;
  features: PerceptionFeatures;
  detectedCategory: DetectedBusinessImageCategory;
  requestedCategory: BusinessImageCategory;
  categoryMatch: boolean;
  categoryProbability: number;
  expectedTypeProbability: number;
  aiGeneratedProbability: number;
  validationResult: ValidationResult;
  mismatchReason: MismatchReason;
  warnings: string[];
};

export type CommerceImageItem = {
  kind: CommerceImageKind;
  label: string;
  analysisToken?: string;
  file?: File;
  blob?: Blob;
  previewUrl?: string;
  error?: string;
  analyzing?: boolean;
  analysis?: CommerceImageAnalysis;
  analysisError?: string;
  validationStatus?: 'VALIDO' | 'REVISAR';
  validationMessage?: string;
};
