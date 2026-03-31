# Portal Ubi

Frontend de onboarding para recaudos de Persona Natural / Jurídica.

## Arquitectura actual (fuente única)

La aplicación usa **una sola Lambda (Function URL)** como backend de validación.
El frontend:
1. Envía archivo (base64 + metadatos) a la Lambda.
2. Consume JSON estructurado.
3. Renderiza resultados y autocompleta campos solo con ese JSON.

No se usa OCR local como fuente de verdad para datos importantes.

## Contrato de documentos (principal)

La Lambda responde (resumen):

```json
{
  "expectedDocumentType": "",
  "documentTypeDetected": "",
  "isValidForSlot": true,
  "slotValidationReason": "",
  "fileKindDetected": "image|pdf",
  "isExtractionPerformed": true,
  "fields": {
    "nombres": "",
    "apellidos": "",
    "numeroIdentificacion": "",
    "fechaVencimiento": "",
    "razonSocial": ""
  },
  "fieldStatus": {
    "nombres": "detected|not_detected|not_applicable",
    "apellidos": "detected|not_detected|not_applicable",
    "numeroIdentificacion": "detected|not_detected|not_applicable",
    "fechaVencimiento": "detected|not_detected|not_applicable",
    "razonSocial": "detected|not_detected|not_applicable"
  },
  "warnings": [],
  "expiryAlert": false,
  "ocrTextPreview": "",
  "legacyFields": {},
  "confidence": {}
}
```

Regla del frontend:
- Solo mapea campos importantes desde `fields` + `fieldStatus`.
- No reconstruye nombres/IDs desde `ocrTextPreview`.

## Contrato de imágenes de negocio

La misma Lambda valida `FACHADA`, `INTERIOR`, `INVENTARIO`.

Respuesta esperada:

```json
{
  "requestedCategory": "FACHADA|INTERIOR|INVENTARIO",
  "validationResult": "VALIDADA|REVISAR|NO_COINCIDE",
  "description": "",
  "categoryProbability": 0,
  "mismatchReason": "PERSONA_DETECTADA|OTRA_CATEGORIA|IMAGEN_AMBIGUA|CALIDAD_BAJA|CONTENIDO_IRRELEVANTE|null",
  "warnings": []
}
```

El frontend muestra:
- Estado de validación.
- `% coincidencia`.
- `% prob. IA` solo si el backend lo incluye en la respuesta.
- Warnings.

## Variables de entorno

Usa el mismo nombre de siempre:

```bash
VITE_IDP_LAMBDA_URL=https://<tu-function-url>.lambda-url.us-east-1.on.aws/
```

## Desarrollo

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Flujo funcional (resumen)

1. Usuario sube documento o imagen.
2. Frontend llama Lambda.
3. Backend valida y responde JSON estructurado.
4. Frontend renderiza:
   - Documento válido / revisar
   - Datos extraídos
   - Alertas (incluyendo vencimiento como warning)
   - Validación de imágenes de negocio

## Notas de compatibilidad

- `legacyFields` se tolera como fallback temporal para transición.
- La prioridad de lectura siempre es el contrato nuevo en `fields`.
