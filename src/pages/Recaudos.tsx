import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CommerceImages } from '../components/CommerceImages';
import { DocumentSlot } from '../components/DocumentSlot';
import { SelfieProof } from '../components/SelfieProof';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { extractCedulaAutofill, extractRifAutofill } from '../services/ocr/autofillExtraction';
import type { CommerceImageItem, UploadedDocumentResult } from '../types/recaudos';

type ModuleType = 'natural' | 'juridica';

const isImagesComplete = (items: CommerceImageItem[]): boolean => items.length === 3 && items.every((item) => Boolean(item.file));
const isImagesAnalyzed = (items: CommerceImageItem[]): boolean =>
  items.length === 3 && items.every((item) => Boolean(item.file) && !item.analyzing && Boolean(item.analysis));
const hasUploaded = (items: UploadedDocumentResult[]): boolean => items.length > 0;
const buildRegistro = (): string => `EXP-${Date.now().toString().slice(-8)}`;
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
  const [naturalStep1Tried, setNaturalStep1Tried] = useState(false);
  const [naturalStep2Tried, setNaturalStep2Tried] = useState(false);

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
  const [juridicaStep1Tried, setJuridicaStep1Tried] = useState(false);
  const [juridicaStep2Tried, setJuridicaStep2Tried] = useState(false);

  useEffect(() => {
    const cedula = naturalCedula[0];
    if (!cedula) {
      setNaturalNombres('');
      setNaturalApellidos('');
      setNaturalCedulaId('');
      return;
    }
    const extracted = extractCedulaAutofill(cedula.rawText ?? '');
    const nameSource = extracted.nombres && extracted.apellidos ? `${extracted.nombres} ${extracted.apellidos}` : cedula.fields.nombres ?? '';
    const { nombres, apellidos } = splitFullName(nameSource);
    setNaturalNombres(nombres);
    setNaturalApellidos(apellidos);
    const cedulaNumero = extracted.cedula ?? cedula.fields.numeroId;
    setNaturalCedulaId(cedulaNumero ?? '');
  }, [naturalCedula]);

  useEffect(() => {
    const rif = juridicaRif[0];
    if (!rif) {
      setJuridicaRazonSocial('');
      setJuridicaRifEmpresa('');
      return;
    }
    const extracted = extractRifAutofill(rif.rawText ?? '');
    const razonSocial = extracted.razonSocial ?? rif.fields.nombres ?? '';
    setJuridicaRazonSocial(razonSocial);
    const rifNumero = extracted.rif ?? rif.fields.numeroId;
    setJuridicaRifEmpresa(rifNumero ?? '');
  }, [juridicaRif]);

  useEffect(() => {
    const rep = juridicaRepresentantes[0];
    if (!rep) {
      setRepNombres('');
      setRepApellidos('');
      setRepCedula('');
      return;
    }
    const extracted = extractCedulaAutofill(rep.rawText ?? '');
    const nameSource = extracted.nombres && extracted.apellidos ? `${extracted.nombres} ${extracted.apellidos}` : rep.fields.nombres ?? '';
    const { nombres, apellidos } = splitFullName(nameSource);
    setRepNombres(nombres);
    setRepApellidos(apellidos);
    const cedulaNumero = extracted.cedula ?? rep.fields.numeroId;
    setRepCedula(cedulaNumero ?? '');
  }, [juridicaRepresentantes]);

  const naturalDataReady = useMemo(
    () => Boolean(naturalNombres.trim() && naturalApellidos.trim() && naturalCedulaId.trim() && naturalTelefono.trim() && naturalCorreo.trim()),
    [naturalApellidos, naturalCedulaId, naturalCorreo, naturalNombres, naturalTelefono]
  );

  const naturalStep1Ready = useMemo(
    () => hasUploaded(naturalCedula) && hasUploaded(naturalRif) && naturalSelfie && naturalDataReady,
    [naturalCedula, naturalDataReady, naturalRif, naturalSelfie]
  );
  const naturalStep2Ready = useMemo(() => isImagesComplete(naturalImages) && isImagesAnalyzed(naturalImages), [naturalImages]);

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
  const juridicaStep2Ready = useMemo(() => isImagesComplete(juridicaImages) && isImagesAnalyzed(juridicaImages), [juridicaImages]);
  const navButtonClass = '!border-white !bg-white !text-ubii-blue';
  const missingInputClass = 'border-red-400 ring-1 ring-red-200';

  const naturalMissing = {
    cedula: !hasUploaded(naturalCedula),
    rif: !hasUploaded(naturalRif),
    selfie: !naturalSelfie,
    nombres: !naturalNombres.trim(),
    apellidos: !naturalApellidos.trim(),
    cedulaId: !naturalCedulaId.trim(),
    telefono: !naturalTelefono.trim(),
    correo: !naturalCorreo.trim()
  };

  const juridicaMissing = {
    representantes: !hasUploaded(juridicaRepresentantes),
    rif: !hasUploaded(juridicaRif),
    actaRegistro: !juridicaActaRegistro.some((item) => item.validationStatus === 'VALIDO'),
    selfie: !juridicaSelfie,
    razonSocial: !juridicaRazonSocial.trim(),
    rifEmpresa: !juridicaRifEmpresa.trim(),
    repNombres: !repNombres.trim(),
    repApellidos: !repApellidos.trim(),
    repCedula: !repCedula.trim(),
    repTelefono: !repTelefono.trim(),
    repCorreo: !repCorreo.trim()
  };

  const handleNaturalStep1Continue = () => {
    if (!naturalStep1Ready) {
      setNaturalStep1Tried(true);
      return;
    }
    setNaturalStep1Tried(false);
    setNaturalStep(2);
  };

  const handleNaturalStep2Continue = () => {
    if (!naturalStep2Ready) {
      setNaturalStep2Tried(true);
      return;
    }
    setNaturalStep2Tried(false);
    const expediente = {
      registro: buildRegistro(),
      modulo: 'Persona Natural',
      recibidoEn: new Date().toISOString(),
      identificacion: {
        nombres: naturalNombres,
        apellidos: naturalApellidos,
        cedula: naturalCedulaId,
        telefono: naturalTelefono,
        correo: naturalCorreo
      },
      documentos: [
        { nombre: 'Cédula de Identidad', estado: naturalCedula[0]?.validationStatus ?? 'PENDIENTE', detalle: naturalCedula[0]?.validationMessage ?? '' },
        { nombre: 'RIF', estado: naturalRif[0]?.validationStatus ?? 'PENDIENTE', detalle: naturalRif[0]?.validationMessage ?? '' },
        { nombre: 'Selfie', estado: naturalSelfie ? 'VALIDADO' : 'PENDIENTE', detalle: naturalSelfie ? 'Selfie capturada' : 'No cargada' }
      ],
      imagenes: naturalImages.map((item) => ({
        tipo: item.label,
        descripcion: item.analysis?.description ?? 'Sin descripción',
        coincidencia: item.analysis?.expectedTypeProbability ?? 0,
        iaGenerada: item.analysis?.aiGeneratedProbability ?? 0,
        warnings: item.analysis?.warnings ?? []
      }))
    };
    navigate('/done', { state: { expediente } });
  };

  const handleJuridicaStep1Continue = () => {
    if (!juridicaStep1Ready) {
      setJuridicaStep1Tried(true);
      return;
    }
    setJuridicaStep1Tried(false);
    setJuridicaStep(2);
  };

  const handleJuridicaStep2Continue = () => {
    if (!juridicaStep2Ready) {
      setJuridicaStep2Tried(true);
      return;
    }
    setJuridicaStep2Tried(false);
    const expediente = {
      registro: buildRegistro(),
      modulo: 'Persona Jurídica',
      recibidoEn: new Date().toISOString(),
      identificacion: {
        razonSocial: juridicaRazonSocial,
        rifEmpresa: juridicaRifEmpresa,
        representante: `${repNombres} ${repApellidos}`.trim(),
        cedulaRepresentante: repCedula,
        telefono: repTelefono,
        correo: repCorreo
      },
      documentos: [
        {
          nombre: 'Cédula del representante',
          estado: juridicaRepresentantes[0]?.validationStatus ?? 'PENDIENTE',
          detalle: juridicaRepresentantes[0]?.validationMessage ?? ''
        },
        { nombre: 'RIF', estado: juridicaRif[0]?.validationStatus ?? 'PENDIENTE', detalle: juridicaRif[0]?.validationMessage ?? '' },
        { nombre: 'Registro Mercantil', estado: juridicaActaRegistro[0]?.validationStatus ?? 'PENDIENTE', detalle: juridicaActaRegistro[0]?.validationMessage ?? '' },
        { nombre: 'Selfie', estado: juridicaSelfie ? 'VALIDADO' : 'PENDIENTE', detalle: juridicaSelfie ? 'Selfie capturada' : 'No cargada' }
      ],
      imagenes: juridicaImages.map((item) => ({
        tipo: item.label,
        descripcion: item.analysis?.description ?? 'Sin descripción',
        coincidencia: item.analysis?.expectedTypeProbability ?? 0,
        iaGenerada: item.analysis?.aiGeneratedProbability ?? 0,
        warnings: item.analysis?.warnings ?? []
      }))
    };
    navigate('/done', { state: { expediente } });
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 md:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Onboarding Recaudos</h1>
        <p className="text-blue-100">Carga tus documentos y fotos para continuar.</p>
      </header>

      {moduleType === 'natural' ? (
        <section className="space-y-4">
          <section className="rounded-xl border border-ubii-border bg-white p-4 shadow-soft">
            <p className="text-sm font-semibold text-ubii-black">Paso {naturalStep} de 2</p>
            <p className="text-xs text-gray-600">{naturalStep === 1 ? 'Identificación' : 'Imágenes del comercio'}</p>
          </section>

          <div className={naturalStep === 1 ? 'space-y-4' : 'hidden'}>
            <div className="grid gap-4 md:grid-cols-2">
              <DocumentSlot
                className={naturalStep1Tried && naturalMissing.cedula ? 'border-red-400 ring-1 ring-red-200' : ''}
                label="Cedula de Identidad"
                required
                docKind="CEDULA"
                onChange={setNaturalCedula}
              />
              <DocumentSlot
                className={naturalStep1Tried && naturalMissing.rif ? 'border-red-400 ring-1 ring-red-200' : ''}
                label="RIF"
                required
                docKind="RIF"
                onChange={setNaturalRif}
              />
            </div>
            {naturalStep1Tried && !naturalStep1Ready ? (
              <div className="rounded-xl border border-red-300 bg-red-100 px-4 py-2 text-sm text-red-700">Faltan datos por completar.</div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
              <section
                className={`rounded-xl border bg-white p-6 shadow-soft lg:col-span-2 ${
                  naturalStep1Tried && !naturalDataReady ? 'border-red-400 ring-1 ring-red-200' : 'border-ubii-border'
                }`}
              >
                <h3 className="text-lg font-semibold text-ubii-blue">Identificación</h3>
                <div className="mt-4 grid gap-4">
                  <label className="text-sm font-medium text-ubii-black">
                    Nombres
                    <input
                      value={naturalNombres}
                      onChange={(event) => setNaturalNombres(event.target.value)}
                      className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                        naturalStep1Tried && naturalMissing.nombres ? missingInputClass : 'border-ubii-border'
                      }`}
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Apellidos
                    <input
                      value={naturalApellidos}
                      onChange={(event) => setNaturalApellidos(event.target.value)}
                      className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                        naturalStep1Tried && naturalMissing.apellidos ? missingInputClass : 'border-ubii-border'
                      }`}
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Cédula de identidad
                    <input
                      value={naturalCedulaId}
                      onChange={(event) => setNaturalCedulaId(event.target.value)}
                      className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                        naturalStep1Tried && naturalMissing.cedulaId ? missingInputClass : 'border-ubii-border'
                      }`}
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Número de teléfono
                    <input
                      value={naturalTelefono}
                      onChange={(event) => setNaturalTelefono(event.target.value)}
                      className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                        naturalStep1Tried && naturalMissing.telefono ? missingInputClass : 'border-ubii-border'
                      }`}
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Correo
                    <input
                      type="email"
                      value={naturalCorreo}
                      onChange={(event) => setNaturalCorreo(event.target.value)}
                      className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                        naturalStep1Tried && naturalMissing.correo ? missingInputClass : 'border-ubii-border'
                      }`}
                    />
                  </label>
                </div>
              </section>
              <SelfieProof
                className={`self-start ${naturalStep1Tried && naturalMissing.selfie ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                label="Prueba de vida (selfie)"
                onChange={(payload) => setNaturalSelfie(Boolean(payload?.file))}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <PrimaryButton className={navButtonClass} onClick={() => navigate('/demo')}>
                Volver
              </PrimaryButton>
              <PrimaryButton
                className={`${navButtonClass} ${naturalStep1Ready ? '' : 'opacity-60'}`}
                onClick={handleNaturalStep1Continue}
              >
                Continuar
              </PrimaryButton>
            </div>
          </div>

          <div className={naturalStep === 2 ? 'space-y-4' : 'hidden'}>
            {naturalStep2Tried && !naturalStep2Ready ? (
              <div className="rounded-xl border border-red-300 bg-red-100 px-4 py-2 text-sm text-red-700">
                Faltan datos por completar. Verifica que las 3 imágenes estén cargadas y analizadas.
              </div>
            ) : null}
            <CommerceImages onChange={setNaturalImages} highlightMissing={naturalStep2Tried && !naturalStep2Ready} />
            <div className="flex items-center justify-between gap-3">
              <PrimaryButton className={navButtonClass} onClick={() => setNaturalStep(1)}>
                Volver
              </PrimaryButton>
              <PrimaryButton className={`${navButtonClass} ${naturalStep2Ready ? '' : 'opacity-60'}`} onClick={handleNaturalStep2Continue}>
                Enviar expediente
              </PrimaryButton>
            </div>
          </div>
        </section>
      ) : null}

      {moduleType === 'juridica' ? (
        <section className="space-y-4">
          <section className="rounded-xl border border-ubii-border bg-white p-4 shadow-soft">
            <p className="text-sm font-semibold text-ubii-black">Paso {juridicaStep} de 2</p>
            <p className="text-xs text-gray-600">{juridicaStep === 1 ? 'Identificación' : 'Imágenes del comercio'}</p>
          </section>

          <div className={juridicaStep === 1 ? 'space-y-4' : 'hidden'}>
            <div className="grid gap-4 xl:grid-cols-3">
              <DocumentSlot
                className={juridicaStep1Tried && juridicaMissing.rif ? 'border-red-400 ring-1 ring-red-200' : ''}
                label="RIF"
                required
                docKind="RIF"
                onChange={setJuridicaRif}
              />

              <DocumentSlot
                className={juridicaStep1Tried && juridicaMissing.actaRegistro ? 'border-red-400 ring-1 ring-red-200' : ''}
                label="Registro mercantil"
                required
                docKind="ACTA_REGISTRO"
                onChange={setJuridicaActaRegistro}
              />

              <DocumentSlot
                className={juridicaStep1Tried && juridicaMissing.representantes ? 'border-red-400 ring-1 ring-red-200' : ''}
                label="Cédula del representante"
                required
                docKind="CEDULA_REPRESENTANTE"
                onChange={setJuridicaRepresentantes}
              />
            </div>
            {juridicaStep1Tried && !juridicaStep1Ready ? (
              <div className="rounded-xl border border-red-300 bg-red-100 px-4 py-2 text-sm text-red-700">Faltan datos por completar.</div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <section
                  className={`rounded-xl border bg-white p-6 shadow-soft ${
                    juridicaStep1Tried && (juridicaMissing.razonSocial || juridicaMissing.rifEmpresa)
                      ? 'border-red-400 ring-1 ring-red-200'
                      : 'border-ubii-border'
                  }`}
                >
                  <h3 className="text-lg font-semibold text-ubii-blue">Datos de la empresa</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-ubii-black">
                      Razón social
                      <input
                        value={juridicaRazonSocial}
                        onChange={(event) => setJuridicaRazonSocial(event.target.value)}
                        className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                          juridicaStep1Tried && juridicaMissing.razonSocial ? missingInputClass : 'border-ubii-border'
                        }`}
                      />
                    </label>
                    <label className="text-sm font-medium text-ubii-black">
                      RIF de la empresa
                      <input
                        value={juridicaRifEmpresa}
                        onChange={(event) => setJuridicaRifEmpresa(event.target.value)}
                        className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                          juridicaStep1Tried && juridicaMissing.rifEmpresa ? missingInputClass : 'border-ubii-border'
                        }`}
                      />
                    </label>
                  </div>
                </section>

                <section
                  className={`rounded-xl border bg-white p-6 shadow-soft ${
                    juridicaStep1Tried &&
                    (juridicaMissing.repNombres ||
                      juridicaMissing.repApellidos ||
                      juridicaMissing.repCedula ||
                      juridicaMissing.repTelefono ||
                      juridicaMissing.repCorreo)
                      ? 'border-red-400 ring-1 ring-red-200'
                      : 'border-ubii-border'
                  }`}
                >
                  <h3 className="text-lg font-semibold text-ubii-blue">Datos del representante legal</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-ubii-black">
                      Nombres
                      <input
                        value={repNombres}
                        onChange={(event) => setRepNombres(event.target.value)}
                        className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                          juridicaStep1Tried && juridicaMissing.repNombres ? missingInputClass : 'border-ubii-border'
                        }`}
                      />
                    </label>
                    <label className="text-sm font-medium text-ubii-black">
                      Apellidos
                      <input
                        value={repApellidos}
                        onChange={(event) => setRepApellidos(event.target.value)}
                        className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                          juridicaStep1Tried && juridicaMissing.repApellidos ? missingInputClass : 'border-ubii-border'
                        }`}
                      />
                    </label>
                    <label className="text-sm font-medium text-ubii-black">
                      Cédula de identidad
                      <input
                        value={repCedula}
                        onChange={(event) => setRepCedula(event.target.value)}
                        className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                          juridicaStep1Tried && juridicaMissing.repCedula ? missingInputClass : 'border-ubii-border'
                        }`}
                      />
                    </label>
                    <label className="text-sm font-medium text-ubii-black">
                      Número de teléfono
                      <input
                        value={repTelefono}
                        onChange={(event) => setRepTelefono(event.target.value)}
                        className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                          juridicaStep1Tried && juridicaMissing.repTelefono ? missingInputClass : 'border-ubii-border'
                        }`}
                      />
                    </label>
                    <label className="text-sm font-medium text-ubii-black md:col-span-2">
                      Correo
                      <input
                        type="email"
                        value={repCorreo}
                        onChange={(event) => setRepCorreo(event.target.value)}
                        className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                          juridicaStep1Tried && juridicaMissing.repCorreo ? missingInputClass : 'border-ubii-border'
                        }`}
                      />
                    </label>
                  </div>
                </section>
              </div>

              <SelfieProof
                className={`self-start ${juridicaStep1Tried && juridicaMissing.selfie ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                label="Prueba de vida (selfie del representante)"
                onChange={(payload) => setJuridicaSelfie(Boolean(payload?.file))}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <PrimaryButton className={navButtonClass} onClick={() => navigate('/demo')}>
                Volver
              </PrimaryButton>
              <PrimaryButton
                className={`${navButtonClass} ${juridicaStep1Ready ? '' : 'opacity-60'}`}
                onClick={handleJuridicaStep1Continue}
              >
                Continuar
              </PrimaryButton>
            </div>
          </div>

          <div className={juridicaStep === 2 ? 'space-y-4' : 'hidden'}>
            {juridicaStep2Tried && !juridicaStep2Ready ? (
              <div className="rounded-xl border border-red-300 bg-red-100 px-4 py-2 text-sm text-red-700">
                Faltan datos por completar. Verifica que las 3 imágenes estén cargadas y analizadas.
              </div>
            ) : null}
            <CommerceImages onChange={setJuridicaImages} highlightMissing={juridicaStep2Tried && !juridicaStep2Ready} />
            <div className="flex items-center justify-between gap-3">
              <PrimaryButton className={navButtonClass} onClick={() => setJuridicaStep(1)}>
                Volver
              </PrimaryButton>
              <PrimaryButton className={`${navButtonClass} ${juridicaStep2Ready ? '' : 'opacity-60'}`} onClick={handleJuridicaStep2Continue}>
                Enviar expediente
              </PrimaryButton>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
