import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './Button';
import type { CapturedMedia, ValidationItemResult } from '../types/onboarding';
import { formatBytes } from '../utils/format';
import { ValidationResults } from './ValidationResults';

type LivenessCaptureProps = {
  selfie?: CapturedMedia;
  shortVideo?: CapturedMedia;
  gestureDone: boolean;
  onChange: (payload: { selfie?: CapturedMedia; shortVideo?: CapturedMedia; gestureDone: boolean }) => void;
  validationLoading?: boolean;
  validationResult?: ValidationItemResult;
  validationDetails?: { label: string; value: string }[];
};

const gestures = ['Mira al frente', 'Parpadea lentamente', 'Gira la cara a la derecha'];

export function LivenessCapture({
  selfie,
  shortVideo,
  gestureDone,
  onChange,
  validationLoading = false,
  validationResult,
  validationDetails
}: LivenessCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [gestureStep, setGestureStep] = useState(0);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {
      setError('No se pudo reproducir la camara frontal.');
    });
  }, [isOpen]);

  const canRecord = useMemo(() => typeof MediaRecorder !== 'undefined', []);

  const openCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Tu navegador no soporta liveness en vivo.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: canRecord
      });
      streamRef.current = stream;
      setIsOpen(true);
    } catch {
      setError('Permiso de camara denegado para selfie de vida.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsOpen(false);
    setRecording(false);
  };

  const captureSelfie = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;

    onChange({
      selfie: {
        blob,
        previewUrl: URL.createObjectURL(blob),
        mimeType: blob.type,
        size: blob.size,
        capturedAt: new Date().toISOString()
      },
      shortVideo,
      gestureDone
    });
  };

  const recordShortVideo = async () => {
    if (!streamRef.current || !canRecord) return;
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      onChange({
        selfie,
        shortVideo: {
          blob,
          previewUrl: URL.createObjectURL(blob),
          mimeType: blob.type,
          size: blob.size,
          capturedAt: new Date().toISOString()
        },
        gestureDone
      });
      setRecording(false);
    };

    setRecording(true);
    recorder.start();
    setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, 2500);
  };

  const completeGesture = () => {
    if (gestureStep < gestures.length - 1) {
      setGestureStep((prev) => prev + 1);
      return;
    }
    onChange({ selfie, shortVideo, gestureDone: true });
  };

  return (
    <div className="space-y-3 rounded-xl border border-borderSoft bg-white p-4">
      <h3 className="text-base font-semibold text-textMain">Prueba de vida (selfie en vivo)</h3>
      <p className="text-sm text-gray-600">Debes usar la camara en este momento. No se permite subir imagen de galeria.</p>

      {error ? <p className="rounded-md bg-rose-50 p-2 text-xs text-rose-700">{error}</p> : null}

      {!isOpen ? (
        <Button type="button" variant="outline" onClick={openCamera}>
          Iniciar camara frontal
        </Button>
      ) : (
        <div className="space-y-3">
          <video ref={videoRef} className="h-56 w-full rounded-lg bg-black object-cover sm:h-72" muted playsInline autoPlay />
          <div className="rounded-lg bg-bgSoft p-3">
            <p className="text-xs font-semibold text-primary">Gesto guiado:</p>
            <p className="text-sm text-textMain">{gestures[gestureStep]}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={captureSelfie}>
              Capturar selfie
            </Button>
            {canRecord ? (
              <Button type="button" variant="outline" onClick={recordShortVideo} disabled={recording}>
                {recording ? 'Grabando 2-3s...' : 'Grabar video corto'}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={completeGesture}>
              Marcar paso de gesto
            </Button>
            <Button type="button" variant="ghost" onClick={stopCamera}>
              Cerrar camara
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-borderSoft bg-bgSoft p-3">
          <p className="text-xs font-semibold text-gray-700">Selfie</p>
          {selfie ? (
            <>
              <img src={selfie.previewUrl} alt="Selfie liveness" className="mt-2 h-24 w-full rounded-md object-cover" />
              <p className="mt-1 text-xs text-gray-500">{selfie.mimeType} · {formatBytes(selfie.size)}</p>
            </>
          ) : (
            <p className="mt-2 text-xs text-gray-500">Pendiente</p>
          )}
        </div>

        <div className="rounded-lg border border-borderSoft bg-bgSoft p-3">
          <p className="text-xs font-semibold text-gray-700">Video corto (opcional)</p>
          {shortVideo ? (
            <>
              <video src={shortVideo.previewUrl} className="mt-2 h-24 w-full rounded-md object-cover" controls />
              <p className="mt-1 text-xs text-gray-500">{shortVideo.mimeType} · {formatBytes(shortVideo.size)}</p>
            </>
          ) : (
            <p className="mt-2 text-xs text-gray-500">No capturado</p>
          )}
        </div>
      </div>

      <p className={`text-sm font-medium ${gestureDone ? 'text-emerald-700' : 'text-amber-700'}`}>
        Estado gesto: {gestureDone ? 'Completado' : 'Pendiente'}
      </p>

      <ValidationResults
        title="Resultado biometrico"
        loading={validationLoading}
        loadingText="Ejecutando validacion biometrica..."
        result={validationResult}
        details={validationDetails}
      />
    </div>
  );
}
