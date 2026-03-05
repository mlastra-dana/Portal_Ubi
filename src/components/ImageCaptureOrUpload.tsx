import { useEffect, useRef, useState } from 'react';
import type { ImageKind } from '../types/onboarding';
import { PrimaryButton } from './ui/PrimaryButton';

type Props = {
  kind: ImageKind;
  label: string;
  onSelect: (payload: { blob: Blob; previewUrl: string }) => void;
};

export function ImageCaptureOrUpload({ kind, label, onSelect }: Props) {
  const [mode, setMode] = useState<'capture' | 'upload'>('capture');
  const [openCamera, setOpenCamera] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!openCamera || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {
      setError('No se pudo reproducir la camara.');
    });
  }, [openCamera]);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setOpenCamera(true);
    } catch {
      setError('Permiso de camara no disponible. Puedes usar subir archivo.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setOpenCamera(false);
  };

  const takePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    const previewUrl = URL.createObjectURL(blob);
    onSelect({ blob, previewUrl });
    stopCamera();
  };

  return (
    <div className="space-y-3 rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ubii-black">{label}</p>
        <div className="flex gap-2">
          <PrimaryButton
            onClick={() => setMode('capture')}
            className="px-3 py-1 text-xs"
          >
            Tomar foto
          </PrimaryButton>
          <PrimaryButton
            onClick={() => {
              setMode('upload');
              stopCamera();
            }}
            className="px-3 py-1 text-xs"
          >
            Subir archivo
          </PrimaryButton>
        </div>
      </div>

      {mode === 'capture' ? (
        <div className="space-y-2">
          {!openCamera ? (
            <PrimaryButton onClick={startCamera} className="px-3 py-2 text-sm">
              Abrir camara
            </PrimaryButton>
          ) : (
            <div className="space-y-2">
              <video ref={videoRef} className="h-56 w-full rounded-xl bg-black object-cover" autoPlay playsInline muted />
              <div className="flex gap-2">
                <PrimaryButton onClick={takePhoto} className="px-3 py-2 text-sm">
                  Capturar {kind}
                </PrimaryButton>
                <PrimaryButton onClick={stopCamera} className="px-3 py-2 text-sm">
                  Cancelar
                </PrimaryButton>
              </div>
            </div>
          )}
        </div>
      ) : (
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            onSelect({ blob: file, previewUrl: URL.createObjectURL(file) });
          }}
          className="block w-full rounded-lg border border-ubii-border bg-ubii-light px-3 py-2 text-sm text-ubii-black file:mr-3 file:rounded-md file:border-0 file:bg-ubii-blue file:px-3 file:py-1.5 file:text-white"
        />
      )}

      {error ? <p className="text-xs text-amber-700">{error}</p> : null}
    </div>
  );
}
