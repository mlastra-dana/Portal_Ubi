import { Link, useLocation } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ReviewTable } from '../components/ReviewTable';
import type { ValidationItemResult } from '../types/onboarding';

type DoneState = {
  registrationNumber: string;
  submittedAt: string;
  summary: { name: string; category: string; result?: ValidationItemResult }[];
};

export default function Done() {
  const location = useLocation();
  const state = (location.state as DoneState | null) ?? null;

  if (!state) {
    return (
      <main className="mx-auto w-full max-w-content px-4 py-10 md:px-6">
        <Card>
          <h1 className="mb-3 text-2xl font-bold text-textMain">No hay una solicitud reciente</h1>
          <p className="mb-5 text-sm text-gray-600">Completa el onboarding para generar un numero de registro.</p>
          <Link to="/demo">
            <Button>Ir a demo</Button>
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-content space-y-6 px-4 py-10 md:px-6">
      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Solicitud enviada</p>
        <h1 className="mb-3 text-2xl font-bold text-textMain md:text-3xl">Registro completado exitosamente</h1>
        <p className="text-sm text-gray-700">
          Numero de registro: <span className="font-semibold text-primary">{state.registrationNumber}</span>
        </p>
        <p className="mt-1 text-xs text-gray-500">Fecha: {new Date(state.submittedAt).toLocaleString()}</p>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-textMain">Resumen de validacion</h2>
        <ReviewTable items={state.summary} />
      </Card>

      <Link to="/">
        <Button variant="outline">Volver al inicio</Button>
      </Link>
    </main>
  );
}
