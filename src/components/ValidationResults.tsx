import { Badge } from './Badge';
import type { ValidationItemResult } from '../types/onboarding';

type Detail = { label: string; value: string };

export function ValidationResults({
  title,
  loading,
  loadingText,
  result,
  details
}: {
  title: string;
  loading: boolean;
  loadingText: string;
  result?: ValidationItemResult;
  details?: Detail[];
}) {
  return (
    <div className="rounded-xl border border-borderSoft bg-bgSoft p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-textMain">{title}</h4>
        <Badge status={result?.status ?? 'pendiente'} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          {loadingText}
        </div>
      ) : null}

      {result ? (
        <>
          <div className="mt-2">
            <div className="h-2 rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(result.score, 100))}%` }} />
            </div>
            <p className="mt-1 text-xs text-gray-600">Score: {result.score}%</p>
          </div>
          {details && details.length > 0 ? (
            <dl className="mt-2 grid gap-1 text-xs text-gray-700">
              {details.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <dt className="font-medium text-gray-500">{item.label}</dt>
                  <dd className="text-right text-textMain">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {result.warnings.length > 0 ? <p className="mt-2 text-xs text-amber-700">{result.warnings.join(' · ')}</p> : null}
        </>
      ) : null}
    </div>
  );
}
