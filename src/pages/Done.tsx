import { Link, useLocation } from 'react-router-dom';
import { AlertBanner } from '../components/AlertBanner';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import type { OnboardingSummary } from '../types/onboarding';

type DoneState = {
  summary?: OnboardingSummary;
  expediente?: {
    registro: string;
    modulo: string;
    recibidoEn: string;
    identificacion: Record<string, string>;
    documentos: Array<{ nombre: string; estado: string; detalle: string }>;
    imagenes: Array<{ tipo: string; descripcion: string; coincidencia: number; iaGenerada: number; warnings: string[] }>;
  };
};

export default function Done() {
  const location = useLocation();
  const state = (location.state as DoneState | null) ?? null;
  const expediente = state?.expediente;

  if (!state) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-ubii-blue">No hay resultados para mostrar</h1>
          <Link to="/demo" className="mt-4 inline-flex">
            <PrimaryButton>Ir al demo</PrimaryButton>
          </Link>
        </section>
      </main>
    );
  }

  if (expediente) {
    const docsTotal = expediente.documentos.length;
    const docsValid = expediente.documentos.filter((doc) => ['VALIDADO', 'VALIDO'].includes(doc.estado.toUpperCase())).length;
    const docsObservados = docsTotal - docsValid;

    const imgsTotal = expediente.imagenes.length;
    const imgsBuenaCoincidencia = expediente.imagenes.filter((img) => img.coincidencia >= 70).length;
    const imgsConAdvertencias = expediente.imagenes.filter((img) => img.warnings.length > 0).length;

    const allWarnings = expediente.imagenes.flatMap((img) => img.warnings);
    const uniqueWarnings = Array.from(new Set(allWarnings)).slice(0, 3);
    const extraWarnings = allWarnings.length - uniqueWarnings.length;

    const recibidoEn = new Date(expediente.recibidoEn);
    const recibidoTexto = Number.isNaN(recibidoEn.getTime())
      ? expediente.recibidoEn
      : recibidoEn.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' });

    return (
      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-10 md:px-6">
        <section className="rounded-xl border border-emerald-300 bg-emerald-100 p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-emerald-800 md:text-3xl">Expediente recibido</h1>
          <p className="mt-2 text-emerald-800">
            Registro: <span className="font-semibold">{expediente.registro}</span>
          </p>
          <p className="text-emerald-800">Módulo: {expediente.modulo}</p>
          <p className="text-emerald-800">Recibido: {recibidoTexto}</p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ubii-blue">Resumen clave</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-ubii-light p-4 text-sm text-ubii-black">
              <p className="text-xs uppercase text-gray-600">Documentos</p>
              <p className="text-lg font-semibold text-ubii-blue">
                {docsValid}/{docsTotal} validados
              </p>
              {docsObservados > 0 ? <p className="text-amber-700 text-sm">{docsObservados} pendientes/observados</p> : <p className="text-emerald-700">Sin pendientes</p>}
            </div>
            <div className="rounded-xl border border-gray-200 bg-ubii-light p-4 text-sm text-ubii-black">
              <p className="text-xs uppercase text-gray-600">Imágenes</p>
              <p className="text-lg font-semibold text-ubii-blue">
                {imgsBuenaCoincidencia}/{imgsTotal} con coincidencia ≥70%
              </p>
              {imgsConAdvertencias > 0 ? <p className="text-amber-700 text-sm">{imgsConAdvertencias} con advertencias</p> : <p className="text-emerald-700">Sin advertencias</p>}
            </div>
            <div className="rounded-xl border border-gray-200 bg-ubii-light p-4 text-sm text-ubii-black">
              <p className="text-xs uppercase text-gray-600">Identificación</p>
              <p className="text-lg font-semibold text-ubii-blue">{Object.values(expediente.identificacion).some(Boolean) ? 'Datos capturados' : 'Datos incompletos'}</p>
              <p className="text-gray-700">{expediente.identificacion?.nombres ?? expediente.identificacion?.razonSocial ?? 'Datos básicos registrados'}</p>
            </div>
          </div>

          {uniqueWarnings.length ? (
            <div className="mt-4 space-y-2">
              {uniqueWarnings.map((warning) => (
                <AlertBanner key={warning} type="warning">
                  {warning}
                </AlertBanner>
              ))}
              {extraWarnings > 0 ? <p className="text-xs text-gray-600">… y {extraWarnings} advertencias más.</p> : null}
            </div>
          ) : (
            <AlertBanner type="success">No se registran advertencias adicionales.</AlertBanner>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ubii-blue">Identificación</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {Object.entries(expediente.identificacion).map(([key, value]) => {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
              return (
                <div key={key} className="rounded-xl border border-gray-200 bg-ubii-light p-3 text-sm text-ubii-black">
                  <p className="font-semibold">{label}</p>
                  <p className="text-gray-800">{value || 'NO REGISTRADO'}</p>
                </div>
              );
            })}
          </div>
        </section>

        <Link to="/demo" className="inline-flex">
          <PrimaryButton>Nuevo registro</PrimaryButton>
        </Link>
      </main>
    );
  }

  const ocrItems = [state.summary?.ocr.cedula, state.summary?.ocr.rif].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-10 md:px-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-bold text-ubii-blue md:text-3xl">Solicitud enviada para revision</h1>
        <p className="mt-2 text-gray-600">Resumen de documentos y fotos cargadas.</p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-ubii-blue">Resultado de documentos</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {ocrItems.map((item) => (
            <div key={item?.docType} className="rounded-xl border border-gray-200 bg-ubii-light p-3 text-sm text-ubii-black">
              <p className="font-semibold uppercase">{item?.docType}</p>
              <p>Nivel de lectura: {item?.confidence}%</p>
              <p>Vigencia: {item?.expiryStatus}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-ubii-blue">Probabilidades de imagenes</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {state.summary?.imageAnalysis.map((analysis) => (
            <div key={analysis.kind} className="rounded-xl border border-gray-200 bg-ubii-light p-3 text-sm text-ubii-black">
              <p className="font-semibold capitalize">{analysis.kind}</p>
              <p>Coincidencia: {analysis.expectedTypeProbability}%</p>
              <p>IA-generada: {analysis.aiGeneratedProbability}%</p>
            </div>
          ))}
        </div>
      </section>

      {state.summary?.warnings.length ? (
        <section className="space-y-2">
          {state.summary.warnings.map((warning) => (
            <AlertBanner type="warning" key={warning}>
              {warning}
            </AlertBanner>
          ))}
        </section>
      ) : (
        <AlertBanner type="success">No hay alertas relevantes en esta corrida de demo.</AlertBanner>
      )}
    </main>
  );
}
