export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const randomRegistrationNumber = (): string => {
  const suffix = Math.floor(Math.random() * 900000 + 100000);
  return `UBII-${new Date().getFullYear()}-${suffix}`;
};

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
