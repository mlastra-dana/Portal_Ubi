import { FileDropzone } from './FileDropzone';
import { ValidationResults } from './ValidationResults';
import { formatBytes } from '../utils/format';
import type { DocumentEntry } from '../types/onboarding';

export function DocumentUploader({
  document,
  loading,
  onFile,
  details
}: {
  document: DocumentEntry;
  loading: boolean;
  onFile: (file?: File) => void;
  details?: { label: string; value: string }[];
}) {
  const isImage = Boolean(document.file && document.file.type.startsWith('image/'));

  return (
    <div className="space-y-2 rounded-xl border border-borderSoft p-3">
      <FileDropzone
        id={`file-${document.type}`}
        accept=".pdf,image/png,image/jpeg"
        onFile={onFile}
        label={`${document.label}${document.required ? ' *' : ''}`}
        hint="Permitido: PDF, PNG, JPG"
      />
      {document.file ? (
        <div className="rounded-lg border border-borderSoft bg-bgSoft p-2 text-xs text-gray-600">
          <p>
            {document.file.name} · {formatBytes(document.file.size)}
          </p>
          {isImage ? <img src={document.previewUrl} alt={document.label} className="mt-2 h-24 w-full rounded-md object-cover" /> : null}
        </div>
      ) : null}
      <ValidationResults title="Resultado IA" loading={loading} loadingText="Analizando documento..." result={document.result} details={details} />
    </div>
  );
}
