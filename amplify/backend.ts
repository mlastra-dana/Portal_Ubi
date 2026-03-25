import { defineBackend } from '@aws-amplify/backend';
import { nombreFuncion } from './functions/nombre_funcion/resource';

defineBackend({
  nombreFuncion
});

