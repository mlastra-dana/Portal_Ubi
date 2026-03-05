import { Badge } from './Badge';
import type { ValidationItemResult } from '../types/onboarding';

type ReviewItem = {
  name: string;
  category: string;
  result?: ValidationItemResult;
};

export function ReviewTable({ items }: { items: ReviewItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-borderSoft">
      <table className="min-w-full divide-y divide-borderSoft bg-white">
        <thead className="bg-bgSoft">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Item</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Categoria</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Estado</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Score</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Warnings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borderSoft">
          {items.map((item) => {
            const result = item.result;
            const score = result?.score ?? 0;
            return (
              <tr key={item.name}>
                <td className="px-3 py-2 text-sm text-textMain">{item.name}</td>
                <td className="px-3 py-2 text-sm text-gray-600">{item.category}</td>
                <td className="px-3 py-2">
                  <Badge status={result?.status ?? 'pendiente'} />
                </td>
                <td className="px-3 py-2">
                  <div className="w-24">
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(score, 100))}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{score}/100</p>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">{result?.warnings.join(', ') || 'Sin alertas'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
