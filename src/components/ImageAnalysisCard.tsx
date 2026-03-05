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
    <div className="space-y-3 rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
      {previewUrl ? <img src={previewUrl} alt="Preview evidencia" className="h-56 w-full rounded-xl object-cover" /> : null}

      {processing ? (
        <div className="flex items-center gap-2 text-sm text-ubii-hover">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ubii-blue/30 border-t-ubii-blue" />
          Analizando imagen con IA...
        </div>
      ) : null}

      {analysis ? (
        <div className="space-y-2 text-sm text-ubii-black">
          <p>
            <span className="text-gray-700">Descripcion IA:</span> {analysis.description}
          </p>
          <p>
            <span className="text-gray-700">Probabilidad de coincidencia:</span> {analysis.expectedTypeProbability}%
          </p>
          <p>
            <span className="text-gray-700">Probabilidad IA-generada:</span> {analysis.aiGeneratedProbability}%
          </p>

          {analysis.warnings.map((warning) => (
            <AlertBanner key={warning} type="warning">
              {warning}
            </AlertBanner>
          ))}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">Revision manual del analista</p>
        <AnalystApproveToggle value={decision} onChange={onDecisionChange} />
      </div>
    </div>
  );
}
