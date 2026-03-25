import { defineFunction } from '@aws-amplify/backend';

export const nombreFuncion = defineFunction({
  name: 'nombre_funcion',
  entry: './handler.ts',
  timeoutSeconds: 15,
  memoryMB: 512,
  environment: {
    LOG_LEVEL: 'info'
  }
});

