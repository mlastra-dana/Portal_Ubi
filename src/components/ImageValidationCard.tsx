import { AlertBanner } from './AlertBanner';
import type { CommerceImageAnalysis } from '../types/recaudos';

const stateStyles: Record<CommerceImageAnalysis['validationResult'], string> = {
  VALIDADA: 'bg-emerald-100 text-emerald-700',
  REVISAR: 'bg-amber-100 text-amber-800',
  'NO COINCIDE': 'bg-red-100 text-red-700'
};

const stateLabel: Record<CommerceImageAnalysis['validationResult'], string> = {
  VALIDADA: 'Validada',
  REVISAR: 'Revisar',
  'NO COINCIDE': 'No coincide'
};

const mismatchReasonLabel: Record<Exclude<CommerceImageAnalysis['mismatchReason'], null>, string> = {
  PERSONA_DETECTADA: 'PERSONA_DETECTADA',
  OTRA_CATEGORIA: 'OTRA_CATEGORIA',
  IMAGEN_AMBIGUA: 'IMAGEN_AMBIGUA',
  CALIDAD_BAJA: 'CALIDAD_BAJA',
  CONTENIDO_IRRELEVANTE: 'CONTENIDO_IRRELEVANTE'
};

type Props = {
  previewUrl?: string;
  requestedLabel: string;
  analyzing?: boolean;
  analysis?: CommerceImageAnalysis;
  validationMessage?: string;
};

export function ImageValidationCard({ previewUrl, requestedLabel, analyzing, analysis, validationMessage }: Props) {
  if (analyzing) {
    return (
      <div className="rounded-lg border border-ubii-blue/30 bg-white p-3 text-sm text-ubii-black">
        <p className="flex items-center gap-2 font-semibold">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ubii-blue border-t-transparent" />
          Analizando imagen...
        </p>
      </div>
    );
  }

  if (!analysis) return null;

  const state = analysis.validationResult;
  const uniqueWarnings = Array.from(new Set(analysis.warnings));

  return (
    <div className="space-y-2 rounded-lg border border-ubii-border bg-white p-3 text-xs text-ubii-black shadow-soft">
      {previewUrl ? <img src={previewUrl} alt={`Preview ${requestedLabel}`} className="h-40 w-full rounded-xl object-cover" /> : null}

      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ubii-black">Resultado de validación</p>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${stateStyles[state]}`}>{stateLabel[state]}</span>
      </div>

      <p>
        <span className="font-semibold">Tipo solicitado:</span> {analysis.requestedCategory}
      </p>
      <p>
        <span className="font-semibold">Descripción IA:</span> {analysis.description}
      </p>
      <p>
        <span className="font-semibold">Tipo detectado:</span> {analysis.detectedCategory}
      </p>
      <p>
        <span className="font-semibold">Coincidencia:</span> {analysis.categoryMatch ? 'Sí' : 'No'}
      </p>
      <p>
        <span className="font-semibold">Probabilidad de coincidencia con el tipo solicitado:</span> {Math.round(analysis.categoryProbability)}%
      </p>
      <p>
        <span className="font-semibold">Probabilidad IA-generada:</span> {Math.round(analysis.aiGeneratedProbability)}%
      </p>
      <p>
        <span className="font-semibold">Motivo principal:</span>{' '}
        {analysis.mismatchReason ? mismatchReasonLabel[analysis.mismatchReason] : 'NINGUNO'}
      </p>

      {uniqueWarnings.map((warning) => (
        <AlertBanner key={`${analysis.requestedCategory}-${warning}`} type="warning">
          {warning}
        </AlertBanner>
      ))}

      {validationMessage ? (
        <AlertBanner type={state === 'VALIDADA' ? 'success' : state === 'REVISAR' ? 'warning' : 'error'}>{validationMessage}</AlertBanner>
      ) : null}
    </div>
  );
}
