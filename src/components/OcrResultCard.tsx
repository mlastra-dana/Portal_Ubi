import { AlertBanner } from './AlertBanner';
import { humanizeExpiry } from '../utils/dates';
import type { OcrResult } from '../types/onboarding';

export function OcrResultCard({ processing, result }: { processing: boolean; result?: OcrResult }) {
  return (
    <div className="rounded-xl border border-ubii-border bg-ubii-light p-4">
      {processing ? (
        <div className="flex items-center gap-2 text-sm text-ubii-hover">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ubii-blue/30 border-t-ubii-blue" />
          Procesando OCR...
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <div className="grid gap-1 text-sm text-ubii-black">
            <p>
              <span className="text-gray-600">Tipo detectado:</span> {result.detectedType.toUpperCase()}
            </p>
            <p>
              <span className="text-gray-600">Nombre:</span> {result.extracted.fullName}
            </p>
            <p>
              <span className="text-gray-600">Documento:</span> {result.extracted.documentNumber}
            </p>
            <p>
              <span className="text-gray-600">Vencimiento:</span> {result.extracted.expiryDate}
            </p>
            <p>
              <span className="text-gray-600">Confianza OCR:</span> {result.confidence}%
            </p>
            <p>
              <span className="text-gray-600">Estado de vigencia:</span> {humanizeExpiry(result.expiryStatus)}
            </p>
            <p>
              <span className="text-gray-600">Formato:</span> {result.formatValid ? 'Valido' : 'Revisar'}
            </p>
            <p>
              <span className="text-gray-600">Consistencia:</span> {result.consistency}
            </p>
          </div>

          {result.expiryStatus === 'OK' ? <AlertBanner type="success">Documento vigente.</AlertBanner> : null}
          {result.expiryStatus !== 'OK' ? (
            <AlertBanner type="warning">
              {result.expiryStatus === 'VENCIDO' ? 'Documento vencido. Se permite continuar para revision.' : 'Documento proximo a vencer.'}
            </AlertBanner>
          ) : null}
          {result.warnings.map((warning) => (
            <AlertBanner key={warning} type="warning">
              {warning}
            </AlertBanner>
          ))}
        </div>
      ) : null}
    </div>
  );
}
