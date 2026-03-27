# Onboarding POS UbiiApp (Demo)

Demo frontend para onboarding POS con recaudos y OCR real:
- Modulo Persona Natural
- Modulo Persona Juridica
- OCR real en documentos (imagen/PDF, primera pagina)
- Captura/subida de imagenes del comercio

## Stack

- React + TypeScript + Vite
- TailwindCSS
- React Router
- tesseract.js
- pdfjs-dist

## Requisitos

- Node.js 18+
- npm 9+

## Ejecutar local

```bash
npm ci
npm run dev
```

## Build produccion

```bash
npm ci
npm run build
npm run preview
```

## Rutas

- `/` Landing
- `/demo` Intro demo
- `/onboarding` Recaudos
- `/recaudos` Recaudos
- `/done` Confirmacion y resumen

## Reglas de demo implementadas

- Dos modulos: Persona Natural y Persona Juridica
- OCR real al subir cada documento (PDF/JPG/PNG)
- Extraccion conservadora: Nombres, Numero de identificacion, Fecha de vencimiento
- Si no se detecta un campo: `NO DETECTADO`
- Alerta amarilla de "Cedula vencida" solo informativa (no bloquea)
- Solo faltantes obligatorios bloquean el estado del modulo

## AWS Amplify

- Build command: `npm ci && npm run build`
- Artifacts/output: `dist`
- Node recomendado: `18+`

### OCR en Produccion (Amplify)

- El worker de `pdfjs-dist` y el worker/core de `tesseract.js` ahora se empaquetan localmente en el build (sin imports CDN).
- Opcional para mayor control: define `VITE_TESSERACT_LANG_PATH` en Amplify para cargar idiomas desde una ruta propia (por ejemplo `/tessdata`).
- Si no defines `VITE_TESSERACT_LANG_PATH`, `tesseract.js` descargara `traineddata` desde jsDelivr.
- Si defines `VITE_TESSERACT_LANG_PATH` y esa ruta falla, el OCR hace fallback automatico al modo online.
- Opcional: define `VITE_IDP_LAMBDA_URL` para activar fallback IDP (Lambda) cuando nombres/apellidos no se puedan extraer bien con OCR local.

### Lambda IDP (Cédula/RIF)

- Archivo sugerido: `lambda/idp_ocr_handler.py`
- Runtime recomendado: `Python 3.11`
- Handler: `idp_ocr_handler.lambda_handler`
- Requiere permisos IAM en el role del Lambda:
  - `textract:DetectDocumentText`
  - `textract:StartDocumentTextDetection`
  - `textract:GetDocumentTextDetection`
  - `s3:PutObject`
  - `s3:GetObject`
  - `s3:DeleteObject`
- Activa Function URL en modo `POST` + CORS (ver seccion "CORS importante").
- Luego configura en Amplify Hosting:
  - `VITE_IDP_LAMBDA_URL=https://<tu-function-url>`

---

## Arquitectura OCR Actual (Estandar del proyecto)

Esta implementacion queda como referencia base para portales futuros:

- Frontend (Amplify) envia archivo en base64 al Lambda OCR.
- Lambda detecta tipo documental y valida si coincide con el slot esperado.
- Para `CEDULA` y `RIF` se ejecuta extraccion de datos (OCR).
- Para otros documentos (por ejemplo `ACTA_CONSTITUTIVA`) se valida tipo, sin extraccion pesada.
- Soporta imagenes y PDF:
  - Imagen: `DetectDocumentText` directo.
  - PDF: `StartDocumentTextDetection` async usando S3 temporal.

### Flujo funcional

1. Frontend envia:
   - `fileBase64`
   - `fileName`
   - `contentType`
   - `expectedDocumentType`
2. Lambda procesa OCR y responde:
   - `documentTypeDetected`
   - `isValidForSlot`
   - `slotValidationReason`
   - `fields` (cuando aplica)
   - `confidence`
   - `warnings`
3. Frontend muestra:
   - estado valido/no valido por slot,
   - advertencias (ej. vencimiento),
   - datos extraidos con UX amigable.

---

## Variables de Entorno

### Frontend (local)

Archivo `.env.local`:

```bash
VITE_IDP_LAMBDA_URL=https://<tu-function-url>.lambda-url.us-east-1.on.aws/
```

### Frontend (Amplify Hosting)

En **Hosting > Environment variables**:

- `VITE_IDP_LAMBDA_URL=https://<tu-function-url>.lambda-url.us-east-1.on.aws/`

Importante:
- Definirla en Amplify es obligatorio para produccion.
- Luego hacer **redeploy**.

### Lambda

- `DOCUMENT_OCR_BUCKET=<nombre-bucket-s3>`
- `DOCUMENT_OCR_POLL_SECONDS=1.5`
- `DOCUMENT_OCR_MAX_WAIT_SECONDS=120`

---

## S3 para PDF (reutilizable entre demos)

Se puede usar un bucket compartido para varios portales/demos.

Recomendaciones:
- Usar prefijos por demo (`demo-natural/`, `demo-juridica/`, etc).
- Mantener limpieza de temporales (el lambda ya elimina objeto al finalizar).
- Mantener el bucket privado.

---

## CORS importante (evitar error de doble header)

Si usas CORS en Lambda Function URL, **no devuelvas CORS manual** duplicado desde el handler.

Sintoma tipico en navegador:
- `Access-Control-Allow-Origin contains multiple values '*, *'`

Regla aplicada en este proyecto:
- En respuesta Lambda devolver solo:
  - `Content-Type`
- Dejar `Access-Control-Allow-*` a nivel de Function URL.

---

## Reglas de negocio implementadas hoy

### 1) Validacion por slot

- `expectedDocumentType` vs `documentTypeDetected`
- Si no coincide: `isValidForSlot=false`.

### 2) Extraccion selectiva

- `CEDULA`: extrae nombres, apellidos, numero.
- `RIF`: extrae numero y razon social.
- `ACTA_CONSTITUTIVA` y otros: validacion de tipo sin extraccion.

### 3) Limpieza de texto

Se eliminan prefijos/etiquetas en nombres:
- `NOMBRES`
- `APELLIDOS`

### 4) Vencimiento (warning, no bloqueo)

Para `CEDULA` y `RIF`:
- si esta vencido -> warning,
- si vence en <= 6 meses -> warning.

### 5) UX por modulo

- Persona Natural:
  - en RIF se mantiene validacion y advertencias,
  - se oculta detalle de datos extraidos si no aporta al usuario.

---

## Checklist operativo para nuevos proyectos (copiar/pegar)

1. Crear Lambda OCR y Function URL.
2. Crear/seleccionar bucket S3.
3. Configurar env vars Lambda (`DOCUMENT_OCR_*`).
4. Asignar permisos IAM (Textract + S3).
5. Verificar CORS (sin duplicar headers).
6. Configurar `.env.local` (`VITE_IDP_LAMBDA_URL`).
7. Configurar variable en Amplify Hosting.
8. Redeploy.
9. Probar casos minimos:
   - Cedula correcta
   - RIF correcto
   - Mismatch de slot
   - PDF e imagen
   - Documento vencido / proximo a vencer

---

## Troubleshooting rapido

### 1) `Failed to fetch` en frontend

Revisar:
- URL Lambda correcta en `.env.local` y Amplify.
- CORS no duplicado.

### 2) Funciona local pero no en Amplify

Causa mas comun:
- falta `VITE_IDP_LAMBDA_URL` en Amplify.

### 3) Timeout en pruebas Lambda

Revisar:
- timeout de Lambda (subirlo para OCR/PDF),
- `DOCUMENT_OCR_MAX_WAIT_SECONDS`,
- permisos Textract/S3.

### 4) PDF queda en `IN_PROGRESS`

Revisar:
- bucket configurado,
- permisos IAM de lectura/escritura/borrado,
- que `StartDocumentTextDetection` y `GetDocumentTextDetection` esten permitidos.

Ejemplo `amplify.yml`:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```
