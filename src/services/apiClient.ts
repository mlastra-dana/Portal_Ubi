import type { ValidationResponse } from '../types/onboarding';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim();

const postJson = async <T>(path: string, payload: unknown): Promise<T> => {
  if (!API_BASE_URL) {
    throw new Error('MOCK_MODE');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const apiClient = {
  useMock: !API_BASE_URL,
  validateDocument: (payload: unknown) => postJson<ValidationResponse>('/validate/document', payload),
  validatePhoto: (payload: unknown) => postJson<ValidationResponse>('/validate/photo', payload),
  validateLiveness: (payload: unknown) => postJson<ValidationResponse>('/validate/liveness', payload)
};
