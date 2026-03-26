import { defineFunction } from '@aws-amplify/backend';

export const idpIdentity = defineFunction({
  name: 'idp_identity',
  entry: './handler.ts',
  timeoutSeconds: 15,
  memoryMB: 512,
  environment: {
    LOG_LEVEL: 'info'
  }
});
