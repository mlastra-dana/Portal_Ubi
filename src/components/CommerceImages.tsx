import { useEffect, useRef, useState } from 'react';
import { PrimaryButton } from './ui/PrimaryButton';
import type { CommerceImageItem, CommerceImageKind } from '../types/recaudos';

type Props = {
  onChange?: (items: CommerceImageItem[]) => void;
};

const initialItems: CommerceImageItem[] = [
  { kind: 'fachada', label: 'Fachada' },
  { kind: 'interior', label: 'Interior' },
  { kind: 'inventario', label: 'Inventario' }
];

export function CommerceImages({ onChange }: Props) {
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
        return { ...item, blob: payload.blob, file: payload.file, previewUrl: payload.previewUrl, error: undefined };
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

  return (
    <section className="space-y-3 rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ubii-black">Imagenes del comercio *</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${allRequiredPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
          {allRequiredPresent ? 'Completado' : 'Pendiente'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <article key={item.kind} className="space-y-2 rounded-xl border border-ubii-border bg-ubii-light p-4">
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
            {item.previewUrl ? <img src={item.previewUrl} alt={`Preview ${item.label}`} className="h-40 w-full rounded-xl object-cover" /> : null}
          </article>
        ))}
      </div>

      {activeCamera ? (
        <div className="space-y-2 rounded-xl border border-ubii-border bg-ubii-light p-4">
          <p className="text-sm font-semibold text-ubii-black">Camara activa para {activeCamera}</p>
          <video ref={videoRef} autoPlay playsInline muted className="h-56 w-full rounded-xl bg-black object-cover" />
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

      {cameraError ? <p className="text-xs text-amber-700">{cameraError}</p> : null}
    </section>
  );
}
