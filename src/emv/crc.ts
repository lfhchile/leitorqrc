/**
 * CRC-16/CCITT-FALSE (ISO/IEC 13239, polinômio 0x1021, valor inicial 0xFFFF),
 * calculado sobre os bytes UTF-8 do payload — seção 4.7.3.
 */
function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    let cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

export function crc16(data: string): string {
  let crc = 0xffff;
  for (const b of utf8Bytes(data)) {
    crc ^= b << 8;
    for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Acrescenta "6304" + CRC ao final de um payload sem CRC. */
export function withCrc(payloadWithoutCrc: string): string {
  const base = payloadWithoutCrc + '6304';
  return base + crc16(base);
}
