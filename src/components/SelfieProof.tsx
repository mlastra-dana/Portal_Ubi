import { useEffect, useRef, useState } from 'react';
import { PrimaryButton } from './ui/PrimaryButton';

type Props = {
  label?: string;
  onChange?: (payload?: { file: File; previewUrl: string }) => void;
  className?: string;
};

export function SelfieProof({ label = 'Prueba de vida (selfie)', onChange, className = '' }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play();
  }, [cameraOpen]);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setError('No se pudo abrir la cámara frontal.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const setSelfie = (file: File) => {
    const nextPreview = URL.createObjectURL(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(nextPreview);
    onChange?.({ file, previewUrl: nextPreview });
  };

  const clearSelfie = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(undefined);
    onChange?.(undefined);
  };

  const captureSelfie = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 720;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
    setSelfie(file);
    stopCamera();
  };

  return (
    <section className={`h-fit space-y-3 rounded-xl border border-ubii-border bg-white p-6 shadow-soft ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ubii-black">{label} *</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${previewUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
          {previewUrl ? 'Cargada' : 'Pendiente'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <PrimaryButton className="px-3 py-2 text-sm" onClick={startCamera}>
          Abrir cámara
        </PrimaryButton>
      </div>

      {cameraOpen ? (
        <div className="max-w-md space-y-2 rounded-xl border border-ubii-border bg-ubii-light p-4">
          <video ref={videoRef} autoPlay playsInline muted className="h-44 w-full rounded-xl bg-black object-cover" />
          <div className="flex gap-2">
            <PrimaryButton className="px-3 py-2 text-sm" onClick={() => void captureSelfie()}>
              Capturar
            </PrimaryButton>
            <PrimaryButton className="px-3 py-2 text-sm" onClick={stopCamera}>
              Cancelar
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      {previewUrl ? (
        <div className="relative w-fit">
          <img src={previewUrl} alt="Selfie prueba de vida" className="h-44 w-44 rounded-xl object-cover" />
          <button
            type="button"
            onClick={clearSelfie}
            className="absolute right-2 top-2 rounded-full border border-ubii-border bg-white px-2 py-0.5 text-xs font-bold text-gray-700"
            aria-label="Eliminar selfie"
            title="Eliminar adjunto"
          >
            x
          </button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-amber-700">{error}</p> : null}
    </section>
  );
}
