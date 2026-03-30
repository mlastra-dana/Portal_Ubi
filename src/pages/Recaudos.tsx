import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CommerceImages } from '../components/CommerceImages';
import { DocumentSlot } from '../components/DocumentSlot';
import { SelfieProof } from '../components/SelfieProof';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { extractIdentityWithIdp, idpEnabled } from '../services/idpClient';
import { extractCedulaAutofill, extractRifAutofill } from '../services/ocr/autofillExtraction';
import type { CommerceImageItem, UploadedDocumentResult } from '../types/recaudos';

type ModuleType = 'natural' | 'juridica';

const isImagesComplete = (items: CommerceImageItem[]): boolean => items.length === 3 && items.every((item) => Boolean(item.file));
const isImagesAnalyzed = (items: CommerceImageItem[]): boolean =>
  items.length === 3 && items.every((item) => Boolean(item.file) && !item.analyzing && Boolean(item.analysis));
const isImagesValid = (items: CommerceImageItem[]): boolean => items.length === 3 && items.every((item) => item.validationStatus === 'VALIDO');
const hasImagesNoCoincide = (items: CommerceImageItem[]): boolean =>
  items.some((item) => item.analysis?.validationResult === 'NO COINCIDE');
const hasUploaded = (items: UploadedDocumentResult[]): boolean => items.length > 0;
const hasValidated = (items: UploadedDocumentResult[]): boolean => items.some((item) => item.validationStatus === 'VALIDO');
const buildRegistro = (): string => `EXP-${Date.now().toString().slice(-8)}`;
const PHONE_EXAMPLE = '0412-1234567 o +58 412-1234567';
const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
const isValidVenezuelanPhone = (value: string): boolean => {
  const digits = value.replace(/\D/g, '');
  const mobileCodes = new Set(['412', '414', '416', '424', '426']);
  if (digits.startsWith('58') && digits.length === 12) return mobileCodes.has(digits.slice(2, 5));
  if (digits.startsWith('0') && digits.length === 11) return mobileCodes.has(digits.slice(1, 4));
  return false;
};
const splitFullName = (value: string): { nombres: string; apellidos: string } => {
  const clean = value
    .replace(/Escaneado\s+con\s+CamScanner/gi, ' ')
    .replace(/\b(CAMSCANNER|ESCANEADO|CON)\b/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  if (!clean) return { nombres: '', apellidos: '' };
  const parts = clean.split(' ');
  if (parts.length === 1) return { nombres: parts[0], apellidos: '' };
  if (parts.length === 2) return { nombres: parts[0], apellidos: parts[1] };
  return { nombres: parts.slice(0, 2).join(' '), apellidos: parts.slice(2).join(' ') };
};

export default function Recaudos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const juridicaEnabled = import.meta.env.VITE_ENABLE_JURIDICA === 'true';
  const requestedModuleType: ModuleType = searchParams.get('tipo') === 'juridica' ? 'juridica' : 'natural';
  const juridicaRequested = requestedModuleType === 'juridica';
  const moduleType: ModuleType = juridicaEnabled ? requestedModuleType : 'natural';

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
  const [naturalIdpLoading, setNaturalIdpLoading] = useState(false);

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
  const [repIdpLoading, setRepIdpLoading] = useState(false);

  useEffect(() => {
    const cedula = naturalCedula[0];
    if (!cedula) {
      setNaturalNombres('');
      setNaturalApellidos('');
      setNaturalCedulaId('');
      setNaturalIdpLoading(false);
      return;
    }

    let cancelled = false;
    const extracted = extractCedulaAutofill(cedula.rawText ?? '');
    const nameSource = extracted.nombres && extracted.apellidos
      ? `${extracted.nombres} ${extracted.apellidos}`
      : (cedula.fields.nombres ?? '');
    const { nombres, apellidos } = splitFullName(nameSource);
    setNaturalNombres(extracted.nombres ?? nombres);
    setNaturalApellidos(extracted.apellidos ?? apellidos);
    const cedulaNumero = extracted.cedula ?? cedula.fields.numeroId;
    setNaturalCedulaId(cedulaNumero ?? '');

    const shouldTryIdp = idpEnabled() && (!extracted.nombres || !extracted.apellidos);
    if (shouldTryIdp) {
      setNaturalIdpLoading(true);
      void extractIdentityWithIdp(cedula).then((idp) => {
        if (cancelled || !idp) return;
        if (idp.nombres) setNaturalNombres(idp.nombres);
        if (idp.apellidos) setNaturalApellidos(idp.apellidos);
        if (idp.cedula) setNaturalCedulaId(idp.cedula);
      }).finally(() => {
        if (!cancelled) setNaturalIdpLoading(false);
      });
    } else {
      setNaturalIdpLoading(false);
    }

    return () => {
      cancelled = true;
    };
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
      setRepIdpLoading(false);
      return;
    }

    let cancelled = false;
    const extracted = extractCedulaAutofill(rep.rawText ?? '');
    const nameSource = extracted.nombres && extracted.apellidos
      ? `${extracted.nombres} ${extracted.apellidos}`
      : (rep.fields.nombres ?? '');
    const { nombres, apellidos } = splitFullName(nameSource);
    setRepNombres(extracted.nombres ?? nombres);
    setRepApellidos(extracted.apellidos ?? apellidos);
    const cedulaNumero = extracted.cedula ?? rep.fields.numeroId;
    setRepCedula(cedulaNumero ?? '');

    const shouldTryIdp = idpEnabled() && (!extracted.nombres || !extracted.apellidos);
    if (shouldTryIdp) {
      setRepIdpLoading(true);
      void extractIdentityWithIdp(rep).then((idp) => {
        if (cancelled || !idp) return;
        if (idp.nombres) setRepNombres(idp.nombres);
        if (idp.apellidos) setRepApellidos(idp.apellidos);
        if (idp.cedula) setRepCedula(idp.cedula);
      }).finally(() => {
        if (!cancelled) setRepIdpLoading(false);
      });
    } else {
      setRepIdpLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [juridicaRepresentantes]);

  const naturalPhoneInvalid = useMemo(() => naturalTelefono.trim() !== '' && !isValidVenezuelanPhone(naturalTelefono), [naturalTelefono]);
  const naturalEmailInvalid = useMemo(() => naturalCorreo.trim() !== '' && !isValidEmail(naturalCorreo), [naturalCorreo]);
  const naturalDataReady = useMemo(
    () =>
      Boolean(
        naturalNombres.trim() &&
          naturalApellidos.trim() &&
          naturalCedulaId.trim() &&
          naturalTelefono.trim() &&
          naturalCorreo.trim() &&
          !naturalPhoneInvalid &&
          !naturalEmailInvalid
      ),
    [naturalApellidos, naturalCedulaId, naturalCorreo, naturalEmailInvalid, naturalNombres, naturalPhoneInvalid, naturalTelefono]
  );

  const naturalStep1Ready = useMemo(
    () => hasUploaded(naturalCedula) && hasUploaded(naturalRif) && naturalSelfie && naturalDataReady,
    [naturalCedula, naturalDataReady, naturalRif, naturalSelfie]
  );
  const naturalHasNoCoincide = useMemo(() => hasImagesNoCoincide(naturalImages), [naturalImages]);
  const naturalStep2Ready = useMemo(
    () => isImagesComplete(naturalImages) && isImagesAnalyzed(naturalImages) && isImagesValid(naturalImages) && !naturalHasNoCoincide,
    [naturalHasNoCoincide, naturalImages]
  );

  const repPhoneInvalid = useMemo(() => repTelefono.trim() !== '' && !isValidVenezuelanPhone(repTelefono), [repTelefono]);
  const repEmailInvalid = useMemo(() => repCorreo.trim() !== '' && !isValidEmail(repCorreo), [repCorreo]);
  const juridicaDataReady = useMemo(
    () =>
      Boolean(
        juridicaRazonSocial.trim() &&
          juridicaRifEmpresa.trim() &&
          repNombres.trim() &&
          repApellidos.trim() &&
          repCedula.trim() &&
          repTelefono.trim() &&
          repCorreo.trim() &&
          !repPhoneInvalid &&
          !repEmailInvalid
      ),
    [juridicaRazonSocial, juridicaRifEmpresa, repApellidos, repCedula, repCorreo, repEmailInvalid, repNombres, repPhoneInvalid, repTelefono]
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
  const juridicaHasNoCoincide = useMemo(() => hasImagesNoCoincide(juridicaImages), [juridicaImages]);
  const juridicaStep2Ready = useMemo(
    () => isImagesComplete(juridicaImages) && isImagesAnalyzed(juridicaImages) && isImagesValid(juridicaImages) && !juridicaHasNoCoincide,
    [juridicaHasNoCoincide, juridicaImages]
  );
  const navButtonClass = '!border-white !bg-white !text-ubii-blue';
  const missingInputClass = 'border-red-400 ring-1 ring-red-200';

  const naturalMissing = {
    cedula: !hasValidated(naturalCedula),
    rif: !hasValidated(naturalRif),
    selfie: !naturalSelfie,
    nombres: !naturalNombres.trim(),
    apellidos: !naturalApellidos.trim(),
    cedulaId: !naturalCedulaId.trim(),
    telefono: !naturalTelefono.trim() || naturalPhoneInvalid,
    correo: !naturalCorreo.trim() || naturalEmailInvalid
  };
  const naturalMissingFieldsStep1: string[] = [
    ...(naturalMissing.cedula ? ['Cédula de identidad'] : []),
    ...(naturalMissing.rif ? ['RIF'] : []),
    ...(naturalMissing.selfie ? ['Prueba de vida (selfie)'] : []),
    ...(naturalMissing.nombres ? ['Nombres'] : []),
    ...(naturalMissing.apellidos ? ['Apellidos'] : []),
    ...(naturalMissing.cedulaId ? ['Cédula de identidad (número)'] : []),
    ...(naturalMissing.telefono ? [`Número de teléfono (formato VE: ${PHONE_EXAMPLE})`] : []),
    ...(naturalMissing.correo ? ['Correo (formato válido: usuario@dominio.com)'] : [])
  ];
  const naturalMissingFieldsStep2: string[] = [
    ...(!isImagesComplete(naturalImages) ? ['Imágenes del comercio (faltan adjuntos)'] : []),
    ...(!isImagesAnalyzed(naturalImages) ? ['Imágenes del comercio (faltan análisis)'] : []),
    ...(!isImagesValid(naturalImages) ? ['Imágenes del comercio (falta validación)'] : []),
    ...(naturalHasNoCoincide ? ["Imágenes del comercio con estado 'No coincide'"] : [])
  ];

  const juridicaMissing = {
    representantes: !hasValidated(juridicaRepresentantes),
    rif: !hasValidated(juridicaRif),
    actaRegistro: !juridicaActaRegistro.some((item) => item.validationStatus === 'VALIDO'),
    selfie: !juridicaSelfie,
    razonSocial: !juridicaRazonSocial.trim(),
    rifEmpresa: !juridicaRifEmpresa.trim(),
    repNombres: !repNombres.trim(),
    repApellidos: !repApellidos.trim(),
    repCedula: !repCedula.trim(),
    repTelefono: !repTelefono.trim() || repPhoneInvalid,
    repCorreo: !repCorreo.trim() || repEmailInvalid
  };
  const juridicaMissingFieldsStep1: string[] = [
    ...(juridicaMissing.rif ? ['RIF'] : []),
    ...(juridicaMissing.actaRegistro ? ['Registro mercantil'] : []),
    ...(juridicaMissing.representantes ? ['Cédula del representante'] : []),
    ...(juridicaMissing.selfie ? ['Prueba de vida (selfie del representante)'] : []),
    ...(juridicaMissing.razonSocial ? ['Razón social'] : []),
    ...(juridicaMissing.rifEmpresa ? ['RIF de la empresa'] : []),
    ...(juridicaMissing.repNombres ? ['Nombres del representante'] : []),
    ...(juridicaMissing.repApellidos ? ['Apellidos del representante'] : []),
    ...(juridicaMissing.repCedula ? ['Cédula del representante (número)'] : []),
    ...(juridicaMissing.repTelefono ? [`Número de teléfono del representante (formato VE: ${PHONE_EXAMPLE})`] : []),
    ...(juridicaMissing.repCorreo ? ['Correo del representante (formato válido: usuario@dominio.com)'] : [])
  ];
  const juridicaMissingFieldsStep2: string[] = [
    ...(!isImagesComplete(juridicaImages) ? ['Imágenes del comercio (faltan adjuntos)'] : []),
    ...(!isImagesAnalyzed(juridicaImages) ? ['Imágenes del comercio (faltan análisis)'] : []),
    ...(!isImagesValid(juridicaImages) ? ['Imágenes del comercio (falta validación)'] : []),
    ...(juridicaHasNoCoincide ? ["Imágenes del comercio con estado 'No coincide'"] : [])
  ];

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

      {juridicaRequested ? (
        <div className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-800">
          El módulo Persona Jurídica está deshabilitado temporalmente y se habilitará en la segunda etapa del proyecto.
        </div>
      ) : null}

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
                showExtractedDetails={false}
                onChange={setNaturalRif}
              />
            </div>
            {naturalStep1Tried && !naturalStep1Ready ? (
              <div className="rounded-xl border border-red-300 bg-red-100 px-4 py-2 text-sm text-red-700">
                Faltan datos por completar: {naturalMissingFieldsStep1.join(', ')}.
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
              <section
                className={`rounded-xl border bg-white p-6 shadow-soft lg:col-span-2 ${
                  naturalStep1Tried && !naturalDataReady ? 'border-red-400 ring-1 ring-red-200' : 'border-ubii-border'
                }`}
              >
                <h3 className="text-lg font-semibold text-ubii-blue">Identificación</h3>
                {naturalIdpLoading ? (
                  <div className="mt-3 rounded-lg border border-ubii-blue/30 bg-ubii-light px-3 py-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ubii-blue">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ubii-blue border-t-transparent" />
                      Autocompletando datos desde el documento...
                    </p>
                    <p className="mt-1 text-xs text-gray-600">Espera hasta 2 minutos mientras llenamos los campos automáticamente.</p>
                  </div>
                ) : null}
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
                      type="tel"
                      inputMode="tel"
                      placeholder="Ej: 0412-1234567"
                      value={naturalTelefono}
                      onChange={(event) => setNaturalTelefono(event.target.value.replace(/[^\d+\s()-]/g, ''))}
                      className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                        naturalStep1Tried && naturalMissing.telefono ? missingInputClass : 'border-ubii-border'
                      }`}
                    />
                  </label>
                  <label className="text-sm font-medium text-ubii-black">
                    Correo
                    <input
                      type="email"
                      inputMode="email"
                      placeholder="usuario@dominio.com"
                      value={naturalCorreo}
                      onChange={(event) => setNaturalCorreo(event.target.value)}
                      className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                        naturalStep1Tried && naturalMissing.correo ? missingInputClass : 'border-ubii-border'
                      }`}
                    />
                    {naturalStep1Tried && naturalEmailInvalid ? (
                      <span className="mt-1 block text-xs text-red-600">Ingresa un correo válido. Ejemplo: usuario@dominio.com</span>
                    ) : null}
                  </label>
                </div>
              </section>
              <SelfieProof
                className="self-start"
                label="Prueba de vida (selfie)"
                highlightMissing={naturalStep1Tried && naturalMissing.selfie}
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
                Faltan datos por completar: {naturalMissingFieldsStep2.join(', ')}.
              </div>
            ) : null}
            <CommerceImages
              onChange={setNaturalImages}
              highlightMissing={naturalStep2Tried && !naturalStep2Ready}
              highlightNoMatch={naturalHasNoCoincide}
            />
            {naturalHasNoCoincide ? (
              <div className="rounded-xl border border-red-300 bg-red-100 px-4 py-2 text-sm text-red-700">
                Debes corregir las imágenes marcadas como 'No coincide' antes de enviar el expediente.
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <PrimaryButton className={navButtonClass} onClick={() => setNaturalStep(1)}>
                Volver
              </PrimaryButton>
              <PrimaryButton
                className={`${navButtonClass} ${naturalStep2Ready ? '' : 'opacity-60'}`}
                onClick={handleNaturalStep2Continue}
                disabled={!naturalStep2Ready}
              >
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
              <div className="rounded-xl border border-red-300 bg-red-100 px-4 py-2 text-sm text-red-700">
                Faltan datos por completar: {juridicaMissingFieldsStep1.join(', ')}.
              </div>
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
                  {repIdpLoading ? (
                    <div className="mt-3 rounded-lg border border-ubii-blue/30 bg-ubii-light px-3 py-2">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ubii-blue">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ubii-blue border-t-transparent" />
                        Autocompletando datos desde el documento...
                      </p>
                      <p className="mt-1 text-xs text-gray-600">Espera hasta 2 minutos mientras llenamos los campos automáticamente.</p>
                    </div>
                  ) : null}
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
                        type="tel"
                        inputMode="tel"
                        placeholder="Ej: 0412-1234567"
                        value={repTelefono}
                        onChange={(event) => setRepTelefono(event.target.value.replace(/[^\d+\s()-]/g, ''))}
                        className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                          juridicaStep1Tried && juridicaMissing.repTelefono ? missingInputClass : 'border-ubii-border'
                        }`}
                      />
                    </label>
                    <label className="text-sm font-medium text-ubii-black md:col-span-2">
                      Correo
                      <input
                        type="email"
                        inputMode="email"
                        placeholder="usuario@dominio.com"
                        value={repCorreo}
                        onChange={(event) => setRepCorreo(event.target.value)}
                        className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ubii-black ${
                          juridicaStep1Tried && juridicaMissing.repCorreo ? missingInputClass : 'border-ubii-border'
                        }`}
                      />
                      {juridicaStep1Tried && repEmailInvalid ? (
                        <span className="mt-1 block text-xs text-red-600">Ingresa un correo válido. Ejemplo: usuario@dominio.com</span>
                      ) : null}
                    </label>
                  </div>
                </section>
              </div>

              <SelfieProof
                className="self-start"
                label="Prueba de vida (selfie del representante)"
                highlightMissing={juridicaStep1Tried && juridicaMissing.selfie}
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
                Faltan datos por completar: {juridicaMissingFieldsStep2.join(', ')}.
              </div>
            ) : null}
            <CommerceImages
              onChange={setJuridicaImages}
              highlightMissing={juridicaStep2Tried && !juridicaStep2Ready}
              highlightNoMatch={juridicaHasNoCoincide}
            />
            {juridicaHasNoCoincide ? (
              <div className="rounded-xl border border-red-300 bg-red-100 px-4 py-2 text-sm text-red-700">
                Debes corregir las imágenes marcadas como 'No coincide' antes de enviar el expediente.
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <PrimaryButton className={navButtonClass} onClick={() => setJuridicaStep(1)}>
                Volver
              </PrimaryButton>
              <PrimaryButton
                className={`${navButtonClass} ${juridicaStep2Ready ? '' : 'opacity-60'}`}
                onClick={handleJuridicaStep2Continue}
                disabled={!juridicaStep2Ready}
              >
                Enviar expediente
              </PrimaryButton>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
