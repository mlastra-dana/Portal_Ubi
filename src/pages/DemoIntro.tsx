import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

export default function DemoIntro() {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-10 md:px-6">
      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Entrar a demo</p>
        <h1 className="mb-3 text-2xl font-bold text-textMain md:text-3xl">Esta demo validara onboarding comercial de punta a punta</h1>
        <ul className="mb-6 list-disc space-y-2 pl-5 text-sm text-gray-700">
          <li>Documentos obligatorios segun tipo de solicitante.</li>
          <li>Fotos de fachada, interior e inventario capturadas en vivo.</li>
          <li>Prueba de vida con selfie en el momento y gesto guiado.</li>
          <li>Resultados claros por cada evidencia: Validado, Revisar o Rechazado.</li>
        </ul>
        <p className="mb-6 rounded-lg bg-bgSoft p-3 text-sm text-gray-600">La demo toma entre 2 y 4 minutos y puedes completarla desde movil o desktop.</p>
        <Link to="/onboarding">
          <Button>Iniciar validacion</Button>
        </Link>
      </Card>
    </main>
  );
}
