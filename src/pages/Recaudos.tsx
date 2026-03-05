import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertBanner } from '../components/AlertBanner';
import { CommerceImages } from '../components/CommerceImages';
import { DocumentSlot } from '../components/DocumentSlot';
import { SelfieProof } from '../components/SelfieProof';
import { PrimaryButton } from '../components/ui/PrimaryButton';
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
  const [searchParams] = useSearchParams();
  const moduleType: ModuleType = searchParams.get('tipo') === 'juridica' ? 'juridica' : 'natural';

  const [naturalCedula, setNaturalCedula] = useState<UploadedDocumentResult[]>([]);
  const [naturalRif, setNaturalRif] = useState<UploadedDocumentResult[]>([]);
  const [naturalImages, setNaturalImages] = useState<CommerceImageItem[]>([]);
  const [naturalSelfie, setNaturalSelfie] = useState<boolean>(false);
  const [naturalStep, setNaturalStep] = useState<1 | 2>(1);

  const [juridicaRepresentantes, setJuridicaRepresentantes] = useState<UploadedDocumentResult[]>([]);
  const [juridicaRif, setJuridicaRif] = useState<UploadedDocumentResult[]>([]);
  const [juridicaActa, setJuridicaActa] = useState<UploadedDocumentResult[]>([]);
  const [juridicaRegistro, setJuridicaRegistro] = useState<UploadedDocumentResult[]>([]);
  const [juridicaImages, setJuridicaImages] = useState<CommerceImageItem[]>([]);
  const [juridicaSelfie, setJuridicaSelfie] = useState<boolean>(false);
  const [juridicaStep, setJuridicaStep] = useState<1 | 2>(1);

  const naturalStep1Ready = useMemo(() => hasUploaded(naturalCedula) && hasUploaded(naturalRif) && naturalSelfie, [naturalCedula, naturalRif, naturalSelfie]);

  const juridicaStep1Ready = useMemo(
    () =>
      hasUploaded(juridicaRepresentantes) &&
      hasUploaded(juridicaRif) &&
      hasUploaded(juridicaActa) &&
      hasUploaded(juridicaRegistro) &&
      juridicaSelfie,
    [juridicaActa, juridicaRegistro, juridicaRepresentantes, juridicaRif, juridicaSelfie]
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 md:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Onboarding Recaudos</h1>
        <p className="text-blue-100">Carga tus documentos y fotos para continuar.</p>
      </header>

      {moduleType === 'natural' ? (
        <section className="space-y-4">
          <AlertBanner type="info">Persona Natural: cédula, RIF y tres fotos del comercio.</AlertBanner>

          <section className="rounded-xl border border-ubii-border bg-white p-4 shadow-soft">
            <p className="text-sm font-semibold text-ubii-black">Paso {naturalStep} de 2</p>
            <p className="text-xs text-gray-600">{naturalStep === 1 ? 'Identificación' : 'Imágenes del comercio'}</p>
          </section>

          <div className={naturalStep === 1 ? 'space-y-4' : 'hidden'}>
            <div className="grid gap-4 md:grid-cols-2">
              <DocumentSlot label="Cedula de Identidad" required docKind="CEDULA" onChange={setNaturalCedula} />
              <DocumentSlot label="RIF" required docKind="RIF" onChange={setNaturalRif} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <OcrAutofillCard title="Datos detectados · Cédula" item={naturalCedula[0]} />
              <OcrAutofillCard title="Datos detectados · RIF" item={naturalRif[0]} />
            </div>

            <SelfieProof label="Prueba de vida (selfie)" onChange={(payload) => setNaturalSelfie(Boolean(payload?.file))} />

            <PrimaryButton onClick={() => setNaturalStep(2)} disabled={!naturalStep1Ready}>
              Continuar al Paso 2
            </PrimaryButton>
          </div>

          <div className={naturalStep === 2 ? 'space-y-4' : 'hidden'}>
            <CommerceImages onChange={setNaturalImages} />
            <div className="flex gap-2">
              <PrimaryButton onClick={() => setNaturalStep(1)}>Volver al Paso 1</PrimaryButton>
              <PrimaryButton disabled={!isImagesComplete(naturalImages)}>Finalizar módulo</PrimaryButton>
            </div>
          </div>
        </section>
      ) : null}

      {moduleType === 'juridica' ? (
        <section className="space-y-4">
          <AlertBanner type="info">Persona Jurídica: representantes, RIF, acta, registro y fotos del comercio.</AlertBanner>

          <section className="rounded-xl border border-ubii-border bg-white p-4 shadow-soft">
            <p className="text-sm font-semibold text-ubii-black">Paso {juridicaStep} de 2</p>
            <p className="text-xs text-gray-600">{juridicaStep === 1 ? 'Identificación' : 'Imágenes del comercio'}</p>
          </section>

          <div className={juridicaStep === 1 ? 'space-y-4' : 'hidden'}>
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
              <OcrAutofillCard title="Datos detectados · Representante (1ro)" item={juridicaRepresentantes[0]} />
              <OcrAutofillCard title="Datos detectados · RIF Comercio" item={juridicaRif[0]} />
            </div>

            <SelfieProof label="Prueba de vida (selfie del representante)" onChange={(payload) => setJuridicaSelfie(Boolean(payload?.file))} />

            <PrimaryButton onClick={() => setJuridicaStep(2)} disabled={!juridicaStep1Ready}>
              Continuar al Paso 2
            </PrimaryButton>
          </div>

          <div className={juridicaStep === 2 ? 'space-y-4' : 'hidden'}>
            <CommerceImages onChange={setJuridicaImages} />
            <div className="flex gap-2">
              <PrimaryButton onClick={() => setJuridicaStep(1)}>Volver al Paso 1</PrimaryButton>
              <PrimaryButton disabled={!isImagesComplete(juridicaImages)}>Finalizar módulo</PrimaryButton>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
