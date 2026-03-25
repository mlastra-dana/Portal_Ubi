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
- Activa Function URL en modo `POST` + CORS.
- Luego configura en Amplify Hosting:
  - `VITE_IDP_LAMBDA_URL=https://<tu-function-url>`

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
