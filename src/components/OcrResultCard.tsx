import { AlertBanner } from './AlertBanner';
import { humanizeExpiry } from '../utils/dates';
import type { OcrResult } from '../types/onboarding';

export function OcrResultCard({ processing, result }: { processing: boolean; result?: OcrResult }) {
  return (
    <div className="rounded-xl border border-slate-600 bg-slate-900/60 p-4">
      {processing ? (
        <div className="flex items-center gap-2 text-sm text-blue-100">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200/40 border-t-blue-100" />
          Procesando OCR...
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <div className="grid gap-1 text-sm text-slate-100">
            <p>
              <span className="text-slate-300">Nombre:</span> {result.extracted.fullName}
            </p>
            <p>
              <span className="text-slate-300">Documento:</span> {result.extracted.documentNumber}
            </p>
            <p>
              <span className="text-slate-300">Vencimiento:</span> {result.extracted.expiryDate}
            </p>
            <p>
              <span className="text-slate-300">Confianza OCR:</span> {result.confidence}%
            </p>
            <p>
              <span className="text-slate-300">Estado de vigencia:</span> {humanizeExpiry(result.expiryStatus)}
            </p>
          </div>

          {result.expiryStatus === 'OK' ? <AlertBanner type="success">Documento vigente.</AlertBanner> : null}
          {result.expiryStatus !== 'OK' ? (
            <AlertBanner type="warning">
              {result.expiryStatus === 'VENCIDO' ? 'Documento vencido. Se permite continuar para revision.' : 'Documento proximo a vencer.'}
            </AlertBanner>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
