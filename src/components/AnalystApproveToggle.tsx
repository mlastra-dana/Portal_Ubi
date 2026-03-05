import type { ManualReviewDecision } from '../types/onboarding';

export function AnalystApproveToggle({
  value,
  onChange
}: {
  value: ManualReviewDecision;
  onChange: (value: ManualReviewDecision) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange('approved')}
        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
          value === 'approved' ? 'border-emerald-300 bg-emerald-500/20 text-emerald-100' : 'border-slate-500 bg-slate-800 text-slate-200'
        }`}
      >
        Aprobar
      </button>
      <button
        type="button"
        onClick={() => onChange('rejected')}
        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
          value === 'rejected' ? 'border-amber-300 bg-amber-500/20 text-amber-100' : 'border-slate-500 bg-slate-800 text-slate-200'
        }`}
      >
        No aprobar
      </button>
    </div>
  );
}
