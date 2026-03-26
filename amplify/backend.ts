import { defineBackend } from '@aws-amplify/backend';
import { CfnPermission, CfnUrl } from 'aws-cdk-lib/aws-lambda';
import { nombreFuncion } from './functions/nombre_funcion/resource';
import { nuevaFuncion } from './functions/nueva_funcion/resource';
import { idpIdentity } from './functions/idp_identity/resource';

const backend = defineBackend({
  nombreFuncion,
  nuevaFuncion,
  idpIdentity
});

const idpIdentityUrl = new CfnUrl(backend.idpIdentity.resources.lambda.stack, 'IdpIdentityFunctionUrl', {
  targetFunctionArn: backend.idpIdentity.resources.lambda.functionArn,
  authType: 'NONE',
  cors: {
    allowCredentials: false,
    allowHeaders: ['content-type', 'authorization'],
    allowMethods: ['POST', 'OPTIONS'],
    allowOrigins: ['*'],
    maxAge: 86400
  }
});

new CfnPermission(backend.idpIdentity.resources.lambda.stack, 'IdpIdentityFunctionUrlPermission', {
  action: 'lambda:InvokeFunctionUrl',
  functionName: backend.idpIdentity.resources.lambda.functionName,
  functionUrlAuthType: 'NONE',
  principal: '*'
});

backend.addOutput({
  custom: {
    idpIdentityFunctionUrl: idpIdentityUrl.attrFunctionUrl
  }
});
