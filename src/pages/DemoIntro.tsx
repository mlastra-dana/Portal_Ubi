import { Link } from 'react-router-dom';

export default function DemoIntro() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
      <section className="rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-bold text-ubii-blue md:text-3xl">Demo de registro en 2 pasos</h1>
        <ul className="mt-5 list-disc space-y-2 pl-6 text-gray-600">
          <li>Persona Natural: cédula, RIF y fotos del comercio.</li>
          <li>Persona Jurídica: representantes, RIF, acta, registro y fotos del comercio.</li>
        </ul>
        <div className="mt-7 grid gap-3 md:grid-cols-2">
          <Link
            to="/recaudos?tipo=natural"
            className="inline-flex items-center justify-center rounded-lg border border-ubii-blue bg-ubii-blue px-5 py-2.5 text-sm font-semibold text-white"
          >
            Persona Natural
          </Link>
          <Link
            to="/recaudos?tipo=juridica"
            className="inline-flex items-center justify-center rounded-lg border border-ubii-blue bg-ubii-blue px-5 py-2.5 text-sm font-semibold text-white"
          >
            Persona Jurídica
          </Link>
        </div>
      </section>
    </main>
  );
}
