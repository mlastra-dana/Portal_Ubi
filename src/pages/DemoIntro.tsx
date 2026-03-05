import { Link } from 'react-router-dom';
import { PrimaryButton } from '../components/ui/PrimaryButton';

export default function DemoIntro() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
      <section className="rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-bold text-ubii-blue md:text-3xl">Demo de validacion en 2 pasos</h1>
        <ul className="mt-5 list-disc space-y-2 pl-6 text-gray-600">
          <li>Modulo Persona Natural: cedula, RIF e imagenes del comercio.</li>
          <li>Modulo Persona Juridica: representantes, RIF, acta, registro e imagenes.</li>
        </ul>
        <Link to="/recaudos" className="mt-7 inline-flex">
          <PrimaryButton>Comenzar</PrimaryButton>
        </Link>
      </section>
    </main>
  );
}
