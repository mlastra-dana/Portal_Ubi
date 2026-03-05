export type ApplicantType = 'natural' | 'juridica';
export type DocType = 'cedula' | 'rif';
export type ExpiryStatus = 'OK' | 'VENCIDO' | 'PROXIMO_A_VENCER';

export type OcrExtractedFields = {
  fullName: string;
  documentNumber: string;
  expiryDate: string;
};

export type OcrResult = {
  docType: DocType;
  detectedType: DocType | 'desconocido';
  extracted: OcrExtractedFields;
  confidence: number;
  expiryStatus: ExpiryStatus;
  formatValid: boolean;
  consistency: 'OK' | 'REVISAR';
  warnings: string[];
};

export type ImageKind = 'fachada' | 'interior' | 'inventario';

export type ImageAnalysis = {
  kind: ImageKind;
  description: string;
  expectedTypeProbability: number;
  aiGeneratedProbability: number;
  warnings: string[];
};

export type ManualReviewDecision = 'approved' | 'rejected' | null;

export type ImageItemState = {
  kind: ImageKind;
  label: string;
  blob?: Blob;
  previewUrl?: string;
  analysis?: ImageAnalysis;
  decision: ManualReviewDecision;
};

export type OnboardingSummary = {
  ocr: {
    cedula?: OcrResult;
    rif?: OcrResult;
  };
  imageAnalysis: ImageAnalysis[];
  warnings: string[];
};
