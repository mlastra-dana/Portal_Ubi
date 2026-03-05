import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './Button';
import { formatBytes } from '../utils/format';
import type { CapturedMedia, ValidationItemResult } from '../types/onboarding';
import { ValidationResults } from './ValidationResults';

type CameraCaptureProps = {
  title: string;
  description: string;
  onCaptured: (media: CapturedMedia) => void;
  current?: CapturedMedia;
  validationLoading?: boolean;
  validationResult?: ValidationItemResult;
  validationDetails?: { label: string; value: string }[];
};

export function CameraCapture({
  title,
  description,
  onCaptured,
  current,
  validationLoading = false,
  validationResult,
  validationDetails
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {
      setError('No se pudo reproducir la camara. Intenta nuevamente.');
    });
  }, [isOpen]);

  const meta = useMemo(() => {
    if (!current) return null;
    return `${current.mimeType || 'image/jpeg'} · ${formatBytes(current.size)}`;
  }, [current]);

  const openCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Tu navegador no soporta acceso a camara en vivo.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      setIsOpen(true);
    } catch {
      setError('No se pudo abrir la camara. Revisa permisos del navegador.');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsOpen(false);
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;

    const previewUrl = URL.createObjectURL(blob);
    onCaptured({
      blob,
      previewUrl,
      mimeType: blob.type,
      size: blob.size,
      capturedAt: new Date().toISOString()
    });
    closeCamera();
  };

  return (
    <div className="rounded-xl border border-borderSoft bg-white p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-textMain">{title}</h4>
        <p className="text-xs text-gray-500">{description}</p>
      </div>

      {error ? <p className="mb-3 rounded-md bg-rose-50 p-2 text-xs text-rose-700">{error}</p> : null}

      {!isOpen ? (
        <Button type="button" variant="outline" onClick={openCamera}>
          Abrir camara
        </Button>
      ) : null}

      {isOpen ? (
        <div className="space-y-3">
          <video ref={videoRef} className="h-48 w-full rounded-lg bg-black object-cover sm:h-64" playsInline muted autoPlay />
          <div className="flex gap-2">
            <Button type="button" onClick={takePhoto}>
              Tomar foto
            </Button>
            <Button type="button" variant="ghost" onClick={closeCamera}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {current ? (
        <div className="mt-3 rounded-lg border border-borderSoft bg-bgSoft p-2">
          <img src={current.previewUrl} alt={`Captura ${title}`} className="h-40 w-full rounded-md object-cover" />
          <p className="mt-2 text-xs text-gray-600">{meta}</p>
          <p className="text-xs text-primary">Captura en vivo obligatoria (sin galeria).</p>
        </div>
      ) : null}

      <div className="mt-3">
        <ValidationResults
          title="Resultado IA"
          loading={validationLoading}
          loadingText="Analizando imagen..."
          result={validationResult}
          details={validationDetails}
        />
      </div>
    </div>
  );
}
