import type { PropsWithChildren } from 'react';

export function AlertBanner({ type, children }: PropsWithChildren<{ type: 'info' | 'warning' | 'success' }>) {
  const styles = {
    info: 'border-blue-300 bg-blue-500/15 text-blue-100',
    warning: 'border-amber-300 bg-amber-500/15 text-amber-100',
    success: 'border-emerald-300 bg-emerald-500/15 text-emerald-100'
  };

  return <div className={`rounded-xl border px-3 py-2 text-sm ${styles[type]}`}>{children}</div>;
}
