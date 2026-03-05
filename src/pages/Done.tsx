import { Link, useLocation } from 'react-router-dom';
import { AlertBanner } from '../components/AlertBanner';
import type { OnboardingSummary } from '../types/onboarding';

type DoneState = {
  summary: OnboardingSummary;
};

export default function Done() {
  const location = useLocation();
  const state = (location.state as DoneState | null) ?? null;

  if (!state) {
    return (
      <main className="mx-auto w-full max-w-content px-4 py-10 md:px-6">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
          <h1 className="text-2xl font-bold text-white">No hay resultados para mostrar</h1>
          <Link to="/demo" className="mt-4 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white">
            Ir al demo
          </Link>
        </section>
      </main>
    );
  }

  const ocrItems = [state.summary.ocr.cedula, state.summary.ocr.rif].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-content space-y-5 px-4 py-10 md:px-6">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
        <h1 className="text-2xl font-bold text-white md:text-3xl">Solicitud enviada para revision</h1>
        <p className="mt-2 text-slate-300">Resumen consolidado de OCR y analisis de imagenes.</p>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">OCR confidence</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {ocrItems.map((item) => (
            <div key={item?.docType} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-100">
              <p className="font-semibold uppercase">{item?.docType}</p>
              <p>Confianza: {item?.confidence}%</p>
              <p>Vigencia: {item?.expiryStatus}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Probabilidades de imagenes</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {state.summary.imageAnalysis.map((analysis) => (
            <div key={analysis.kind} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-100">
              <p className="font-semibold capitalize">{analysis.kind}</p>
              <p>Coincidencia: {analysis.expectedTypeProbability}%</p>
              <p>IA-generada: {analysis.aiGeneratedProbability}%</p>
            </div>
          ))}
        </div>
      </section>

      {state.summary.warnings.length > 0 ? (
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
