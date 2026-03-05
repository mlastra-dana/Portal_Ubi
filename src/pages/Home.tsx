import { Link } from 'react-router-dom';
import { PrimaryButton } from '../components/ui/PrimaryButton';

export default function Home() {
  return (
    <main>
      <section className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
        <div className="overflow-hidden rounded-xl border border-ubii-border bg-white shadow-soft">
          <div className="grid md:grid-cols-2">
            <div className="bg-ubii-blue/95 p-6">
              <img src="/ubii-pos-hero.svg" alt="Terminal Ubii" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col justify-center p-6 md:p-10">
              <p className="mb-3 inline-flex w-fit rounded-full border border-ubii-blue/30 bg-ubii-blue/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ubii-blue">
                Demo Fintech
              </p>
              <h1 className="text-4xl font-bold text-ubii-blue md:text-5xl">Onboarding POS UBIAPP</h1>
              <p className="mt-3 text-lg text-ubii-black">Validacion asistida (OCR + analisis de imagenes)</p>
              <ul className="mt-5 space-y-2 text-sm text-gray-600">
                <li>Autocompletado con OCR de Cedula y RIF</li>
                <li>Analisis visual de Fachada, Interior e Inventario</li>
                <li>Revision manual del analista en el mismo flujo</li>
              </ul>
              <Link to="/demo" className="mt-7 inline-flex">
                <PrimaryButton>Iniciar demo</PrimaryButton>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
