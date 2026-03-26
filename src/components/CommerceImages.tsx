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
  highlightNoMatch?: boolean;
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
  inventario: 'Debe mostrar productos, mercancía o stock del negocio'
};

export function CommerceImages({ onChange, highlightMissing = false, highlightNoMatch = false, className = '' }: Props) {
  const [items, setItems] = useState<CommerceImageItem[]>(initialItems);
  const [activeCamera, setActiveCamera] = useState<CommerceImageKind | null>(null);
  const [activeModeByKind, setActiveModeByKind] = useState<Record<CommerceImageKind, 'camera' | 'upload' | null>>({
    fachada: null,
    interior: null,
    inventario: null
  });
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
    stopCamera();
    setActiveModeByKind((prev) => ({ ...prev, [kind]: 'camera' }));
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setActiveCamera(kind);
    } catch {
      setActiveModeByKind((prev) => ({ ...prev, [kind]: null }));
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
    setActiveModeByKind((prev) => ({ ...prev, [kind]: null }));
    stopCamera();
  };

  const openUpload = (kind: CommerceImageKind) => {
    stopCamera();
    setCameraError('');
    setActiveModeByKind((prev) => ({ ...prev, [kind]: 'upload' }));
  };

  const cancelMode = (kind: CommerceImageKind) => {
    if (activeCamera === kind) {
      stopCamera();
    }
    setActiveModeByKind((prev) => ({ ...prev, [kind]: null }));
  };

  const allRequiredPresent = items.every((item) => Boolean(item.file));
  const allLooksGood = items.every((item) => {
    if (!item.analysis) return false;
    return item.analysis.validationResult === 'VALIDADA';
  });

  return (
    <section
      className={`space-y-5 rounded-2xl border bg-white p-6 shadow-soft ${
        highlightMissing ? 'border-red-400 ring-1 ring-red-200' : 'border-ubii-border'
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-[#111111]">Imágenes del comercio *</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            !allRequiredPresent ? 'bg-gray-100 text-gray-700' : allLooksGood ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {!allRequiredPresent ? 'Pendiente' : allLooksGood ? 'Validado' : 'Revisar'}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.kind}
            className={`space-y-4 rounded-2xl border bg-[#F5F9FD] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              highlightMissing && !item.file
                ? 'border-red-400 ring-1 ring-red-200'
                : highlightNoMatch && item.analysis?.validationResult === 'NO COINCIDE'
                ? 'border-red-400 ring-1 ring-red-200'
                : 'border-ubii-border'
            }`}
          >
            <div className="space-y-1">
              <p className="text-lg font-semibold text-[#111111]">{item.label}</p>
              <p className="text-xs text-gray-600">{slotHelpTextByKind[item.kind]}</p>
            </div>
            {activeModeByKind[item.kind] === null ? (
              <div className="flex flex-wrap gap-2">
                <PrimaryButton
                  className="!h-10 !rounded-xl !border-[#4B98CB] !bg-[#4B98CB] !px-4 !py-2 !text-xs hover:!border-[#3E86B6] hover:!bg-[#3E86B6]"
                  onClick={() => void startCamera(item.kind)}
                >
                  Tomar foto
                </PrimaryButton>
                <PrimaryButton
                  className="!h-10 !rounded-xl !border-gray-300 !bg-white !px-4 !py-2 !text-xs !text-[#111111] hover:!border-[#4B98CB]"
                  onClick={() => openUpload(item.kind)}
                >
                  Subir archivo
                </PrimaryButton>
              </div>
            ) : null}
            {activeModeByKind[item.kind] === 'upload' ? (
              <div className="space-y-2 rounded-xl border border-ubii-border bg-white p-4">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="block w-full rounded-lg border border-ubii-border bg-ubii-light px-3 py-2 text-sm text-ubii-black file:mr-3 file:rounded-md file:border-0 file:bg-ubii-blue file:px-3 file:py-1.5 file:text-white"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    assignItem(item.kind, { blob: file, file, previewUrl: URL.createObjectURL(file) });
                    setActiveModeByKind((prev) => ({ ...prev, [item.kind]: null }));
                    event.currentTarget.value = '';
                  }}
                />
                <PrimaryButton
                  className="!h-10 !rounded-xl !border-gray-300 !bg-white !px-4 !py-2 !text-sm !text-[#111111] hover:!border-[#4B98CB]"
                  onClick={() => cancelMode(item.kind)}
                >
                  Cancelar
                </PrimaryButton>
              </div>
            ) : null}
            {activeCamera === item.kind ? (
              <div className="space-y-3 rounded-xl border border-ubii-border bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cámara activa</p>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="mx-auto aspect-[3/4] w-full max-w-xs rounded-xl bg-black object-cover"
                />
                <div className="flex gap-2">
                  <PrimaryButton
                    className="!h-10 !rounded-xl !border-[#4B98CB] !bg-[#4B98CB] !px-4 !py-2 !text-sm hover:!border-[#3E86B6] hover:!bg-[#3E86B6]"
                    onClick={() => void capturePhoto(activeCamera)}
                  >
                    Capturar
                  </PrimaryButton>
                  <PrimaryButton
                    className="!h-10 !rounded-xl !border-gray-300 !bg-white !px-4 !py-2 !text-sm !text-[#111111] hover:!border-[#4B98CB]"
                    onClick={() => cancelMode(item.kind)}
                  >
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
              onRemovePreview={item.previewUrl ? () => clearItem(item.kind) : undefined}
            />

            {item.analysisError ? <AlertBanner type="error">{item.analysisError}</AlertBanner> : null}
          </article>
        ))}
      </div>

      {cameraError ? <p className="text-xs text-amber-700">{cameraError}</p> : null}
    </section>
  );
}
