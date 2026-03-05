export function Stepper2Steps({ currentStep }: { currentStep: 1 | 2 }) {
  const steps = ['Paso 1 · OCR de documentos', 'Paso 2 · IA de imagenes del comercio'];

  return (
    <ol className="grid gap-3 md:grid-cols-2" aria-label="Progreso del onboarding">
      {steps.map((label, index) => {
        const step = (index + 1) as 1 | 2;
        const isActive = step === currentStep;
        const isDone = step < currentStep;

        return (
          <li
            key={label}
            className={`rounded-xl border p-3 shadow-soft ${
              isActive ? 'border-amber-300 bg-amber-50' : isDone ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
            }`}
          >
            <p className={`text-sm font-semibold ${isActive ? 'text-amber-700' : isDone ? 'text-emerald-700' : 'text-gray-600'}`}>{label}</p>
          </li>
        );
      })}
    </ol>
  );
}
