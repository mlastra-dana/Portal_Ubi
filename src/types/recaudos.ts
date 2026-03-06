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
  confidence: number | null;
  fields: OcrExtractedFields;
  validationStatus?: 'VALIDO' | 'REVISAR';
  validationMessage?: string;
  parseWarning?: string;
  error?: string;
};

export type CommerceImageKind = 'fachada' | 'interior' | 'inventario';

export type CommerceImageAnalysis = {
  description: string;
  expectedTypeProbability: number;
  aiGeneratedProbability: number;
  warnings: string[];
};

export type CommerceImageItem = {
  kind: CommerceImageKind;
  label: string;
  file?: File;
  blob?: Blob;
  previewUrl?: string;
  error?: string;
  analyzing?: boolean;
  analysis?: CommerceImageAnalysis;
  analysisError?: string;
};
