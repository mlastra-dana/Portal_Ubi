import { sleep } from '../utils/sleep';
import type { ImageAnalysis, ImageKind } from '../types/onboarding';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const hashBytes = (bytes: Uint8Array): number => {
  let hash = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    hash = (hash * 31 + bytes[i]) >>> 0;
  }
  return hash;
};

const descriptions: Record<ImageKind, string[]> = {
  fachada: ['Fachada de comercio con acceso peatonal visible', 'Frente del local con entrada principal y señalizacion'],
  interior: ['Zona interna del comercio con area de atencion', 'Interior operativo del local con espacio utilizable'],
  inventario: ['Estanterias con productos almacenados', 'Area de inventario con mercancia organizada']
};

const fallbackDescriptionByKind: Record<ImageKind, string> = {
  fachada: 'Fachada del comercio capturada.',
  interior: 'Interior del comercio capturado.',
  inventario: 'Área de inventario capturada.'
};

const peopleWarningByKind: Record<ImageKind, string> = {
  fachada: 'Fachada con personas detectadas; debe tomarse sin personas',
  interior: 'Interior con personas detectadas; debe tomarse sin personas',
  inventario: 'Inventario con personas detectadas; debe tomarse sin personas'
};

const genericSceneDescriptions = [
  'Persona en primer plano en ambiente no comercial',
  'Escena interior sin evidencia clara de comercio',
  'Imagen de uso personal sin contexto de local',
  'Espacio general sin elementos suficientes del tipo solicitado'
];

const facadeWithPeopleDescriptions = [
  'Fachada del comercio visible, con personas en primer plano',
  'Frente del local identificado, aunque hay personas tapando parte de la entrada',
  'Vista de fachada comercial con presencia de personas en la escena'
];

const qualityFromSize = (size: number): number => {
  if (size < 50_000) return 58;
  if (size < 120_000) return 72;
  if (size < 300_000) return 84;
  return 92;
};

const detectFaces = async (blob: Blob): Promise<number> => {
  if (typeof window === 'undefined' || !('FaceDetector' in window)) return 0;
  try {
    const detector = new (window as typeof window & { FaceDetector: new () => { detect: (source: ImageBitmap) => Promise<unknown[]> } }).FaceDetector();
    const bitmap = await createImageBitmap(blob);
    try {
      const faces = await detector.detect(bitmap);
      return faces.length;
    } finally {
      bitmap.close();
    }
  } catch {
    return 0;
  }
};

export const analyzeImage = async (blob: Blob, kind: ImageKind): Promise<ImageAnalysis> => {
  await sleep(900 + Math.random() * 900);

  const sample = new Uint8Array(await blob.slice(0, 20_000).arrayBuffer());
  const hash = hashBytes(sample) ^ blob.size;
  const qualityScore = qualityFromSize(blob.size);
  const variation = (hash % 11) - 5;
  const faceCount = await detectFaces(blob);

  const expectedTypeBase = qualityScore + 10 + variation + (kind === 'fachada' ? 4 : 0);
  let expectedTypeProbability = clamp(faceCount > 0 ? expectedTypeBase - 42 : expectedTypeBase, 10, 99);
  const aiGeneratedProbability = clamp(((hash >> 3) % 55) + (qualityScore < 75 ? 18 : 4), 0, 95);

  const warnings: string[] = [];
  if (expectedTypeProbability < 75) warnings.push('Probabilidad baja de que sea la foto solicitada');
  if (aiGeneratedProbability > 60) warnings.push('Posible imagen generada por IA');
  if (qualityScore < 70) warnings.push('Calidad de imagen baja, considera repetir la captura');
  if (faceCount > 0) {
    warnings.push(peopleWarningByKind[kind]);
    expectedTypeProbability = clamp(expectedTypeProbability - 30 - (kind === 'fachada' ? 10 : 0), 10, 99);
  }

  const descriptionPool =
    faceCount > 0 ? (kind === 'fachada' ? facadeWithPeopleDescriptions : genericSceneDescriptions) : descriptions[kind];
  const description =
    descriptionPool[descriptionPool.length ? hash % descriptionPool.length : 0] ?? fallbackDescriptionByKind[kind];

  return {
    kind,
    description,
    expectedTypeProbability,
    aiGeneratedProbability,
    warnings
  };
};
