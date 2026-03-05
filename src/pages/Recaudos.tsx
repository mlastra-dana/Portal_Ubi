import { useMemo, useState } from 'react';
import { AlertBanner } from '../components/AlertBanner';
import { CommerceImages } from '../components/CommerceImages';
import { DocumentSlot } from '../components/DocumentSlot';
import type { CommerceImageItem, UploadedDocumentResult } from '../types/recaudos';

type ModuleType = 'natural' | 'juridica';

const isImagesComplete = (items: CommerceImageItem[]): boolean => items.length === 3 && items.every((item) => Boolean(item.file));
const hasUploaded = (items: UploadedDocumentResult[]): boolean => items.length > 0;

function OcrAutofillCard({ title, item }: { title: string; item?: UploadedDocumentResult }) {
  return (
    <section className="rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-ubii-blue">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-ubii-black">
        <p>
          <span className="font-semibold">Nombres:</span> {item?.fields.nombres ?? 'NO DETECTADO'}
        </p>
        <p>
          <span className="font-semibold">Numero de identificacion:</span> {item?.fields.numeroId ?? 'NO DETECTADO'}
        </p>
        <p>
          <span className="font-semibold">Fecha de vencimiento:</span> {item?.fields.fechaVencimiento ?? 'NO DETECTADO'}
        </p>
      </div>
    </section>
  );
}

export default function Recaudos() {
  const [moduleType, setModuleType] = useState<ModuleType>('natural');

  const [naturalCedula, setNaturalCedula] = useState<UploadedDocumentResult[]>([]);
  const [naturalRif, setNaturalRif] = useState<UploadedDocumentResult[]>([]);
  const [naturalImages, setNaturalImages] = useState<CommerceImageItem[]>([]);

  const [juridicaRepresentantes, setJuridicaRepresentantes] = useState<UploadedDocumentResult[]>([]);
  const [juridicaRif, setJuridicaRif] = useState<UploadedDocumentResult[]>([]);
  const [juridicaActa, setJuridicaActa] = useState<UploadedDocumentResult[]>([]);
  const [juridicaRegistro, setJuridicaRegistro] = useState<UploadedDocumentResult[]>([]);
  const [juridicaImages, setJuridicaImages] = useState<CommerceImageItem[]>([]);

  const naturalComplete = useMemo(
    () => hasUploaded(naturalCedula) && hasUploaded(naturalRif) && isImagesComplete(naturalImages),
    [naturalCedula, naturalImages, naturalRif]
  );

  const juridicaComplete = useMemo(
    () =>
      hasUploaded(juridicaRepresentantes) &&
      hasUploaded(juridicaRif) &&
      hasUploaded(juridicaActa) &&
      hasUploaded(juridicaRegistro) &&
      isImagesComplete(juridicaImages),
    [juridicaActa, juridicaImages, juridicaRegistro, juridicaRepresentantes, juridicaRif]
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 md:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Onboarding Recaudos</h1>
        <p className="text-blue-100">Carga documentos e imagenes. El OCR se ejecuta automaticamente en cada archivo.</p>
      </header>

      <section className="rounded-xl border border-ubii-border bg-white p-4 shadow-soft">
        <div className="grid gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setModuleType('natural')}
            className={`w-full rounded-lg border px-4 py-2 text-sm font-semibold ${
              moduleType === 'natural' ? 'border-ubii-blue bg-ubii-blue text-white' : 'border-ubii-border bg-white text-ubii-black'
            }`}
          >
            Persona Natural
          </button>
          <button
            type="button"
            onClick={() => setModuleType('juridica')}
            className={`w-full rounded-lg border px-4 py-2 text-sm font-semibold ${
              moduleType === 'juridica' ? 'border-ubii-blue bg-ubii-blue text-white' : 'border-ubii-border bg-white text-ubii-black'
            }`}
          >
            Persona Juridica
          </button>
        </div>
      </section>

      {moduleType === 'natural' ? (
        <section className="space-y-4">
          <AlertBanner type="info">Modulo Persona Natural: requeridos Cedula, RIF y tres imagenes del comercio.</AlertBanner>

          <div className="grid gap-4 md:grid-cols-2">
            <DocumentSlot label="Cedula de Identidad" required docKind="CEDULA" onChange={setNaturalCedula} />
            <DocumentSlot label="RIF" required docKind="RIF" onChange={setNaturalRif} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <OcrAutofillCard title="Autocompletado OCR · Cedula" item={naturalCedula[0]} />
            <OcrAutofillCard title="Autocompletado OCR · RIF" item={naturalRif[0]} />
          </div>

          <CommerceImages onChange={setNaturalImages} />

          <section className="rounded-xl border border-ubii-border bg-white p-4 shadow-soft">
            <p className="text-sm font-semibold text-ubii-black">Completitud del modulo:</p>
            <p className={`mt-2 text-lg font-bold ${naturalComplete ? 'text-emerald-700' : 'text-amber-700'}`}>
              {naturalComplete ? 'COMPLETO' : 'PENDIENTE'}
            </p>
            <p className="text-xs text-gray-600">Las advertencias (ej. cedula vencida) no bloquean el proceso.</p>
          </section>
        </section>
      ) : null}

      {moduleType === 'juridica' ? (
        <section className="space-y-4">
          <AlertBanner type="info">Modulo Persona Juridica: incluye representantes legales, RIF, acta, registro e imagenes del comercio.</AlertBanner>

          <div className="grid gap-4 md:grid-cols-2">
            <DocumentSlot
              label="Cedulas de Representantes Legales"
              required
              multiple
              docKind="CEDULA_REPRESENTANTE"
              onChange={setJuridicaRepresentantes}
            />
            <DocumentSlot label="RIF del Comercio" required docKind="RIF" onChange={setJuridicaRif} />
            <DocumentSlot label="Acta Constitutiva" required docKind="ACTA" onChange={setJuridicaActa} />
            <DocumentSlot label="Registro Mercantil" required docKind="REGISTRO" onChange={setJuridicaRegistro} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <OcrAutofillCard title="Autocompletado OCR · Representante (1ro)" item={juridicaRepresentantes[0]} />
            <OcrAutofillCard title="Autocompletado OCR · RIF Comercio" item={juridicaRif[0]} />
          </div>

          <CommerceImages onChange={setJuridicaImages} />

          <section className="rounded-xl border border-ubii-border bg-white p-4 shadow-soft">
            <p className="text-sm font-semibold text-ubii-black">Completitud del modulo:</p>
            <p className={`mt-2 text-lg font-bold ${juridicaComplete ? 'text-emerald-700' : 'text-amber-700'}`}>
              {juridicaComplete ? 'COMPLETO' : 'PENDIENTE'}
            </p>
            <p className="text-xs text-gray-600">Las advertencias (ej. cedula vencida) no bloquean el proceso.</p>
          </section>
        </section>
      ) : null}
    </main>
  );
}
