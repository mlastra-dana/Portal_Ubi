import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <main className="bg-[radial-gradient(circle_at_top,#153253,#070b12_58%)]">
      <section className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-content items-center px-4 py-12 md:px-6">
        <div className="max-w-3xl">
          <p className="mb-3 inline-flex rounded-full border border-blue-300/40 bg-blue-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-100">
            Demo Fintech
          </p>
          <h1 className="text-4xl font-bold text-white md:text-6xl">Onboarding Post UBPAY</h1>
          <p className="mt-4 text-lg text-slate-200 md:text-2xl">Validacion asistida (OCR + analisis de imagenes)</p>
          <Link
            to="/demo"
            className="mt-8 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primaryDark"
          >
            Iniciar demo
          </Link>
        </div>
      </section>
    </main>
  );
}
