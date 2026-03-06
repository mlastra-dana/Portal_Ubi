import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertBanner } from '../components/AlertBanner';
import { CommerceImages } from '../components/CommerceImages';
import { DocumentSlot } from '../components/DocumentSlot';
import { SelfieProof } from '../components/SelfieProof';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { extractCedulaAutofill, extractRifAutofill } from '../services/ocr/autofillExtraction';
import type { CommerceImageItem, UploadedDocumentResult } from '../types/recaudos';

type ModuleType = 'natural' | 'juridica';

const isImagesComplete = (items: CommerceImageItem[]): boolean => items.length === 3 && items.every((item) => Boolean(item.file));
const hasUploaded = (items: UploadedDocumentResult[]): boolean => items.length > 0;
const splitFullName = (value: string): { nombres: string; apellidos: string } => {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) return { nombres: '', apellidos: '' };
  const parts = clean.split(' ');
  if (parts.length === 1) return { nombres: parts[0], apellidos: '' };
  if (parts.length === 2) return { nombres: parts[0], apellidos: parts[1] };
  return { nombres: parts.slice(0, 2).join(' '), apellidos: parts.slice(2).join(' ') };
};

export default function Recaudos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const moduleType: ModuleType = searchParams.get('tipo') === 'juridica' ? 'juridica' : 'natural';

  const [naturalCedula, setNaturalCedula] = useState<UploadedDocumentResult[]>([]);
  const [naturalRif, setNaturalRif] = useState<UploadedDocumentResult[]>([]);
  const [naturalImages, setNaturalImages] = useState<CommerceImageItem[]>([]);
  const [naturalSelfie, setNaturalSelfie] = useState<boolean>(false);
  const [naturalStep, setNaturalStep] = useState<1 | 2>(1);
  const [naturalNombres, setNaturalNombres] = useState('');
  const [naturalApellidos, setNaturalApellidos] = useState('');
  const [naturalCedulaId, setNaturalCedulaId] = useState('');
  const [naturalTelefono, setNaturalTelefono] = useState('');
  const [naturalCorreo, setNaturalCorreo] = useState('');

  const [juridicaRepresentantes, setJuridicaRepresentantes] = useState<UploadedDocumentResult[]>([]);
  const [juridicaRif, setJuridicaRif] = useState<UploadedDocumentResult[]>([]);
  const [juridicaActaRegistro, setJuridicaActaRegistro] = useState<UploadedDocumentResult[]>([]);
  const [juridicaImages, setJuridicaImages] = useState<CommerceImageItem[]>([]);
  const [juridicaSelfie, setJuridicaSelfie] = useState<boolean>(false);
  const [juridicaStep, setJuridicaStep] = useState<1 | 2>(1);
  const [juridicaRazonSocial, setJuridicaRazonSocial] = useState('');
  const [juridicaRifEmpresa, setJuridicaRifEmpresa] = useState('');
  const [repNombres, setRepNombres] = useState('');
  const [repApellidos, setRepApellidos] = useState('');
  const [repCedula, setRepCedula] = useState('');
  const [repTelefono, setRepTelefono] = useState('');
  const [repCorreo, setRepCorreo] = useState('');

  useEffect(() => {
    const cedula = naturalCedula[0];
    if (!cedula) return;
    const extracted = extractCedulaAutofill(cedula.rawText ?? '');
    const nameSource = extracted.nombres && extracted.apellidos ? `${extracted.nombres} ${extracted.apellidos}` : cedula.fields.nombres ?? '';
    const { nombres, apellidos } = splitFullName(nameSource);
    if (nombres) setNaturalNombres(nombres);
    if (apellidos) setNaturalApellidos(apellidos);
    const cedulaNumero = extracted.cedula ?? cedula.fields.numeroId;
    if (cedulaNumero) setNaturalCedulaId(cedulaNumero);
  }, [naturalCedula]);

  useEffect(() => {
    const rif = naturalRif[0];
    if (!rif) return;
    if (!naturalNombres.trim()) {
      const nameSource = rif.fields.nombres ?? '';
      const split = splitFullName(nameSource);
      if (split.nombres) setNaturalNombres(split.nombres);
      if (split.apellidos) setNaturalApellidos(split.apellidos);
    }
  }, [naturalRif, naturalNombres]);

  useEffect(() => {
    const rif = juridicaRif[0];
    if (!rif) return;
    const extracted = extractRifAutofill(rif.rawText ?? '');
    const razonSocial = extracted.razonSocial ?? rif.fields.nombres ?? '';
    if (razonSocial) setJuridicaRazonSocial(razonSocial);
    const rifNumero = extracted.rif ?? rif.fields.numeroId;
    if (rifNumero) setJuridicaRifEmpresa(rifNumero);
  }, [juridicaRif]);

  useEffect(() => {
    const rep = juridicaRepresentantes[0];
    if (!rep) return;
    const extracted = extractCedulaAutofill(rep.rawText ?? '');
    const nameSource = extracted.nombres && extracted.apellidos ? `${extracted.nombres} ${extracted.apellidos}` : rep.fields.nombres ?? '';
    const { nombres, apellidos } = splitFullName(nameSource);
    if (nombres) setRepNombres(nombres);
    if (apellidos) setRepApellidos(apellidos);
    const cedulaNumero = extracted.cedula ?? rep.fields.numeroId;
    if (cedulaNumero) setRepCedula(cedulaNumero);
  }, [juridicaRepresentantes]);

  const naturalDataReady = useMemo(
    () => Boolean(naturalNombres.trim() && naturalApellidos.trim() && naturalCedulaId.trim() && naturalTelefono.trim() && naturalCorreo.trim()),
    [naturalApellidos, naturalCedulaId, naturalCorreo, naturalNombres, naturalTelefono]
  );

  const naturalStep1Ready = useMemo(
    () => hasUploaded(naturalCedula) && hasUploaded(naturalRif) && naturalSelfie && naturalDataReady,
    [naturalCedula, naturalDataReady, naturalRif, naturalSelfie]
  );

  const juridicaDataReady = useMemo(
    () =>
      Boolean(
        juridicaRazonSocial.trim() &&
          juridicaRifEmpresa.trim() &&
          repNombres.trim() &&
          repApellidos.trim() &&
          repCedula.trim() &&
          repTelefono.trim() &&
          repCorreo.trim()
      ),
    [juridicaRazonSocial, juridicaRifEmpresa, repApellidos, repCedula, repCorreo, repNombres, repTelefono]
  );

  const juridicaStep1Ready = useMemo(
    () =>
      hasUploaded(juridicaRepresentantes) &&
      hasUploaded(juridicaRif) &&
      juridicaActaRegistro.some((item) => item.validationStatus === 'VALIDO') &&
      juridicaSelfie &&
      juridicaDataReady,
    [juridicaActaRegistro, juridicaDataReady, juridicaRepresentantes, juridicaRif, juridicaSelfie]
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
              <section className="rounded-xl border border-ubii-border bg-white p-6 shadow-soft md:col-span-2">
                <h3 className="text-lg font-semibold text-ubii-blue">Identificación</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <label className="text-sm font-medium text-ubii-black">
                    Nombres
                    <input
                      value={naturalNombres}
                      onChange={(event) => setNaturalNombres(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Apellidos
                    <input
                      value={naturalApellidos}
                      onChange={(event) => setNaturalApellidos(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Cédula de identidad
                    <input
                      value={naturalCedulaId}
                      onChange={(event) => setNaturalCedulaId(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Número de teléfono
                    <input
                      value={naturalTelefono}
                      onChange={(event) => setNaturalTelefono(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Correo
                    <input
                      type="email"
                      value={naturalCorreo}
                      onChange={(event) => setNaturalCorreo(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                </div>
              </section>
            </div>

            <SelfieProof label="Prueba de vida (selfie)" onChange={(payload) => setNaturalSelfie(Boolean(payload?.file))} />

            <div className="flex gap-2">
              <PrimaryButton onClick={() => navigate('/demo')}>Volver</PrimaryButton>
              <PrimaryButton onClick={() => setNaturalStep(2)} disabled={!naturalStep1Ready}>
                Continuar al Paso 2
              </PrimaryButton>
            </div>
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
          <AlertBanner type="info">Persona Jurídica: representantes, RIF, acta/registro y fotos del comercio.</AlertBanner>

          <section className="rounded-xl border border-ubii-border bg-white p-4 shadow-soft">
            <p className="text-sm font-semibold text-ubii-black">Paso {juridicaStep} de 2</p>
            <p className="text-xs text-gray-600">{juridicaStep === 1 ? 'Identificación' : 'Imágenes del comercio'}</p>
          </section>

          <div className={juridicaStep === 1 ? 'space-y-4' : 'hidden'}>
            <div className="grid gap-4 xl:grid-cols-3">
              <DocumentSlot label="RIF" required docKind="RIF" onChange={setJuridicaRif} />

              <DocumentSlot label="Registro mercantil" required docKind="ACTA_REGISTRO" onChange={setJuridicaActaRegistro} />

              <section className="space-y-4 rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-ubii-black">Representantes legales</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hasUploaded(juridicaRepresentantes) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                    {hasUploaded(juridicaRepresentantes) ? 'Cargado' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Cargue la cédula del representante principal.</p>

                <div className="border-t border-ubii-border pt-4">
                  <DocumentSlot
                    label="Cédula del Representante (Obligatorio)"
                    required
                    docKind="CEDULA_REPRESENTANTE"
                    onChange={setJuridicaRepresentantes}
                  />
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
                <h3 className="text-lg font-semibold text-ubii-blue">Datos de la empresa</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-ubii-black">
                    Razón social
                    <input
                      value={juridicaRazonSocial}
                      onChange={(event) => setJuridicaRazonSocial(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    RIF de la empresa
                    <input
                      value={juridicaRifEmpresa}
                      onChange={(event) => setJuridicaRifEmpresa(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
                <h3 className="text-lg font-semibold text-ubii-blue">Datos del representante legal</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-ubii-black">
                    Nombres
                    <input
                      value={repNombres}
                      onChange={(event) => setRepNombres(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Apellidos
                    <input
                      value={repApellidos}
                      onChange={(event) => setRepApellidos(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Cédula de identidad
                    <input
                      value={repCedula}
                      onChange={(event) => setRepCedula(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Número de teléfono
                    <input
                      value={repTelefono}
                      onChange={(event) => setRepTelefono(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Correo
                    <input
                      type="email"
                      value={repCorreo}
                      onChange={(event) => setRepCorreo(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
                    />
                  </label>
                </div>
              </section>
            </div>

            <SelfieProof label="Prueba de vida (selfie del representante)" onChange={(payload) => setJuridicaSelfie(Boolean(payload?.file))} />

            <div className="flex gap-2">
              <PrimaryButton onClick={() => navigate('/demo')}>Volver</PrimaryButton>
              <PrimaryButton onClick={() => setJuridicaStep(2)} disabled={!juridicaStep1Ready}>
                Continuar al Paso 2
              </PrimaryButton>
            </div>
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
