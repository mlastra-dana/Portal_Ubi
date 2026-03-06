import { useEffect, useRef, useState } from 'react';
import { PrimaryButton } from './ui/PrimaryButton';
import { AlertBanner } from './AlertBanner';
import { analyzeImage } from '../services/imageAiMock';
import type { CommerceImageItem, CommerceImageKind } from '../types/recaudos';

type Props = {
  onChange?: (items: CommerceImageItem[]) => void;
  highlightMissing?: boolean;
  className?: string;
};

const initialItems: CommerceImageItem[] = [
  { kind: 'fachada', label: 'Fachada' },
  { kind: 'interior', label: 'Interior' },
  { kind: 'inventario', label: 'Inventario' }
];

export function CommerceImages({ onChange, highlightMissing = false, className = '' }: Props) {
  const [items, setItems] = useState<CommerceImageItem[]>(initialItems);
  const [activeCamera, setActiveCamera] = useState<CommerceImageKind | null>(null);
  const [cameraError, setCameraError] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      items.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (!activeCamera || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play();
  }, [activeCamera]);

  const startCamera = async (kind: CommerceImageKind) => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setActiveCamera(kind);
    } catch {
      setCameraError('No se pudo abrir la camara. Puedes usar subir archivo.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActiveCamera(null);
  };

  const assignItem = (kind: CommerceImageKind, payload: { blob: Blob; file: File; previewUrl: string }) => {
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.kind !== kind) return item;
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return {
          ...item,
          blob: payload.blob,
          file: payload.file,
          previewUrl: payload.previewUrl,
          error: undefined,
          analyzing: true,
          analysis: undefined,
          analysisError: undefined,
          validationStatus: undefined,
          validationMessage: undefined
        };
      });
      onChange?.(next);
      return next;
    });
    void runAnalysis(kind, payload.blob, payload.previewUrl);
  };

  const runAnalysis = async (kind: CommerceImageKind, blob: Blob, expectedPreviewUrl: string) => {
    try {
      const analysis = await analyzeImage(blob, kind);
      setItems((prev) => {
        const next = prev.map((item) => {
          if (item.kind !== kind || item.previewUrl !== expectedPreviewUrl) return item;
          const isValid = analysis.expectedTypeProbability >= 90;
          const validationStatus: 'VALIDO' | 'REVISAR' = isValid ? 'VALIDO' : 'REVISAR';
          return {
            ...item,
            analyzing: false,
            analysis,
            analysisError: undefined,
            validationStatus,
            validationMessage: isValid ? 'Imagen válida para el tipo solicitado.' : `Esta imagen no corresponde a ${item.label.toLowerCase()}.`
          };
        });
        onChange?.(next);
        return next;
      });
    } catch {
      setItems((prev) => {
        const next = prev.map((item) => {
          if (item.kind !== kind || item.previewUrl !== expectedPreviewUrl) return item;
          return {
            ...item,
            analyzing: false,
            analysisError: 'No se pudo analizar la imagen.',
            validationStatus: 'REVISAR' as const,
            validationMessage: `Esta imagen no corresponde a ${item.label.toLowerCase()}.`
          };
        });
        onChange?.(next);
        return next;
      });
    }
  };

  const clearItem = (kind: CommerceImageKind) => {
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.kind !== kind) return item;
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return {
          ...item,
          blob: undefined,
          file: undefined,
          previewUrl: undefined,
          error: undefined,
          analyzing: false,
          analysis: undefined,
          analysisError: undefined,
          validationStatus: undefined,
          validationMessage: undefined
        };
      });
      onChange?.(next);
      return next;
    });
  };

  const capturePhoto = async (kind: CommerceImageKind) => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    const file = new File([blob], `${kind}-${Date.now()}.jpg`, { type: 'image/jpeg' });
    assignItem(kind, { blob, file, previewUrl: URL.createObjectURL(blob) });
    stopCamera();
  };

  const allRequiredPresent = items.every((item) => Boolean(item.file));
  const allValidated = items.every((item) => item.validationStatus === 'VALIDO');

  return (
    <section
      className={`space-y-3 rounded-xl border bg-white p-6 shadow-soft ${
        highlightMissing ? 'border-red-400 ring-1 ring-red-200' : 'border-ubii-border'
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ubii-black">Imagenes del comercio *</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            !allRequiredPresent ? 'bg-gray-100 text-gray-700' : allValidated ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {!allRequiredPresent ? 'Pendiente' : allValidated ? 'Validado' : 'Revisar'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.kind}
            className={`space-y-2 rounded-xl border bg-ubii-light p-4 ${
              highlightMissing && !item.file ? 'border-red-400 ring-1 ring-red-200' : 'border-ubii-border'
            }`}
          >
            <p className="text-sm font-semibold text-ubii-black">{item.label}</p>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton className="px-3 py-2 text-xs" onClick={() => startCamera(item.kind)}>
                Tomar foto
              </PrimaryButton>
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-ubii-border bg-white px-3 py-2 text-xs font-semibold text-ubii-black">
                Subir archivo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    assignItem(item.kind, { blob: file, file, previewUrl: URL.createObjectURL(file) });
                  }}
                />
              </label>
            </div>
            {activeCamera === item.kind ? (
              <div className="space-y-2 rounded-xl border border-ubii-border bg-white p-3">
                <p className="text-xs font-semibold text-ubii-black">Cámara activa</p>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="mx-auto w-full max-w-xs rounded-xl bg-black object-cover aspect-[3/4]"
                />
                <div className="flex gap-2">
                  <PrimaryButton className="px-3 py-2 text-sm" onClick={() => void capturePhoto(activeCamera)}>
                    Capturar
                  </PrimaryButton>
                  <PrimaryButton className="px-3 py-2 text-sm" onClick={stopCamera}>
                    Cancelar
                  </PrimaryButton>
                </div>
              </div>
            ) : null}
            {item.previewUrl ? (
              <div className="relative">
                <img src={item.previewUrl} alt={`Preview ${item.label}`} className="h-40 w-full rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => clearItem(item.kind)}
                  className="absolute right-2 top-2 rounded-full border border-ubii-border bg-white px-2 py-0.5 text-xs font-bold text-gray-700"
                  aria-label={`Eliminar ${item.label}`}
                  title="Eliminar adjunto"
                >
                  x
                </button>
              </div>
            ) : null}

            {item.analyzing ? (
              <div className="rounded-lg border border-ubii-blue/30 bg-white p-3 text-sm text-ubii-black">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ubii-blue border-t-transparent" />
                  Analizando imagen...
                </p>
              </div>
            ) : null}

            {item.analysis ? (
              <div className="space-y-2 rounded-lg border border-ubii-border bg-white p-3 text-xs text-ubii-black">
                <p>
                  <span className="font-semibold">Descripción IA:</span> {item.analysis.description}
                </p>
                <p>
                  <span className="font-semibold">Tipo esperado:</span> {item.label} ({item.analysis.expectedTypeProbability}%)
                </p>
                <p>
                  <span className="font-semibold">Probabilidad IA-generada:</span> {item.analysis.aiGeneratedProbability}%
                </p>
                {item.analysis.warnings.map((warning) => (
                  <AlertBanner key={`${item.kind}-${warning}`} type="warning">
                    {warning}
                  </AlertBanner>
                ))}
                {item.validationMessage ? (
                  <AlertBanner type={item.validationStatus === 'VALIDO' ? 'success' : 'error'}>{item.validationMessage}</AlertBanner>
                ) : null}
              </div>
            ) : null}

            {item.analysisError ? <AlertBanner type="error">{item.analysisError}</AlertBanner> : null}
          </article>
        ))}
      </div>

      {cameraError ? <p className="text-xs text-amber-700">{cameraError}</p> : null}
    </section>
  );
}
