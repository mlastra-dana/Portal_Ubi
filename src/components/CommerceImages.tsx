import { useEffect, useRef, useState } from 'react';
import { PrimaryButton } from './ui/PrimaryButton';
import { AlertBanner } from './AlertBanner';
import { ImageValidationCard } from './ImageValidationCard';
import { analyzeBusinessImage } from '../services/imageValidation/imageAnalyzer';
import type { CommerceImageItem, CommerceImageKind } from '../types/recaudos';
import type { RequestedBusinessCategory } from '../services/imageValidation/types';

type Props = {
  onChange?: (items: CommerceImageItem[]) => void;
  highlightMissing?: boolean;
  className?: string;
};

const initialItems: CommerceImageItem[] = [
  { kind: 'fachada', label: 'Fachada' },
  { kind: 'interior', label: 'Interior de negocio' },
  { kind: 'inventario', label: 'Inventario de negocio' }
];

const buildAnalysisToken = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const requestedCategoryByKind: Record<CommerceImageKind, RequestedBusinessCategory> = {
  fachada: 'FACHADA',
  interior: 'INTERIOR',
  inventario: 'INVENTARIO'
};

const mismatchMessageByKind: Record<CommerceImageKind, string> = {
  fachada: 'La imagen no coincide con una fachada de negocio.',
  interior: 'La imagen no coincide con un interior de negocio.',
  inventario: 'La imagen no coincide con un inventario de negocio.'
};

const slotHelpTextByKind: Record<CommerceImageKind, string> = {
  fachada: 'Debe mostrar la parte exterior del comercio',
  interior: 'Debe mostrar el espacio interno del negocio',
  inventario: 'Debe mostrar productos, mercancia o stock del negocio'
};

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
    const analysisToken = buildAnalysisToken();
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.kind !== kind) return item;
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return {
          ...item,
          analysisToken,
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
    void runAnalysis(kind, payload.blob, payload.previewUrl, analysisToken);
  };

  const runAnalysis = async (kind: CommerceImageKind, blob: Blob, expectedPreviewUrl: string, analysisToken: string) => {
    try {
      const requestedCategory = requestedCategoryByKind[kind];
      const analysis = await analyzeBusinessImage(blob, requestedCategory);
      setItems((prev) => {
        const next = prev.map((item) => {
          if (item.kind !== kind || item.previewUrl !== expectedPreviewUrl || item.analysisToken !== analysisToken) return item;
          const validationMessage =
            analysis.validationResult === 'VALIDADA'
              ? 'La imagen corresponde con el tipo solicitado.'
              : analysis.validationResult === 'REVISAR'
              ? 'No se pudo confirmar con suficiente certeza que la imagen corresponda al tipo solicitado.'
              : analysis.mismatchReason === 'PERSONA_DETECTADA'
              ? mismatchMessageByKind[kind]
              : mismatchMessageByKind[kind];
          return {
            ...item,
            analyzing: false,
            analysis: {
              ...analysis,
              expectedTypeProbability: analysis.categoryProbability
            },
            analysisError: undefined,
            // El flujo no se bloquea por imagen; la revisión se comunica en la tarjeta.
            validationStatus: 'VALIDO' as const,
            validationMessage
          };
        });
        onChange?.(next);
        return next;
      });
    } catch {
      setItems((prev) => {
        const next = prev.map((item) => {
          if (item.kind !== kind || item.previewUrl !== expectedPreviewUrl || item.analysisToken !== analysisToken) return item;
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
          analysisToken: undefined,
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
  const allLooksGood = items.every((item) => {
    if (!item.analysis) return false;
    return item.analysis.validationResult === 'VALIDADA';
  });

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
            !allRequiredPresent ? 'bg-gray-100 text-gray-700' : allLooksGood ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {!allRequiredPresent ? 'Pendiente' : allLooksGood ? 'Validado' : 'Revisar'}
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
            <p className="text-xs text-gray-600">{slotHelpTextByKind[item.kind]}</p>
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
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {item.previewUrl ? (
                <button
                  type="button"
                  onClick={() => clearItem(item.kind)}
                  className="inline-flex items-center rounded-lg border border-ubii-border bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                  aria-label={`Eliminar ${item.label}`}
                  title="Eliminar adjunto"
                >
                  Eliminar imagen
                </button>
              ) : null}
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
            <ImageValidationCard
              previewUrl={item.previewUrl}
              requestedLabel={item.label}
              analyzing={item.analyzing}
              analysis={item.analysis}
              validationMessage={item.validationMessage}
            />

            {item.analysisError ? <AlertBanner type="error">{item.analysisError}</AlertBanner> : null}
          </article>
        ))}
      </div>

      {cameraError ? <p className="text-xs text-amber-700">{cameraError}</p> : null}
    </section>
  );
}
