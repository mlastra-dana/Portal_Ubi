import { Link } from 'react-router-dom';

export default function DemoIntro() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center px-4 py-10 md:px-6">
      <section className="w-full rounded-2xl border border-ubii-border bg-white p-8 shadow-soft md:p-10">
        <h1 className="text-center text-3xl font-bold text-ubii-blue md:text-4xl">Selecciona el tipo de persona</h1>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Link
            to="/recaudos?tipo=natural"
            className="group inline-flex min-h-32 items-center justify-center rounded-2xl border-2 border-ubii-blue bg-ubii-blue px-6 py-8 text-center text-2xl font-semibold text-white transition-colors hover:bg-ubii-hover"
          >
            Persona Natural
          </Link>
          <div
            aria-disabled="true"
            className="inline-flex min-h-32 cursor-not-allowed items-center justify-center rounded-2xl border-2 border-gray-300 bg-gray-100 px-6 py-8 text-center text-2xl font-semibold text-gray-500"
            title="Disponible en la segunda etapa del proyecto"
          >
            Persona Jurídica (Próximamente)
          </div>
        </div>
      </section>
    </main>
  );
}
