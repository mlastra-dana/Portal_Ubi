import { useEffect, useRef, useState } from 'react';
import { PrimaryButton } from './ui/PrimaryButton';

type Props = {
  label?: string;
  onChange?: (payload?: { file: File; previewUrl: string }) => void;
};

export function SelfieProof({ label = 'Prueba de vida (selfie)', onChange }: Props) {
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
    <section className="space-y-3 rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ubii-black">{label} *</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${previewUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
          {previewUrl ? 'Cargada' : 'Pendiente'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <PrimaryButton className="px-3 py-2 text-sm" onClick={startCamera}>
          Tomar selfie
        </PrimaryButton>
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-ubii-border bg-white px-3 py-2 text-sm font-semibold text-ubii-black">
          Subir selfie
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setSelfie(file);
            }}
          />
        </label>
      </div>

      {cameraOpen ? (
        <div className="space-y-2 rounded-xl border border-ubii-border bg-ubii-light p-4">
          <video ref={videoRef} autoPlay playsInline muted className="h-56 w-full rounded-xl bg-black object-cover" />
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

      {previewUrl ? <img src={previewUrl} alt="Selfie prueba de vida" className="h-44 w-44 rounded-xl object-cover" /> : null}
      {error ? <p className="text-xs text-amber-700">{error}</p> : null}
    </section>
  );
}
