import type { PropsWithChildren } from 'react';

export function AlertBanner({ type, children }: PropsWithChildren<{ type: 'info' | 'warning' | 'success' | 'error' }>) {
  const styles = {
    info: 'border-white/40 bg-white/10 text-white',
    warning: 'border-amber-300 bg-amber-100 text-amber-800',
    success: 'border-emerald-300 bg-emerald-100 text-emerald-700',
    error: 'border-red-300 bg-red-100 text-red-700'
  };

  return <div className={`rounded-xl border px-3 py-2 text-sm ${styles[type]}`}>{children}</div>;
}
