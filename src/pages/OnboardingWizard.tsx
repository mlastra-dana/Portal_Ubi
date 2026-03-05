import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Stepper } from '../components/Stepper';
import { CameraCapture } from '../components/CameraCapture';
import { LivenessCapture } from '../components/LivenessCapture';
import { ReviewTable } from '../components/ReviewTable';
import { DocumentUploader } from '../components/DocumentUploader';
import { ValidationResults } from '../components/ValidationResults';
import { randomRegistrationNumber } from '../utils/format';
import { simulateDocumentValidation, validateBusinessData } from '../services/documentValidator';
import { simulateImageValidation } from '../services/imageValidator';
import { simulateBiometricValidation } from '../services/biometricValidator';
import type {
  ApplicantType,
  DocumentEntry,
  DocumentType,
  LivenessEntry,
  PhotoEntry,
  PhotoKind,
  ValidationBadge,
  ValidationItemResult,
  WizardState
} from '../types/onboarding';

const steps = ['Solicitante', 'Documentos', 'Fotos', 'Liveness', 'Resumen'];

type Detail = { label: string; value: string };

type LoadingMap = Record<DocumentType | PhotoKind, boolean>;
type DetailsMap = Record<DocumentType | PhotoKind, Detail[] | undefined>;

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

const scoreToStatus = (score: number): ValidationBadge => {
  if (score >= 85) return 'validado';
  if (score >= 70) return 'revisar';
  return 'rechazado';
};

const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((acc, curr) => acc + curr, 0) / values.length);
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
  if (step === 2) {
    return state.documents
      .filter((doc) => doc.required)
      .flatMap((doc) => {
        const issues: string[] = [];
        if (!doc.file) issues.push(`${doc.label} (archivo faltante)`);
        if (doc.file && !doc.result) issues.push(`${doc.label} (validacion pendiente)`);
        return issues;
      });
  }
  if (step === 3) {
    return state.photos
      .filter((photo) => photo.required)
      .flatMap((photo) => {
        const issues: string[] = [];
        if (!photo.capture) issues.push(`${photo.label} (captura faltante)`);
        if (photo.capture && !photo.result) issues.push(`${photo.label} (validacion pendiente)`);
        return issues;
      });
  }
  if (step === 4) {
    const missing: string[] = [];
    if (!state.liveness.selfie) missing.push('Selfie en vivo');
    if (!state.liveness.gestureDone) missing.push('Gesto guiado');
    if (state.liveness.selfie && !state.liveness.result) missing.push('Validacion biometrica en proceso');
    return missing;
  }
  return [];
};

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [errors, setErrors] = useState<string[]>([]);

  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Result, setStep1Result] = useState<ValidationItemResult>();
  const [step1Details, setStep1Details] = useState<Detail[]>([]);

  const [loadingMap, setLoadingMap] = useState<LoadingMap>({
    cedula: false,
    rif: false,
    acta: false,
    fachada: false,
    interior: false,
    inventario: false
  });
  const [detailsMap, setDetailsMap] = useState<DetailsMap>({
    cedula: undefined,
    rif: undefined,
    acta: undefined,
    fachada: undefined,
    interior: undefined,
    inventario: undefined
  });

  const [bioLoading, setBioLoading] = useState(false);
  const [bioDetails, setBioDetails] = useState<Detail[]>([]);

  const step1Ready =
    state.applicant.businessName.trim() && state.applicant.idOrRif.trim() && state.applicant.phone.trim() && state.applicant.email.trim();

  useEffect(() => {
    if (!step1Ready) {
      setStep1Result(undefined);
      setStep1Details([]);
      return;
    }

    let cancelled = false;
    setStep1Loading(true);
    const timer = setTimeout(async () => {
      const validation = await validateBusinessData(state.applicant);
      if (cancelled) return;

      const warnings: string[] = [];
      if (!validation.formatValid) warnings.push('Formato de documento no concluyente');
      if (!validation.consistencyOk) warnings.push('Inconsistencia basica entre campos');

      setStep1Result({
        status: scoreToStatus(validation.score),
        score: validation.score,
        warnings,
        labels: [validation.documentDetected],
        extractedFields: {}
      });

      setStep1Details([
        { label: 'Documento detectado', value: validation.documentDetected },
        { label: 'Formato', value: validation.formatValid ? 'Valido' : 'Revisar' },
        { label: 'Consistencia', value: validation.consistencyOk ? 'OK' : 'Revisar' }
      ]);
      setStep1Loading(false);
    }, 700);

    return () => {
      cancelled = true;
      setStep1Loading(false);
      clearTimeout(timer);
    };
  }, [state.applicant, step1Ready]);

  const handleDocumentFile = async (type: DocumentType, file?: File) => {
    dispatch({ type: 'set_document_file', payload: { type, file } });
    if (!file) return;

    setLoadingMap((prev) => ({ ...prev, [type]: true }));
    const aiResult = await simulateDocumentValidation(type, file, state.applicant.businessName, state.applicant.idOrRif);

    const expectedTypeLabel: Record<DocumentType, string> = {
      cedula: 'Cedula',
      rif: 'RIF',
      acta: 'Acta constitutiva'
    };
    const typeMatch = aiResult.documentTypeDetected.toLowerCase().includes(expectedTypeLabel[type].toLowerCase());
    const score = Math.max(0, Math.min(99, Math.round(aiResult.confidence - aiResult.duplicateProbability * 0.5 + (typeMatch ? 5 : -8))));

    const warnings: string[] = [];
    if (!typeMatch) warnings.push('Tipo detectado no coincide con el esperado');
    if (aiResult.duplicateProbability > 20) warnings.push('Probabilidad de duplicado elevada');
    if (aiResult.expiryStatus !== 'vigente') warnings.push('Documento por vencer');

    dispatch({
      type: 'set_document_result',
      payload: {
        type,
        result: {
          status: scoreToStatus(score),
          score,
          warnings,
          labels: [aiResult.documentTypeDetected],
          extractedFields: aiResult.ocrExtractedFields
        }
      }
    });

    setDetailsMap((prev) => ({
      ...prev,
      [type]: [
        { label: 'Tipo detectado', value: aiResult.documentTypeDetected },
        { label: 'OCR confidence', value: `${aiResult.confidence}%` },
        { label: 'Coincidencia formulario', value: typeMatch ? 'OK' : 'Revisar' },
        { label: 'Duplicado CRM', value: `${aiResult.duplicateProbability}%` },
        { label: 'Estatus vigencia', value: aiResult.expiryStatus }
      ]
    }));
    setLoadingMap((prev) => ({ ...prev, [type]: false }));
  };

  const handlePhotoCapture = async (kind: PhotoKind, capture: PhotoEntry['capture']) => {
    dispatch({ type: 'set_photo_capture', payload: { kind, capture } });
    if (!capture) return;

    setLoadingMap((prev) => ({ ...prev, [kind]: true }));
    const aiResult = await simulateImageValidation(kind, capture.blob);

    const kindExpectedMap: Record<PhotoKind, string> = {
      fachada: 'fachada de comercio',
      interior: 'interior de comercio',
      inventario: 'inventario en exhibicion'
    };
    const labelMatch = aiResult.labels[0] === kindExpectedMap[kind];
    const score = Math.max(
      0,
      Math.min(99, Math.round(aiResult.imageQualityScore - aiResult.aiGeneratedProbability * 0.5 - aiResult.webMatchProbability * 0.3 + (labelMatch ? 4 : -10)))
    );

    const warnings: string[] = [];
    if (!labelMatch) warnings.push('La escena no coincide con el tipo solicitado');
    if (aiResult.imageQualityScore < 70) warnings.push('Calidad de imagen baja');

    dispatch({
      type: 'set_photo_result',
      payload: {
        kind,
        result: {
          status: scoreToStatus(score),
          score,
          warnings,
          labels: aiResult.labels,
          extractedFields: {
            aiGeneratedProbability: `${aiResult.aiGeneratedProbability}%`,
            webMatchProbability: `${aiResult.webMatchProbability}%`,
            crmDuplicateProbability: `${aiResult.crmDuplicateProbability}%`
          }
        }
      }
    });

    setDetailsMap((prev) => ({
      ...prev,
      [kind]: [
        { label: 'Imagen detectada', value: aiResult.labels[0] },
        { label: 'Prob. generada por IA', value: `${aiResult.aiGeneratedProbability}%` },
        { label: 'Coincidencia internet', value: `${aiResult.webMatchProbability}%` },
        { label: 'Coincidencia CRM', value: `${aiResult.crmDuplicateProbability}%` },
        { label: 'Calidad', value: `${aiResult.imageQualityScore}%` }
      ]
    }));
    setLoadingMap((prev) => ({ ...prev, [kind]: false }));
  };

  useEffect(() => {
    if (!state.liveness.selfie) return;

    let cancelled = false;
    setBioLoading(true);

    const run = async () => {
      const aiResult = await simulateBiometricValidation(state.liveness.selfie as NonNullable<typeof state.liveness.selfie>, state.liveness.gestureDone);
      if (cancelled) return;

      const combinedScore = Math.round((aiResult.faceMatchScore * 0.7 + aiResult.confidence * 0.3) / 1);
      const status: ValidationBadge = aiResult.livenessResult === 'FAIL' ? 'rechazado' : aiResult.livenessResult === 'REVIEW' ? 'revisar' : scoreToStatus(combinedScore);

      dispatch({
        type: 'set_liveness_result',
        payload: {
          status,
          score: combinedScore,
          warnings: aiResult.livenessResult === 'PASS' ? [] : ['Liveness requiere verificacion adicional'],
          labels: [aiResult.livenessResult],
          extractedFields: {
            faceMatchScore: `${aiResult.faceMatchScore}%`,
            confidence: `${aiResult.confidence}%`
          }
        }
      });

      setBioDetails([
        { label: 'Face match', value: `${aiResult.faceMatchScore}%` },
        { label: 'Liveness', value: aiResult.livenessResult },
        { label: 'Confidence', value: `${aiResult.confidence}%` }
      ]);
      setBioLoading(false);
    };

    run();

    return () => {
      cancelled = true;
      setBioLoading(false);
    };
  }, [state.liveness.selfie?.capturedAt, state.liveness.gestureDone]);

  const reviewItems = useMemo(
    () => [
      ...state.documents.map((doc) => ({ name: doc.label, category: 'Documento', result: doc.result })),
      ...state.photos.map((photo) => ({ name: photo.label, category: 'Foto comercio', result: photo.result })),
      { name: 'Liveness', category: 'Prueba de vida', result: state.liveness.result }
    ],
    [state.documents, state.photos, state.liveness.result]
  );

  const documentScore = useMemo(() => average(state.documents.filter((doc) => doc.required && doc.result).map((doc) => doc.result?.score ?? 0)), [state.documents]);
  const imageScore = useMemo(() => average(state.photos.filter((photo) => photo.result).map((photo) => photo.result?.score ?? 0)), [state.photos]);
  const biometricScore = state.liveness.result?.score ?? 0;

  const globalScore =
    documentScore && imageScore && biometricScore ? Math.round(documentScore * 0.4 + imageScore * 0.35 + biometricScore * 0.25) : 0;

  const globalStatus: 'APROBADO' | 'REQUIERE REVISION' | 'RECHAZADO' =
    globalScore >= 85 ? 'APROBADO' : globalScore >= 70 ? 'REQUIERE REVISION' : 'RECHAZADO';

  const nextStep = () => {
    const missing = requiredMissing(state, state.currentStep);
    if (state.currentStep === 1 && (!step1Result || step1Loading)) {
      setErrors(['Validacion automatica de datos en proceso']);
      return;
    }
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

  const finishOnboarding = () => {
    const missing = requiredMissing(state, 2).concat(requiredMissing(state, 3), requiredMissing(state, 4));
    if (missing.length > 0) {
      setErrors(missing.map((field) => `No puede finalizar: ${field}`));
      return;
    }

    const registrationNumber = randomRegistrationNumber();
    const submittedAt = new Date().toISOString();
    dispatch({ type: 'set_submission', payload: { registrationNumber, submittedAt } });

    navigate('/done', {
      state: {
        registrationNumber,
        submittedAt,
        summary: reviewItems
      }
    });
  };

  return (
    <main className="mx-auto w-full max-w-content space-y-5 px-4 py-8 md:px-6 md:py-10">
      <header>
        <h1 className="text-2xl font-bold text-textMain md:text-3xl">Onboarding y validacion inteligente</h1>
        <p className="text-sm text-gray-600">Cada paso se valida automaticamente antes de continuar.</p>
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

          <div className="mt-4">
            <ValidationResults title="Validacion de datos" loading={step1Loading} loadingText="Validando datos..." result={step1Result} details={step1Details} />
          </div>
        </Card>
      ) : null}

      {state.currentStep === 2 ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-textMain">Paso 2: Validacion de documentos</h2>
          <p className="mb-4 text-sm text-gray-600">Al subir cada archivo se analiza automaticamente y se muestra resultado inmediato.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {state.documents.map((doc) => (
              <DocumentUploader
                key={doc.type}
                document={doc}
                loading={loadingMap[doc.type]}
                details={detailsMap[doc.type]}
                onFile={(file) => {
                  void handleDocumentFile(doc.type, file);
                }}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {state.currentStep === 3 ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-textMain">Paso 3: Validacion de imagenes del comercio</h2>
          <p className="mb-4 text-sm text-gray-600">Solo captura en vivo. Cada imagen se valida automaticamente despues de tomar la foto.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {state.photos.map((photo) => (
              <CameraCapture
                key={photo.kind}
                title={`${photo.label}${photo.required ? ' *' : ''}`}
                description="Se usa getUserMedia + canvas para captura en el momento"
                current={photo.capture}
                validationLoading={loadingMap[photo.kind]}
                validationResult={photo.result}
                validationDetails={detailsMap[photo.kind]}
                onCaptured={(capture) => {
                  void handlePhotoCapture(photo.kind, capture);
                }}
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
          validationLoading={bioLoading}
          validationResult={state.liveness.result}
          validationDetails={bioDetails}
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
          <h2 className="mb-3 text-lg font-semibold text-textMain">Paso 5: Evaluacion final</h2>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-borderSoft bg-bgSoft p-3">
              <p className="text-xs text-gray-500">Documentos</p>
              <p className="text-xl font-bold text-textMain">{documentScore}%</p>
            </div>
            <div className="rounded-xl border border-borderSoft bg-bgSoft p-3">
              <p className="text-xs text-gray-500">Imagenes</p>
              <p className="text-xl font-bold text-textMain">{imageScore}%</p>
            </div>
            <div className="rounded-xl border border-borderSoft bg-bgSoft p-3">
              <p className="text-xs text-gray-500">Biometria</p>
              <p className="text-xl font-bold text-textMain">{biometricScore}%</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-primary">Score global</p>
              <p className="text-xl font-bold text-primary">{globalScore}%</p>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-borderSoft bg-white p-4">
            <p className="text-sm text-gray-600">Estado final</p>
            <p className="text-2xl font-bold text-textMain">{globalStatus}</p>
            {globalScore < 80 ? <p className="mt-1 text-sm font-medium text-amber-700">Human review required</p> : null}
          </div>

          <ReviewTable items={reviewItems} />
          <div className="mt-4">
            <Button onClick={finishOnboarding}>Finalizar registro</Button>
          </div>
        </Card>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" onClick={prevStep} disabled={state.currentStep === 1}>
          Anterior
        </Button>
        <Button onClick={nextStep} disabled={state.currentStep === 5 || bioLoading || step1Loading}>
          Siguiente
        </Button>
      </div>
    </main>
  );
}
