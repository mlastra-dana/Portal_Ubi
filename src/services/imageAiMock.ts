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

const qualityFromSize = (size: number): number => {
  if (size < 50_000) return 58;
  if (size < 120_000) return 72;
  if (size < 300_000) return 84;
  return 92;
};

export const analyzeImage = async (blob: Blob, kind: ImageKind): Promise<ImageAnalysis> => {
  await sleep(900 + Math.random() * 900);

  const sample = new Uint8Array(await blob.slice(0, 20_000).arrayBuffer());
  const hash = hashBytes(sample) ^ blob.size;
  const qualityScore = qualityFromSize(blob.size);
  const variation = (hash % 11) - 5;

  const expectedTypeProbability = clamp(qualityScore + 6 + variation, 55, 99);
  const aiGeneratedProbability = clamp(((hash >> 3) % 55) + (qualityScore < 75 ? 18 : 4), 0, 95);

  const warnings: string[] = [];
  if (expectedTypeProbability < 90) warnings.push('Probabilidad baja de que sea la foto solicitada');
  if (aiGeneratedProbability > 60) warnings.push('Posible imagen generada por IA');
  if (qualityScore < 70) warnings.push('Calidad de imagen baja, considera repetir la captura');

  return {
    kind,
    description: descriptions[kind][hash % descriptions[kind].length],
    expectedTypeProbability,
    aiGeneratedProbability,
    warnings
  };
};
