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

    const imgsTotal = expediente.imagenes.length;
    const imgsBuenaCoincidencia = expediente.imagenes.filter((img) => img.coincidencia >= 70).length;

    const allWarnings = expediente.imagenes.flatMap((img) => img.warnings);
    const uniqueWarnings = Array.from(new Set(allWarnings)).slice(0, 3);

    const recibidoEn = new Date(expediente.recibidoEn);
    const recibidoTexto = Number.isNaN(recibidoEn.getTime())
      ? expediente.recibidoEn
      : recibidoEn.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' });

    const identificacionRows = Object.entries(expediente.identificacion).map(([key, value]) => ({
      key,
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      value: value || 'NO REGISTRADO'
    }));

    const summaryRows = [
      `${docsValid} documentos validados`,
      `${imgsBuenaCoincidencia} imágenes verificadas`,
      Object.values(expediente.identificacion).some(Boolean) ? 'Datos del solicitante capturados' : 'Datos del solicitante registrados'
    ];

    const handleDownloadReceipt = () => {
      const lines = [
        'Comprobante de expediente',
        '',
        `Registro: ${expediente.registro}`,
        `Módulo: ${expediente.modulo}`,
        `Fecha y hora: ${recibidoTexto}`,
        '',
        'Resumen',
        `- Documentos validados: ${docsValid}/${docsTotal}`,
        `- Imágenes verificadas: ${imgsBuenaCoincidencia}/${imgsTotal}`,
        '',
        'Datos del solicitante'
      ];
      identificacionRows.forEach((row) => lines.push(`- ${row.label}: ${row.value}`));
      if (uniqueWarnings.length) {
        lines.push('', 'Observaciones');
        uniqueWarnings.forEach((warning) => lines.push(`- ${warning}`));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${expediente.registro}-comprobante.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    };

    return (
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 md:px-6">
        <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-soft md:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">✔</span>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-[#111111] md:text-3xl">Expediente registrado exitosamente</h1>
              <p className="text-4xl font-bold tracking-tight text-[#111111]">{expediente.registro}</p>
              <p className="text-sm text-gray-600">{recibidoTexto}</p>
              <p className="text-sm text-gray-600">Módulo: {expediente.modulo}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-[#111111]">Resumen del expediente</h2>
          <div className="mt-4 space-y-3">
            {summaryRows.map((row) => (
              <div key={row} className="flex items-center gap-3 text-sm text-[#111111]">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✔</span>
                <span>{row}</span>
              </div>
            ))}
          </div>
        </section>

        {uniqueWarnings.length ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-amber-900">⚠ Observaciones detectadas</h2>
            <ul className="mt-3 space-y-2 text-sm text-amber-900">
              {uniqueWarnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-700" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-[#111111]">Datos del solicitante</h2>
          <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-[#F5F9FD]">
            {identificacionRows.map((row) => (
              <div key={row.key} className="grid gap-1 px-4 py-3 md:grid-cols-[220px,1fr] md:items-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{row.label}</p>
                <p className="text-sm font-medium text-[#111111]">{row.value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <PrimaryButton className="!border-[#4B98CB] !bg-[#4B98CB] hover:!border-[#3E86B6] hover:!bg-[#3E86B6]" onClick={handleDownloadReceipt}>
            Descargar comprobante
          </PrimaryButton>
          <Link to="/demo" className="inline-flex">
            <PrimaryButton className="!border-gray-300 !bg-white !text-[#111111] hover:!border-[#4B98CB]">Registrar otro expediente</PrimaryButton>
          </Link>
        </div>
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
