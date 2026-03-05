import type { CapturedMedia } from '../types/onboarding';
import { sleep } from '../utils/sleep';
import { clamp } from '../utils/format';

export type BiometricAiResult = {
  faceMatchScore: number;
  livenessResult: 'PASS' | 'REVIEW' | 'FAIL';
  confidence: number;
};

const randomBetween = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

export const simulateBiometricValidation = async (selfie: CapturedMedia, gestureDone: boolean): Promise<BiometricAiResult> => {
  await sleep(1000 + Math.random() * 900);

  const faceMatchScore = clamp(randomBetween(70, 97) - (selfie.size < 45_000 ? 14 : 0), 35, 99);
  const confidence = clamp(randomBetween(75, 98), 55, 99);

  let livenessResult: BiometricAiResult['livenessResult'] = 'PASS';
  if (!gestureDone || faceMatchScore < 70) livenessResult = 'REVIEW';
  if (faceMatchScore < 55) livenessResult = 'FAIL';

  return {
    faceMatchScore,
    livenessResult,
    confidence
  };
};
