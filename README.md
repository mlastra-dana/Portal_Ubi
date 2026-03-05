# Onboarding Post UBPAY (Demo)

Demo frontend para onboarding POS con validacion asistida:
- Paso 1: OCR de Cedula y RIF (autocompletado)
- Paso 2: Analisis IA de imagenes del comercio + revision manual del analista

## Stack

- React + TypeScript + Vite
- TailwindCSS
- React Router

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
- `/onboarding` Wizard 2 pasos
- `/done` Confirmacion y resumen

## Reglas de demo implementadas

- Persona Natural activa
- Persona Juridica visible pero deshabilitada
- OCR y analisis de imagenes se disparan automaticamente al cargar
- Alertas por vencimiento/probabilidades son amarillas y no bloquean el flujo
- Flujo no se bloquea por warnings

## AWS Amplify

- Build command: `npm ci && npm run build`
- Artifacts/output: `dist`
- Node recomendado: `18+`

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
