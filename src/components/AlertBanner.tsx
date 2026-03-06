import type { PropsWithChildren } from 'react';

export function AlertBanner({ type, children }: PropsWithChildren<{ type: 'info' | 'warning' | 'success' | 'error' }>) {
  const styles = {
    info: 'border-white/40 bg-white/10 text-white',
    warning: 'border-amber-300 bg-amber-100 text-amber-800',
    success: 'border-emerald-300 bg-emerald-100 text-emerald-700',
    error: 'border-red-300 bg-red-100 text-red-700'
  };

  const icon = {
    info: 'i',
    warning: '!',
    success: '✓',
    error: '✕'
  }[type];

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${styles[type]}`}>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-bold">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
