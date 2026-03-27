import { defineFunction } from '@aws-amplify/backend';

export const idpIdentity = defineFunction({
  name: 'idp_identity',
  entry: './handler.ts',
  timeoutSeconds: 240,
  memoryMB: 1024,
  environment: {
    LOG_LEVEL: 'info'
  }
});
