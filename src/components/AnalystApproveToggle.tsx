import type { ManualReviewDecision } from '../types/onboarding';
import { PrimaryButton } from './ui/PrimaryButton';

export function AnalystApproveToggle({
  value,
  onChange
}: {
  value: ManualReviewDecision;
  onChange: (value: ManualReviewDecision) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <PrimaryButton
        onClick={() => onChange('approved')}
        className={value === 'approved' ? 'ring-2 ring-ubii-blue ring-offset-2' : ''}
      >
        Aprobar
      </PrimaryButton>
      <PrimaryButton
        onClick={() => onChange('rejected')}
        className={value === 'rejected' ? 'ring-2 ring-ubii-blue ring-offset-2' : ''}
      >
        No aprobar
      </PrimaryButton>
    </div>
  );
}
