export type ApplicantType = 'natural' | 'juridica';
export type ValidationBadge = 'validado' | 'revisar' | 'rechazado' | 'pendiente';

export type ValidationResponse = {
  ok: boolean;
  score: number;
  labels: string[];
  extractedFields: Record<string, string>;
  warnings: string[];
};

export type ValidationItemResult = {
  status: ValidationBadge;
  score: number;
  warnings: string[];
  labels?: string[];
  extractedFields?: Record<string, string>;
};

export type DocumentType = 'cedula' | 'rif' | 'acta';
export type PhotoKind = 'fachada' | 'interior' | 'inventario';

export type DocumentEntry = {
  type: DocumentType;
  label: string;
  required: boolean;
  file?: File;
  previewUrl?: string;
  result?: ValidationItemResult;
};

export type CapturedMedia = {
  blob: Blob;
  previewUrl: string;
  mimeType: string;
  size: number;
  capturedAt: string;
};

export type PhotoEntry = {
  kind: PhotoKind;
  label: string;
  required: boolean;
  capture?: CapturedMedia;
  result?: ValidationItemResult;
};

export type LivenessEntry = {
  selfie?: CapturedMedia;
  shortVideo?: CapturedMedia;
  gestureDone: boolean;
  result?: ValidationItemResult;
};

export type ApplicantInfo = {
  type: ApplicantType;
  businessName: string;
  idOrRif: string;
  phone: string;
  email: string;
};

export type WizardState = {
  currentStep: number;
  applicant: ApplicantInfo;
  documents: DocumentEntry[];
  photos: PhotoEntry[];
  liveness: LivenessEntry;
  finalRegistrationNumber?: string;
  submittedAt?: string;
};
