import { AlertBanner } from './AlertBanner';
import { AnalystApproveToggle } from './AnalystApproveToggle';
import type { ImageAnalysis, ManualReviewDecision } from '../types/onboarding';

export function ImageAnalysisCard({
  previewUrl,
  processing,
  analysis,
  decision,
  onDecisionChange
}: {
  previewUrl?: string;
  processing: boolean;
  analysis?: ImageAnalysis;
  decision: ManualReviewDecision;
  onDecisionChange: (value: ManualReviewDecision) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      {previewUrl ? <img src={previewUrl} alt="Preview evidencia" className="h-56 w-full rounded-xl object-cover" /> : null}

      {processing ? (
        <div className="flex items-center gap-2 text-sm text-blue-100">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200/40 border-t-blue-100" />
          Analizando imagen con IA...
        </div>
      ) : null}

      {analysis ? (
        <div className="space-y-2 text-sm text-slate-100">
          <p>
            <span className="text-slate-300">Descripcion IA:</span> {analysis.description}
          </p>
          <p>
            <span className="text-slate-300">Probabilidad de coincidencia:</span> {analysis.expectedTypeProbability}%
          </p>
          <p>
            <span className="text-slate-300">Probabilidad IA-generada:</span> {analysis.aiGeneratedProbability}%
          </p>

          {analysis.warnings.map((warning) => (
            <AlertBanner key={warning} type="warning">
              {warning}
            </AlertBanner>
          ))}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">Revision manual del analista</p>
        <AnalystApproveToggle value={decision} onChange={onDecisionChange} />
      </div>
    </div>
  );
}
