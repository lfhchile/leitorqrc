import type { BarcodeType } from 'expo-camera';

/** Todos os formatos de código suportados pelo expo-camera. */
export const ALL_BARCODE_TYPES: BarcodeType[] = [
  'qr', 'aztec', 'datamatrix', 'pdf417',
  'ean13', 'ean8', 'upc_a', 'upc_e',
  'code39', 'code93', 'code128', 'codabar', 'itf14',
];

export const FORMAT_LABELS: Record<string, string> = {
  qr: 'QR Code', aztec: 'Aztec', datamatrix: 'Data Matrix', pdf417: 'PDF417',
  ean13: 'EAN-13', ean8: 'EAN-8', upc_a: 'UPC-A', upc_e: 'UPC-E',
  code39: 'Code 39', code93: 'Code 93', code128: 'Code 128',
  codabar: 'Codabar', itf14: 'ITF-14',
};

export function formatLabel(type: string): string {
  const key = type.toLowerCase().replace(/^org\.iso\.|^org\.gs1\./, '').replace(/[-\s]/g, '_');
  return FORMAT_LABELS[key] ?? FORMAT_LABELS[type] ?? type;
}
