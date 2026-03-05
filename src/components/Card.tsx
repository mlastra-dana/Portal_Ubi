import type { PropsWithChildren } from 'react';

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`rounded-xl border border-borderSoft bg-white p-5 shadow-soft ${className}`}>{children}</section>;
}
