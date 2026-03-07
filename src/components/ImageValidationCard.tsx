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
  PERSONA_DETECTADA: 'La imagen corresponde a una persona y no al tipo solicitado.',
  OTRA_CATEGORIA: 'La imagen corresponde a otra categoría distinta a la solicitada.',
  IMAGEN_AMBIGUA: 'La imagen no tiene suficiente claridad para confirmar el tipo solicitado.',
  CALIDAD_BAJA: 'La calidad de la imagen no permite validarla con confianza.',
  CONTENIDO_IRRELEVANTE: 'La imagen no contiene elementos relevantes para la validación.'
};

type Props = {
  previewUrl?: string;
  requestedLabel: string;
  analyzing?: boolean;
  analysis?: CommerceImageAnalysis;
  onRemovePreview?: () => void;
};

export function ImageValidationCard({ previewUrl, requestedLabel, analyzing, analysis, onRemovePreview }: Props) {
  if (analyzing) {
    return (
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#4B98CB] border-t-transparent" />
          Analizando imagen...
        </p>
        <div className="h-36 animate-pulse rounded-xl bg-[#F5F9FD]" />
        <div className="space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-[#F5F9FD]" />
          <div className="h-3 w-full animate-pulse rounded bg-[#F5F9FD]" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-[#F5F9FD]" />
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const state = analysis.validationResult;
  const mainReasonText = analysis.mismatchReason ? mismatchReasonLabel[analysis.mismatchReason] : 'Sin observaciones relevantes.';
  const mainBanner = (() => {
    if (state === 'VALIDADA') return null;
    if (analysis.requestedCategory === 'FACHADA') {
      return state === 'NO COINCIDE'
        ? 'La imagen no corresponde a una fachada de negocio.'
        : 'No se pudo confirmar que la imagen corresponda a la fachada del negocio.';
    }
    if (analysis.requestedCategory === 'INTERIOR') {
      return state === 'NO COINCIDE'
        ? 'La imagen no corresponde al interior de un negocio.'
        : 'No se pudo confirmar que la imagen corresponda al interior del negocio.';
    }
    return state === 'NO COINCIDE'
      ? 'La imagen no corresponde al inventario de un negocio.'
      : 'No se pudo confirmar que la imagen corresponda al inventario del negocio.';
  })();
  const showAiBanner = analysis.aiGeneratedProbability > 60;

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-4">
      {previewUrl ? (
        <div className="relative rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <img src={previewUrl} alt={`Preview ${requestedLabel}`} className="h-52 w-full rounded-xl object-cover" />
          {onRemovePreview ? (
            <button
              type="button"
              onClick={onRemovePreview}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-base font-bold text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
              aria-label={`Eliminar ${requestedLabel}`}
              title="Eliminar imagen"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 text-sm text-[#111111] shadow-sm">

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#111111]">Resultado de validación</p>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stateStyles[state]}`}>{stateLabel[state]}</span>
        </div>

        <p className="text-sm leading-6 text-[#111111]">{analysis.description}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-[#F5F9FD] px-3 py-1 font-semibold text-[#111111]">{Math.round(analysis.categoryProbability)}% coincidencia</span>
          <span className="rounded-full bg-[#F5F9FD] px-3 py-1 font-semibold text-[#111111]">{Math.round(analysis.aiGeneratedProbability)}% IA</span>
        </div>

        <p className="text-xs text-gray-600">{mainReasonText}</p>

        {mainBanner ? <AlertBanner type={state === 'NO COINCIDE' ? 'error' : 'warning'}>{mainBanner}</AlertBanner> : null}
        {showAiBanner ? <AlertBanner type="warning">Posible imagen generada por inteligencia artificial.</AlertBanner> : null}
      </div>
    </div>
  );
}
