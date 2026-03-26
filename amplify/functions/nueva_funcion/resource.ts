import { defineFunction } from '@aws-amplify/backend';

export const nuevaFuncion = defineFunction({
  name: 'nueva_funcion',
  entry: './handler.ts',
  timeoutSeconds: 15,
  memoryMB: 512,
  environment: {
    LOG_LEVEL: 'info'
  }
});
