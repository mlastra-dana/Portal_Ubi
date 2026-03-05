import { useRef, type ChangeEvent } from 'react';
import { Button } from './Button';

export function FileDropzone({
  id,
  accept,
  onFile,
  label,
  hint
}: {
  id: string;
  accept: string;
  onFile: (file?: File) => void;
  label: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onFile(file);
  };

  return (
    <div className="rounded-xl border border-dashed border-borderSoft bg-bgSoft p-4">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-textMain">
        {label}
      </label>
      {hint ? <p className="mb-3 text-xs text-gray-500">{hint}</p> : null}
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        aria-label={label}
      />
      <Button variant="outline" type="button" onClick={() => inputRef.current?.click()}>
        Seleccionar archivo
      </Button>
    </div>
  );
}
