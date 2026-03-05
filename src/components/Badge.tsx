import type { ValidationBadge } from '../types/onboarding';

const mapStyle: Record<ValidationBadge, string> = {
  pendiente: 'bg-gray-100 text-gray-700',
  validado: 'bg-emerald-100 text-emerald-700',
  revisar: 'bg-amber-100 text-amber-700',
  rechazado: 'bg-rose-100 text-rose-700'
};

const mapLabel: Record<ValidationBadge, string> = {
  pendiente: 'Pendiente',
  validado: 'Validado',
  revisar: 'Revisar',
  rechazado: 'Rechazado'
};

export function Badge({ status }: { status: ValidationBadge }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${mapStyle[status]}`}>{mapLabel[status]}</span>;
}
