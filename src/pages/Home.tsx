import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

const bullets = ['Comienza a cobrar en minutos', 'Atencion 24/7 para comercios', 'Dashboard de estatus de validacion', 'Flujo guiado y seguro'];
const steps = [
  { title: 'Carga documentos', desc: 'Sube cedula, RIF y acta segun tipo de solicitante.' },
  { title: 'Captura en vivo', desc: 'Toma fotos del comercio y selfie de vida desde la camara.' },
  { title: 'Valida y envia', desc: 'Ejecuta validacion IA demo y recibe tu numero de registro.' }
];

export default function Home() {
  return (
    <main>
      <section className="bg-white">
        <div className="mx-auto grid w-full max-w-content gap-8 px-4 py-14 md:grid-cols-2 md:px-6 md:py-20">
          <div>
            <p className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Portalito Ubii</p>
            <h1 className="mb-4 text-3xl font-bold text-textMain md:text-5xl">Onboarding Ubii: carga y validacion automatizada</h1>
            <p className="mb-6 text-gray-600">Portal web para onboarding de comercios con validacion inteligente de documentos, fotos y prueba de vida.</p>
            <ul className="mb-8 grid gap-2 text-sm text-gray-700">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {bullet}
                </li>
              ))}
            </ul>
            <Link to="/demo">
              <Button>Iniciar demo</Button>
            </Link>
          </div>
          <Card className="bg-gradient-to-br from-primary to-primaryDark text-white">
            <h2 className="text-2xl font-semibold">Validacion inteligente en una sola experiencia</h2>
            <p className="mt-3 text-sm text-white/90">Arquitectura preparada para backend real con modo mock por defecto y despliegue listo para AWS Amplify.</p>
          </Card>
        </div>
      </section>

      <section className="bg-bgSoft py-14">
        <div className="mx-auto w-full max-w-content px-4 md:px-6">
          <h2 className="mb-6 text-2xl font-bold text-textMain md:text-3xl">Como funciona</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, idx) => (
              <Card key={step.title}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Paso {idx + 1}</p>
                <h3 className="mb-2 text-lg font-semibold text-textMain">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.desc}</p>
              </Card>
            ))}
          </div>
          <div className="mt-8">
            <Link to="/demo">
              <Button>Comenzar flujo</Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
