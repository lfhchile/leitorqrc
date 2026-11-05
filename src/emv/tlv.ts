/**
 * Leitura do formato ID / Length / Value do EMV QRCPS-MPM v1.1 (seção 3.2).
 * O comprimento conta CARACTERES (code points Unicode), não bytes — ver o
 * exemplo do Anexo B ("0104最佳运输" tem comprimento 04).
 */
export interface TlvNode {
  id: string;
  length: number;
  value: string;
  /** Posição (em caracteres) do início do objeto dentro do pai. */
  offset: number;
  children?: TlvNode[];
}

export class TlvError extends Error {
  constructor(message: string, public offset: number) { super(message); }
}

export function parseTlv(input: string, baseOffset = 0): TlvNode[] {
  const chars = Array.from(input);
  const nodes: TlvNode[] = [];
  let i = 0;
  while (i < chars.length) {
    if (i + 4 > chars.length) {
      throw new TlvError(`Dados truncados na posição ${baseOffset + i}`, baseOffset + i);
    }
    const id = chars.slice(i, i + 2).join('');
    const lenStr = chars.slice(i + 2, i + 4).join('');
    if (!/^\d\d$/.test(id)) throw new TlvError(`ID inválido "${id}" na posição ${baseOffset + i}`, baseOffset + i);
    if (!/^\d\d$/.test(lenStr)) throw new TlvError(`Comprimento inválido "${lenStr}" no ID ${id}`, baseOffset + i);
    const length = parseInt(lenStr, 10);
    if (i + 4 + length > chars.length) {
      throw new TlvError(`O ID ${id} declara ${length} caracteres, mas só restam ${chars.length - i - 4}`, baseOffset + i);
    }
    nodes.push({ id, length, value: chars.slice(i + 4, i + 4 + length).join(''), offset: baseOffset + i });
    i += 4 + length;
  }
  return nodes;
}

/** Tenta interpretar o valor como template; retorna undefined se não for TLV válido. */
export function tryParseTemplate(node: TlvNode): TlvNode[] | undefined {
  try { return parseTlv(node.value, node.offset + 4); } catch { return undefined; }
}
