import { useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Stepper } from '../components/Stepper';
import { FileDropzone } from '../components/FileDropzone';
import { CameraCapture } from '../components/CameraCapture';
import { LivenessCapture } from '../components/LivenessCapture';
import { ReviewTable } from '../components/ReviewTable';
import { Badge } from '../components/Badge';
import { formatBytes, randomRegistrationNumber } from '../utils/format';
import { validateDocument, validateLiveness, validatePhoto, validationStatusFromResponse } from '../services/validator';
import type {
  ApplicantType,
  DocumentEntry,
  DocumentType,
  LivenessEntry,
  PhotoEntry,
  PhotoKind,
  ValidationItemResult,
  WizardState
} from '../types/onboarding';

const steps = ['Solicitante', 'Documentos', 'Fotos', 'Liveness', 'Resumen'];

const documentTemplate = (type: ApplicantType): DocumentEntry[] => [
  {
    type: 'cedula',
    label: type === 'juridica' ? 'Cedula del representante' : 'Cedula',
    required: true
  },
  { type: 'rif', label: 'RIF', required: true },
  { type: 'acta', label: 'Acta constitutiva / Registro mercantil', required: type === 'juridica' }
];

const photoTemplate = (): PhotoEntry[] => [
  { kind: 'fachada', label: 'Fachada', required: true },
  { kind: 'interior', label: 'Interior', required: true },
  { kind: 'inventario', label: 'Inventario', required: true }
];

const initialState = (): WizardState => ({
  currentStep: 1,
  applicant: {
    type: 'natural',
    businessName: '',
    idOrRif: '',
    phone: '',
    email: ''
  },
  documents: documentTemplate('natural'),
  photos: photoTemplate(),
  liveness: {
    gestureDone: false
  }
});

type Action =
  | { type: 'set_step'; payload: number }
  | { type: 'set_applicant_type'; payload: ApplicantType }
  | { type: 'set_applicant_field'; payload: { key: 'businessName' | 'idOrRif' | 'phone' | 'email'; value: string } }
  | { type: 'set_document_file'; payload: { type: DocumentType; file?: File } }
  | { type: 'set_document_result'; payload: { type: DocumentType; result: ValidationItemResult } }
  | { type: 'set_photo_capture'; payload: { kind: PhotoKind; capture: PhotoEntry['capture'] } }
  | { type: 'set_photo_result'; payload: { kind: PhotoKind; result: ValidationItemResult } }
  | { type: 'set_liveness'; payload: LivenessEntry }
  | { type: 'set_liveness_result'; payload: ValidationItemResult }
  | { type: 'set_submission'; payload: { registrationNumber: string; submittedAt: string } };

const reducer = (state: WizardState, action: Action): WizardState => {
  switch (action.type) {
    case 'set_step':
      return { ...state, currentStep: action.payload };
    case 'set_applicant_type': {
      const nextDocs = documentTemplate(action.payload).map((entry) => {
        const previous = state.documents.find((item) => item.type === entry.type);
        return previous ? { ...entry, file: previous.file, previewUrl: previous.previewUrl, result: previous.result } : entry;
      });
      return {
        ...state,
        applicant: { ...state.applicant, type: action.payload },
        documents: nextDocs
      };
    }
    case 'set_applicant_field':
      return {
        ...state,
        applicant: {
          ...state.applicant,
          [action.payload.key]: action.payload.value
        }
      };
    case 'set_document_file':
      return {
        ...state,
        documents: state.documents.map((doc) =>
          doc.type === action.payload.type
            ? {
                ...doc,
                file: action.payload.file,
                previewUrl: action.payload.file ? URL.createObjectURL(action.payload.file) : undefined,
                result: undefined
              }
            : doc
        )
      };
    case 'set_document_result':
      return {
        ...state,
        documents: state.documents.map((doc) => (doc.type === action.payload.type ? { ...doc, result: action.payload.result } : doc))
      };
    case 'set_photo_capture':
      return {
        ...state,
        photos: state.photos.map((photo) =>
          photo.kind === action.payload.kind ? { ...photo, capture: action.payload.capture, result: undefined } : photo
        )
      };
    case 'set_photo_result':
      return {
        ...state,
        photos: state.photos.map((photo) => (photo.kind === action.payload.kind ? { ...photo, result: action.payload.result } : photo))
      };
    case 'set_liveness':
      return { ...state, liveness: action.payload };
    case 'set_liveness_result':
      return { ...state, liveness: { ...state.liveness, result: action.payload } };
    case 'set_submission':
      return {
        ...state,
        finalRegistrationNumber: action.payload.registrationNumber,
        submittedAt: action.payload.submittedAt
      };
    default:
      return state;
  }
};

const requiredMissing = (state: WizardState, step: number): string[] => {
  if (step === 1) {
    const { businessName, idOrRif, phone, email } = state.applicant;
    const missing: string[] = [];
    if (!businessName.trim()) missing.push('Nombre del comercio');
    if (!idOrRif.trim()) missing.push('RIF/Cedula');
    if (!phone.trim()) missing.push('Telefono');
    if (!email.trim()) missing.push('Email');
    return missing;
  }
  if (step === 2) return state.documents.filter((doc) => doc.required && !doc.file).map((doc) => doc.label);
  if (step === 3) return state.photos.filter((photo) => photo.required && !photo.capture).map((photo) => photo.label);
  if (step === 4) {
    const missing: string[] = [];
    if (!state.liveness.selfie) missing.push('Selfie en vivo');
    if (!state.liveness.gestureDone) missing.push('Gesto guiado');
    return missing;
  }
  return [];
};

const responseToResult = (response: {
  ok: boolean;
  score: number;
  labels: string[];
  extractedFields: Record<string, string>;
  warnings: string[];
}): ValidationItemResult => ({
  status: validationStatusFromResponse(response),
  score: response.score,
  warnings: response.warnings,
  labels: response.labels,
  extractedFields: response.extractedFields
});

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [errors, setErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const reviewItems = useMemo(
    () => [
      ...state.documents.map((doc) => ({ name: doc.label, category: 'Documento', result: doc.result })),
      ...state.photos.map((photo) => ({ name: photo.label, category: 'Foto comercio', result: photo.result })),
      { name: 'Liveness', category: 'Prueba de vida', result: state.liveness.result }
    ],
    [state.documents, state.photos, state.liveness.result]
  );

  const nextStep = () => {
    const missing = requiredMissing(state, state.currentStep);
    if (missing.length > 0) {
      setErrors(missing.map((field) => `Falta obligatorio: ${field}`));
      return;
    }
    setErrors([]);
    if (state.currentStep < 5) dispatch({ type: 'set_step', payload: state.currentStep + 1 });
  };

  const prevStep = () => {
    setErrors([]);
    if (state.currentStep > 1) dispatch({ type: 'set_step', payload: state.currentStep - 1 });
  };

  const runValidations = async () => {
    const missing = requiredMissing(state, 2).concat(requiredMissing(state, 3), requiredMissing(state, 4));
    if (missing.length > 0) {
      setErrors(missing.map((field) => `No puede enviar: ${field}`));
      return;
    }

    setErrors([]);
    setIsValidating(true);
    const docResults: Record<DocumentType, ValidationItemResult | undefined> = {
      cedula: undefined,
      rif: undefined,
      acta: undefined
    };
    const photoResults: Record<PhotoKind, ValidationItemResult | undefined> = {
      fachada: undefined,
      interior: undefined,
      inventario: undefined
    };

    for (const doc of state.documents) {
      if (doc.required && !doc.file) {
        const result: ValidationItemResult = { status: 'rechazado', score: 0, warnings: ['Documento obligatorio faltante'] };
        docResults[doc.type] = result;
        dispatch({ type: 'set_document_result', payload: { type: doc.type, result } });
      } else if (doc.file) {
        const response = await validateDocument(doc.type, doc.file);
        const result = responseToResult(response);
        docResults[doc.type] = result;
        dispatch({ type: 'set_document_result', payload: { type: doc.type, result } });
      }
    }

    for (const photo of state.photos) {
      if (photo.required && !photo.capture) {
        const result: ValidationItemResult = { status: 'rechazado', score: 0, warnings: ['Captura en vivo obligatoria faltante'] };
        photoResults[photo.kind] = result;
        dispatch({ type: 'set_photo_result', payload: { kind: photo.kind, result } });
      } else if (photo.capture) {
        const response = await validatePhoto(photo.kind, photo.capture.blob);
        const result = responseToResult(response);
        photoResults[photo.kind] = result;
        dispatch({ type: 'set_photo_result', payload: { kind: photo.kind, result } });
      }
    }

    const livenessResponse = await validateLiveness({
      hasSelfie: Boolean(state.liveness.selfie),
      hasVideo: Boolean(state.liveness.shortVideo),
      gestureDone: state.liveness.gestureDone
    });
    const livenessResult = responseToResult(livenessResponse);
    dispatch({ type: 'set_liveness_result', payload: livenessResult });

    const registrationNumber = randomRegistrationNumber();
    const submittedAt = new Date().toISOString();
    dispatch({ type: 'set_submission', payload: { registrationNumber, submittedAt } });
    setIsValidating(false);

    const summary = [
      ...state.documents.map((doc) => ({ name: doc.label, category: 'Documento', result: docResults[doc.type] })),
      ...state.photos.map((photo) => ({ name: photo.label, category: 'Foto comercio', result: photoResults[photo.kind] })),
      { name: 'Liveness', category: 'Prueba de vida', result: livenessResult }
    ];

    navigate('/done', {
      state: {
        registrationNumber,
        submittedAt,
        summary
      }
    });
  };

  return (
    <main className="mx-auto w-full max-w-content space-y-5 px-4 py-8 md:px-6 md:py-10">
      <header>
        <h1 className="text-2xl font-bold text-textMain md:text-3xl">Onboarding y validacion inteligente</h1>
        <p className="text-sm text-gray-600">Completa el flujo paso a paso. Las fotos del comercio y selfie deben capturarse en vivo.</p>
      </header>

      <Stepper steps={steps} currentStep={state.currentStep} />

      {errors.length > 0 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {state.currentStep === 1 ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-textMain">Paso 1: Tipo de solicitante y datos basicos</h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="rounded-lg border border-borderSoft p-3 text-sm">
              <input
                type="radio"
                name="applicantType"
                className="mr-2"
                checked={state.applicant.type === 'natural'}
                onChange={() => dispatch({ type: 'set_applicant_type', payload: 'natural' })}
              />
              Persona Natural
            </label>
            <label className="rounded-lg border border-borderSoft p-3 text-sm">
              <input
                type="radio"
                name="applicantType"
                className="mr-2"
                checked={state.applicant.type === 'juridica'}
                onChange={() => dispatch({ type: 'set_applicant_type', payload: 'juridica' })}
              />
              Persona Juridica
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {[
              { id: 'businessName', label: 'Nombre del comercio', value: state.applicant.businessName },
              { id: 'idOrRif', label: 'RIF / Cedula', value: state.applicant.idOrRif },
              { id: 'phone', label: 'Telefono', value: state.applicant.phone },
              { id: 'email', label: 'Email', value: state.applicant.email }
            ].map((field) => (
              <label key={field.id} className="text-sm font-medium text-textMain">
                {field.label}
                <input
                  type={field.id === 'email' ? 'email' : 'text'}
                  value={field.value}
                  onChange={(event) =>
                    dispatch({
                      type: 'set_applicant_field',
                      payload: {
                        key: field.id as 'businessName' | 'idOrRif' | 'phone' | 'email',
                        value: event.target.value
                      }
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-borderSoft px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
            ))}
          </div>
        </Card>
      ) : null}

      {state.currentStep === 2 ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-textMain">Paso 2: Documentos</h2>
          <p className="mb-4 text-sm text-gray-600">Sube PDF/JPG/PNG. Se valida extension, tamano y heuristicas del nombre del archivo.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {state.documents.map((doc) => {
              const isImage = Boolean(doc.file && doc.file.type.startsWith('image/'));
              return (
                <div key={doc.type} className="space-y-2">
                  <FileDropzone
                    id={`file-${doc.type}`}
                    accept=".pdf,image/png,image/jpeg"
                    onFile={(file) => dispatch({ type: 'set_document_file', payload: { type: doc.type, file } })}
                    label={`${doc.label}${doc.required ? ' *' : ''}`}
                    hint="Permitido: PDF, PNG, JPG"
                  />
                  {doc.file ? (
                    <div className="rounded-lg border border-borderSoft bg-bgSoft p-2 text-xs text-gray-600">
                      <p>
                        {doc.file.name} · {formatBytes(doc.file.size)}
                      </p>
                      {isImage ? <img src={doc.previewUrl} alt={doc.label} className="mt-2 h-24 w-full rounded-md object-cover" /> : null}
                    </div>
                  ) : null}
                  <Badge status={doc.result?.status ?? 'pendiente'} />
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {state.currentStep === 3 ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-textMain">Paso 3: Fotos del comercio (solo captura en vivo)</h2>
          <p className="mb-4 text-sm text-gray-600">No se permite seleccionar desde galeria para estas evidencias.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {state.photos.map((photo) => (
              <CameraCapture
                key={photo.kind}
                title={`${photo.label}${photo.required ? ' *' : ''}`}
                description="Se usa getUserMedia + canvas para captura en el momento"
                current={photo.capture}
                onCaptured={(capture) => dispatch({ type: 'set_photo_capture', payload: { kind: photo.kind, capture } })}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {state.currentStep === 4 ? (
        <LivenessCapture
          selfie={state.liveness.selfie}
          shortVideo={state.liveness.shortVideo}
          gestureDone={state.liveness.gestureDone}
          onChange={(payload) =>
            dispatch({
              type: 'set_liveness',
              payload: {
                selfie: payload.selfie,
                shortVideo: payload.shortVideo,
                gestureDone: payload.gestureDone,
                result: state.liveness.result
              }
            })
          }
        />
      ) : null}

      {state.currentStep === 5 ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-textMain">Paso 5: Resumen y envio</h2>
          <ReviewTable items={reviewItems} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={runValidations} disabled={isValidating}>
              {isValidating ? 'Ejecutando validaciones IA (demo)...' : 'Ejecutar validaciones IA (demo)'}
            </Button>
            <span className="text-xs text-gray-500">Las respuestas incluyen: ok, score, labels, extractedFields y warnings.</span>
          </div>
        </Card>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" onClick={prevStep} disabled={state.currentStep === 1 || isValidating}>
          Anterior
        </Button>
        <Button onClick={nextStep} disabled={state.currentStep === 5 || isValidating}>
          Siguiente
        </Button>
      </div>
    </main>
  );
}
