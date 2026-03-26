import type { Handler } from 'aws-lambda';

type LambdaEvent = {
  httpMethod?: string;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
  body?: string | null;
  isBase64Encoded?: boolean;
};

const corsHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'OPTIONS,POST',
  'access-control-allow-headers': 'content-type,authorization'
};

const jsonResponse = (statusCode: number, payload: Record<string, unknown>) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(payload)
});

const getMethod = (event: LambdaEvent): string =>
  (event.requestContext?.http?.method || event.httpMethod || '').toUpperCase();

export const handler: Handler<LambdaEvent> = async (event) => {
  const method = getMethod(event);

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (method !== 'POST') {
    return jsonResponse(405, { message: 'Metodo no permitido. Usa POST.' });
  }

  try {
    const rawBody = event.body ?? '{}';
    const decodedBody = event.isBase64Encoded
      ? Buffer.from(rawBody, 'base64').toString('utf-8')
      : rawBody;
    const payload = JSON.parse(decodedBody) as Record<string, unknown>;

    // Base lógica: eco controlado del request. Reemplazar por lógica de negocio.
    return jsonResponse(200, {
      ok: true,
      function: 'nueva_funcion',
      receivedKeys: Object.keys(payload),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error no controlado';
    console.error('nueva_funcion_error', { message });
    return jsonResponse(500, {
      ok: false,
      message: 'No se pudo procesar la solicitud.'
    });
  }
};
