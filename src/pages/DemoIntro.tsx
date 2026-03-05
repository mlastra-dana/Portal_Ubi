import { Link } from 'react-router-dom';

export default function DemoIntro() {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-10 md:px-6">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 shadow-soft">
        <h1 className="text-2xl font-bold text-white md:text-3xl">Demo de validacion en 2 pasos</h1>
        <ul className="mt-5 list-disc space-y-2 pl-6 text-slate-200">
          <li>Paso 1: OCR de Cedula y RIF para autollenar datos.</li>
          <li>Paso 2: IA describe imagenes + probabilidad + posible IA-generada.</li>
        </ul>
        <Link
          to="/onboarding"
          className="mt-7 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primaryDark"
        >
          Comenzar
        </Link>
      </section>
    </main>
  );
}
