import { useEffect, useRef, useState } from 'react';
import type { ImageKind } from '../types/onboarding';

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
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('capture')}
            className={`rounded-lg px-3 py-1 text-xs ${mode === 'capture' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-200'}`}
          >
            Tomar foto
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('upload');
              stopCamera();
            }}
            className={`rounded-lg px-3 py-1 text-xs ${mode === 'upload' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-200'}`}
          >
            Subir archivo
          </button>
        </div>
      </div>

      {mode === 'capture' ? (
        <div className="space-y-2">
          {!openCamera ? (
            <button type="button" onClick={startCamera} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
              Abrir camara
            </button>
          ) : (
            <div className="space-y-2">
              <video ref={videoRef} className="h-56 w-full rounded-xl bg-black object-cover" autoPlay playsInline muted />
              <div className="flex gap-2">
                <button type="button" onClick={takePhoto} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
                  Capturar {kind}
                </button>
                <button type="button" onClick={stopCamera} className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white">
                  Cancelar
                </button>
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
          className="block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white"
        />
      )}

      {error ? <p className="text-xs text-amber-200">{error}</p> : null}
    </div>
  );
}
