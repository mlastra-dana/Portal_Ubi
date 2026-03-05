export function Stepper2Steps({ currentStep }: { currentStep: 1 | 2 }) {
  const steps = ['Paso 1 · OCR de documentos', 'Paso 2 · IA de imagenes del comercio'];

  return (
    <ol className="grid gap-3 md:grid-cols-2" aria-label="Progreso del onboarding">
      {steps.map((label, index) => {
        const step = (index + 1) as 1 | 2;
        const isActive = step === currentStep;
        const isDone = step < currentStep;

        return (
          <li key={label} className={`rounded-xl border p-3 ${isActive ? 'border-primary bg-primary/15' : 'border-slate-700 bg-slate-900/50'}`}>
            <p className={`text-sm font-semibold ${isActive ? 'text-blue-100' : isDone ? 'text-emerald-200' : 'text-slate-200'}`}>{label}</p>
          </li>
        );
      })}
    </ol>
  );
}
