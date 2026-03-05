# Portalito Ubii - Onboarding y Validacion Inteligente

Aplicacion web demo construida con React + TypeScript + Vite + TailwindCSS para onboarding comercial con validaciones IA simuladas.

## Stack

- React 18
- TypeScript
- Vite
- TailwindCSS
- React Router DOM

## Requisitos

- Node.js 18+
- npm 9+

## Ejecutar localmente

```bash
npm ci
npm run dev
```

Build de produccion:

```bash
npm run build
npm run preview
```

## Variables de entorno

- `VITE_API_BASE_URL` (opcional)
  - Si se define, el frontend intenta consumir:
    - `POST /validate/document`
    - `POST /validate/photo`
    - `POST /validate/liveness`
  - Si no existe (o falla), usa modo MOCK automaticamente.

## Flujo

- `/` Landing corporativa
- `/demo` Introduccion a demo
- `/onboarding` Wizard 5 pasos
- `/done` Confirmacion final

## AWS Amplify (Vite)

Config recomendada:

- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Node runtime: `18+`

Ejemplo de `amplify.yml`:

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

## Notas de demo

- Documentos permiten `input[type=file]` (PDF/JPG/PNG).
- Fotos de comercio y liveness requieren captura en vivo con `getUserMedia` + `canvas`.
- Validacion IA retorna: `{ ok, score, labels, extractedFields, warnings }`.
