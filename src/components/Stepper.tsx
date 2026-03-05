export function Stepper({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <ol className="grid grid-cols-1 gap-3 md:grid-cols-5" aria-label="Pasos del onboarding">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isDone = stepNumber < currentStep;
        return (
          <li key={label} className="rounded-xl border border-borderSoft bg-white p-3">
            <p className="mb-1 text-xs font-medium text-gray-500">Paso {stepNumber}</p>
            <p className={`text-sm font-semibold ${isActive ? 'text-primary' : isDone ? 'text-emerald-700' : 'text-gray-700'}`}>{label}</p>
          </li>
        );
      })}
    </ol>
  );
}
