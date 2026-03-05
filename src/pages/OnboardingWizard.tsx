import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertBanner } from '../components/AlertBanner';
import { DocumentUploader } from '../components/DocumentUploader';
import { ImageAnalysisCard } from '../components/ImageAnalysisCard';
import { ImageCaptureOrUpload } from '../components/ImageCaptureOrUpload';
import { Stepper2Steps } from '../components/Stepper2Steps';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { analyzeImage } from '../services/imageAiMock';
import { simulateOcr } from '../services/ocrMock';
import type { DocType, ImageItemState, OnboardingSummary, OcrResult } from '../types/onboarding';

const imageSeed: ImageItemState[] = [
  { kind: 'fachada', label: 'Fachada', decision: null },
  { kind: 'interior', label: 'Interior', decision: null },
  { kind: 'inventario', label: 'Inventario', decision: null }
];

type ProcessingMap = Record<'cedula' | 'rif' | 'fachada' | 'interior' | 'inventario', boolean>;

export default function OnboardingWizard() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [applicantType, setApplicantType] = useState<'natural' | 'juridica'>('natural');
  const [fullName, setFullName] = useState('');
  const [cedulaNumber, setCedulaNumber] = useState('');
  const [rifNumber, setRifNumber] = useState('');
  const [cedulaExpiry, setCedulaExpiry] = useState('');
  const [rifExpiry, setRifExpiry] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [cedulaFile, setCedulaFile] = useState<File>();
  const [rifFile, setRifFile] = useState<File>();
  const [cedulaOcr, setCedulaOcr] = useState<OcrResult>();
  const [rifOcr, setRifOcr] = useState<OcrResult>();

  const [processing, setProcessing] = useState<ProcessingMap>({
    cedula: false,
    rif: false,
    fachada: false,
    interior: false,
    inventario: false
  });

  const [images, setImages] = useState<ImageItemState[]>(imageSeed);
  const [selfiePreview, setSelfiePreview] = useState<string>();
  const [selfieCameraOpen, setSelfieCameraOpen] = useState(false);
  const [selfieError, setSelfieError] = useState('');

  const selfieVideoRef = useRef<HTMLVideoElement | null>(null);
  const selfieStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      selfieStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!selfieCameraOpen || !selfieVideoRef.current || !selfieStreamRef.current) return;
    const video = selfieVideoRef.current;
    video.srcObject = selfieStreamRef.current;
    video.play().catch(() => {
      setSelfieError('No se pudo iniciar la camara frontal.');
    });
  }, [selfieCameraOpen]);

  const setProcessingKey = (key: keyof ProcessingMap, value: boolean) => {
    setProcessing((prev) => ({ ...prev, [key]: value }));
  };

  const runOcr = async (file: File, docType: DocType) => {
    setProcessingKey(docType, true);
    try {
      const result = await simulateOcr(file, docType);

      if (docType === 'cedula') {
        setCedulaOcr(result);
        setFullName(result.extracted.fullName);
        setCedulaNumber(result.extracted.documentNumber);
        setCedulaExpiry(result.extracted.expiryDate);
      } else {
        setRifOcr(result);
        setRifNumber(result.extracted.documentNumber);
        setRifExpiry(result.extracted.expiryDate);
        if (!fullName) setFullName(result.extracted.fullName);
      }
    } finally {
      setProcessingKey(docType, false);
    }
  };

  const handleDocumentFile = (file?: File, docType?: DocType) => {
    if (!file || !docType) return;
    if (docType === 'cedula') setCedulaFile(file);
    if (docType === 'rif') setRifFile(file);
    void runOcr(file, docType);
  };

  const handleImageSelected = async (kind: ImageItemState['kind'], payload: { blob: Blob; previewUrl: string }) => {
    setProcessingKey(kind, true);

    setImages((prev) => prev.map((item) => (item.kind === kind ? { ...item, blob: payload.blob, previewUrl: payload.previewUrl } : item)));

    const analysis = await analyzeImage(payload.blob, kind);

    setImages((prev) =>
      prev.map((item) => (item.kind === kind ? { ...item, analysis, decision: item.decision === null ? 'approved' : item.decision } : item))
    );

    setProcessingKey(kind, false);
  };

  const stepOneWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (cedulaOcr?.expiryStatus === 'VENCIDO') warnings.push('Cedula vencida: advertencia amarilla, se permite continuar.');
    if (cedulaOcr?.expiryStatus === 'PROXIMO_A_VENCER') warnings.push('Cedula proxima a vencer.');
    cedulaOcr?.warnings.forEach((warning) => warnings.push(`Cedula: ${warning}`));
    if (rifOcr?.expiryStatus === 'VENCIDO') warnings.push('RIF vencido: advertencia amarilla, se permite continuar.');
    if (rifOcr?.expiryStatus === 'PROXIMO_A_VENCER') warnings.push('RIF proximo a vencer.');
    rifOcr?.warnings.forEach((warning) => warnings.push(`RIF: ${warning}`));
    return warnings;
  }, [cedulaOcr, rifOcr]);

  const stepTwoWarnings = useMemo(() => {
    const warnings: string[] = [];
    images.forEach((item) => {
      item.analysis?.warnings.forEach((warning) => warnings.push(`${item.label}: ${warning}`));
      if (item.decision === 'rejected') warnings.push(`${item.label}: marcado por analista como no aprobado.`);
    });
    return warnings;
  }, [images]);

  const canContinueToStep2 = Boolean(cedulaOcr && rifOcr && !processing.cedula && !processing.rif);
  const canFinish = images.every((item) => item.analysis);

  const startSelfieCamera = async () => {
    setSelfieError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      selfieStreamRef.current = stream;
      setSelfieCameraOpen(true);
    } catch {
      setSelfieError('No se pudo abrir camara frontal. Usa subir archivo.');
    }
  };

  const stopSelfieCamera = () => {
    selfieStreamRef.current?.getTracks().forEach((track) => track.stop());
    selfieStreamRef.current = null;
    setSelfieCameraOpen(false);
  };

  const captureSelfie = async () => {
    if (!selfieVideoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = selfieVideoRef.current.videoWidth || 700;
    canvas.height = selfieVideoRef.current.videoHeight || 700;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(selfieVideoRef.current, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;
    setSelfiePreview(URL.createObjectURL(blob));
    stopSelfieCamera();
  };

  const submit = () => {
    if (!canFinish) return;

    const summary: OnboardingSummary = {
      ocr: {
        cedula: cedulaOcr,
        rif: rifOcr
      },
      imageAnalysis: images.map((item) => item.analysis).filter(Boolean) as OnboardingSummary['imageAnalysis'],
      warnings: [...stepOneWarnings, ...stepTwoWarnings]
    };

    navigate('/done', { state: { summary } });
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-10 md:px-6">
      <header>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Onboarding POS UBIAPP · Persona Natural</h1>
        <p className="text-blue-100">Validacion automatica por carga. Las alertas son informativas y no bloquean el flujo.</p>
      </header>

      <Stepper2Steps currentStep={step} />
      <AlertBanner type="info">Sus documentos e imagenes se procesan en el navegador (modo demo).</AlertBanner>

      {step === 1 ? (
        <section className="space-y-4 rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ubii-blue">Paso 1: Validacion de Documentos con OCR</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="rounded-xl border border-ubii-blue bg-ubii-blue/10 p-3 text-sm font-semibold text-ubii-hover">
              <input type="radio" checked={applicantType === 'natural'} onChange={() => setApplicantType('natural')} className="mr-2" />
              Persona Natural
            </label>
            <label className="rounded-xl border border-ubii-border bg-ubii-light p-3 text-sm font-semibold text-gray-600">
              <input type="radio" disabled checked={false} onChange={() => undefined} className="mr-2" />
              Persona Juridica (deshabilitado en demo)
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DocumentUploader
              label="Cedula (requerido)"
              docType="cedula"
              file={cedulaFile}
              processing={processing.cedula}
              result={cedulaOcr}
              onFile={handleDocumentFile}
            />
            <DocumentUploader
              label="RIF (requerido)"
              docType="rif"
              file={rifFile}
              processing={processing.rif}
              result={rifOcr}
              onFile={handleDocumentFile}
            />
          </div>

          <div className="rounded-xl border border-ubii-border bg-ubii-light p-4">
            <p className="mb-3 text-sm font-semibold text-ubii-black">Selfie del solicitante (opcional)</p>
            <div className="flex flex-wrap items-center gap-2">
              <PrimaryButton onClick={startSelfieCamera} className="px-3 py-2 text-sm">
                Tomar selfie
              </PrimaryButton>
              <label className="rounded-lg border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black">
                Subir selfie
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setSelfiePreview(URL.createObjectURL(file));
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            {selfieCameraOpen ? (
              <div className="mt-3 space-y-2">
                <video ref={selfieVideoRef} className="h-52 w-full rounded-xl bg-black object-cover" autoPlay playsInline muted />
                <div className="flex gap-2">
                  <PrimaryButton onClick={captureSelfie} className="px-3 py-2 text-sm">
                    Capturar selfie
                  </PrimaryButton>
                  <PrimaryButton onClick={stopSelfieCamera} className="px-3 py-2 text-sm">
                    Cancelar
                  </PrimaryButton>
                </div>
              </div>
            ) : null}

            {selfieError ? <p className="mt-2 text-xs text-amber-700">{selfieError}</p> : null}
            {selfiePreview ? <img src={selfiePreview} alt="Selfie solicitante" className="mt-3 h-40 w-40 rounded-xl object-cover" /> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-ubii-black">
              Nombre
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
              />
            </label>
            <label className="text-sm font-medium text-ubii-black">
              Cedula
              <input
                value={cedulaNumber}
                onChange={(event) => setCedulaNumber(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
              />
            </label>
            <label className="text-sm font-medium text-ubii-black">
              RIF
              <input
                value={rifNumber}
                onChange={(event) => setRifNumber(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
              />
            </label>
            <label className="text-sm font-medium text-ubii-black">
              Vencimiento cedula
              <input
                value={cedulaExpiry}
                onChange={(event) => setCedulaExpiry(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
              />
            </label>
            <label className="text-sm font-medium text-ubii-black">
              Vencimiento RIF
              <input
                value={rifExpiry}
                onChange={(event) => setRifExpiry(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
              />
            </label>
            <label className="text-sm font-medium text-ubii-black">
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
              />
            </label>
            <label className="text-sm font-medium text-ubii-black md:col-span-2">
              Telefono
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ubii-border bg-white px-3 py-2 text-sm text-ubii-black"
              />
            </label>
          </div>

          {stepOneWarnings.map((warning) => (
            <AlertBanner key={warning} type="warning">
              {warning}
            </AlertBanner>
          ))}

          <PrimaryButton onClick={() => setStep(2)} disabled={!canContinueToStep2}>
            Continuar al Paso 2
          </PrimaryButton>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ubii-blue">Paso 2: Carga de imagenes del comercio con IA</h2>

          <div className="grid gap-4 md:grid-cols-3">
            {images.map((item) => (
              <div key={item.kind} className="space-y-3">
                <ImageCaptureOrUpload
                  kind={item.kind}
                  label={item.label}
                  onSelect={(payload) => {
                    void handleImageSelected(item.kind, payload);
                  }}
                />
                <ImageAnalysisCard
                  previewUrl={item.previewUrl}
                  processing={processing[item.kind]}
                  analysis={item.analysis}
                  decision={item.decision}
                  onDecisionChange={(value) =>
                    setImages((prev) => prev.map((current) => (current.kind === item.kind ? { ...current, decision: value } : current)))
                  }
                />
              </div>
            ))}
          </div>

          {stepTwoWarnings.map((warning) => (
            <AlertBanner key={warning} type="warning">
              {warning}
            </AlertBanner>
          ))}

          <div className="flex gap-2">
            <PrimaryButton onClick={() => setStep(1)}>
              Volver
            </PrimaryButton>
            <PrimaryButton onClick={submit} disabled={!canFinish}>
              Enviar para revision
            </PrimaryButton>
          </div>
        </section>
      ) : null}
    </main>
  );
}
