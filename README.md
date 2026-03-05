# Onboarding POS UBIAPP (Demo)

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
- Solo faltantes obligatorios bloquean completitud del modulo

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
