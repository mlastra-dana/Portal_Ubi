export type DocKind = 'CEDULA' | 'RIF' | 'ACTA' | 'REGISTRO' | 'CEDULA_REPRESENTANTE';

export type OcrExtractedFields = {
  nombres: string | null;
  numeroId: string | null;
  fechaVencimiento: string | null;
};

export type UploadedDocumentResult = {
  id: string;
  file: File;
  progress: number;
  processing: boolean;
  rawText: string;
  confidence: number | null;
  fields: OcrExtractedFields;
  parseWarning?: string;
  error?: string;
};

export type CommerceImageKind = 'fachada' | 'interior' | 'inventario';

export type CommerceImageItem = {
  kind: CommerceImageKind;
  label: string;
  file?: File;
  blob?: Blob;
  previewUrl?: string;
  error?: string;
};
