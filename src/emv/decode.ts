/**
 * Decodificação e validação de QR Codes EMV Merchant-Presented Mode
 * conforme EMV QRCPS-MPM v1.1. Cada problema aponta a regra da especificação.
 */
import { crc16 } from './crc';
import {
  ADDITIONAL_DATA, CHANNEL_LOCATION, CHANNEL_MEDIA, CHANNEL_PRESENCE, CONSUMER_DATA, COUNTRIES,
  CURRENCIES, KNOWN_GUIS, LANGUAGE_TEMPLATE, POINT_OF_INITIATION, PIX_FIELDS, ROOT, TIP_INDICATOR,
  merchantAccountOwner, type ObjectSpec,
} from './dictionary';
import { parseTlv, TlvError, type TlvNode } from './tlv';

export interface EmvField {
  id: string;
  /** Caminho do objeto, ex.: "62.05" */
  path: string;
  name: string;
  value: string;
  /** Valor interpretado para exibição (ex.: "CLP – 0 decimais"). */
  display?: string;
  children?: EmvField[];
}

export interface EmvIssue {
  level: 'error' | 'warning';
  path: string;
  rule: string;
  message: string;
}

export interface EmvSummary {
  merchantName?: string;
  merchantNameAlt?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  mcc?: string;
  currency?: string;
  amount?: string;
  /** Valor formatado com a moeda, ex.: "CLP 15000". */
  amountDisplay?: string;
  tip?: string;
  initiation?: string;
  networks: string[];
  pixKey?: string;
}

export interface EmvResult {
  valid: boolean;
  crc: { found?: string; expected?: string; ok: boolean };
  fields: EmvField[];
  issues: EmvIssue[];
  summary: EmvSummary;
}

/** Common Character Set do EMV Book 4: ASCII imprimível 0x20–0x7E. */
const ANS = /^[\x20-\x7E]*$/;
const NUM = /^\d*$/;
const GUI_MAX = 32;

/** Detecção rápida: payload EMV MPM começa com o ID "00" de comprimento "02". */
export function looksLikeEmv(data: string): boolean {
  return /^0002\d\d/.test(data) && data.length >= 12 && /6304[0-9A-Fa-f]{4}$/.test(data.trim());
}

export function decodeEmv(raw: string): EmvResult {
  const data = raw.replace(/[\r\n]+$/, '');
  const issues: EmvIssue[] = [];
  const err = (path: string, rule: string, message: string) => issues.push({ level: 'error', path, rule, message });
  const warn = (path: string, rule: string, message: string) => issues.push({ level: 'warning', path, rule, message });
  const summary: EmvSummary = { networks: [] };

  let root: TlvNode[];
  try {
    root = parseTlv(data);
  } catch (e) {
    const msg = e instanceof TlvError ? e.message : String(e);
    err('', '3.2', `Estrutura TLV inválida: ${msg}`);
    return { valid: false, crc: { ok: false }, fields: [], issues, summary };
  }

  // 4.1 — tamanho máximo recomendado
  if (Array.from(data).length > 512) warn('', '4.1', 'O payload passa de 512 caracteres.');

  // 4.6.1 — posição do 00 e do 63
  if (root[0]?.id !== '00') err('00', '4.6.1.1', 'O indicador de formato (ID 00) deve ser o primeiro objeto.');
  const last = root[root.length - 1];
  if (last?.id !== '63') err('63', '4.6.1.2', 'O CRC (ID 63) deve ser o último objeto.');

  // 4.7.3 — CRC
  const crc: EmvResult['crc'] = { ok: false };
  const crcNode = root.find(n => n.id === '63');
  if (crcNode) {
    const chars = Array.from(data);
    const covered = chars.slice(0, crcNode.offset + 4).join('');
    crc.found = crcNode.value.toUpperCase();
    crc.expected = crc16(covered);
    crc.ok = crc.found === crc.expected && crcNode.length === 4;
    if (!crc.ok) err('63', '4.7.3', `CRC inválido: encontrado ${crcNode.value}, esperado ${crc.expected}.`);
    if (crcNode.value !== crcNode.value.toUpperCase()) err('63', '4.7.3.2', 'O CRC deve usar letras maiúsculas (A–F).');
  }

  checkUnique(root, '', err);

  // 4.2.1.1 — obrigatórios na raiz
  const byId = new Map(root.map(n => [n.id, n]));
  for (const [id, spec] of Object.entries(ROOT)) {
    if (spec.presence === 'M' && !byId.has(id)) err(id, '4.2.1.1', `Objeto obrigatório ausente: ${spec.name} (ID ${id}).`);
  }
  if (!root.some(n => isMerchantAccount(n.id))) {
    err('02-51', '4.7.9.1', 'É obrigatório pelo menos uma informação de conta do comerciante (IDs 02 a 51).');
  }

  const currencyCode = byId.get('53')?.value;
  const currency = currencyCode ? CURRENCIES[currencyCode] : undefined;

  const fields: EmvField[] = [];
  for (const node of root) {
    const id = node.id;
    const n = parseInt(id, 10);
    const spec = ROOT[id];

    if (spec && !spec.template) {
      checkSpec(node, spec, id, err);
      fields.push({ id, path: id, name: spec.name, value: node.value, display: describeRoot(node, currency) });
      continue;
    }

    if (n >= 2 && n <= 25) {
      // 4.7.10 — conta primitiva, rede identificada pelo ID
      const owner = merchantAccountOwner(id);
      if (owner === 'Reservado EMVCo') warn(id, '4.7.9 / Tabela 4.1', `O ID ${id} é reservado pela EMVCo.`);
      if (!ANS.test(node.value)) err(id, '4.5.2.1', `Conta do comerciante (ID ${id}) deve usar o conjunto de caracteres ans.`);
      summary.networks.push(owner);
      fields.push({ id, path: id, name: `Conta do comerciante – ${owner}`, value: node.value });
      continue;
    }

    if (n >= 26 && n <= 51) {
      fields.push(decodeGuiTemplate(node, id, `Conta do comerciante (template ${id})`, '4.7.11.2', err, summary));
      continue;
    }

    if (id === '62') { fields.push(decodeAdditional(node, err, warn)); continue; }
    if (id === '64') { fields.push(decodeLanguage(node, err, summary)); continue; }

    if (n >= 65 && n <= 79) {
      err(id, '4.5.4.1', `O ID ${id} é RFU (reservado para uso futuro da EMVCo) e não deve ser incluído.`);
      fields.push({ id, path: id, name: 'RFU EMVCo', value: node.value });
      continue;
    }

    if (n >= 80 && n <= 99) {
      fields.push(decodeGuiTemplate(node, id, `Template não reservado ${id}`, '4.11.1.2', err));
      continue;
    }
  }

  // 4.7.4 / 4.7.6–4.7.8 — regras de valor e gorjeta
  const amount = byId.get('54')?.value;
  if (amount !== undefined) {
    checkAmount(amount, '54', 'Valor da transação', '4.7.4.1', err);
    if (currency && /^\d+(\.\d*)?$/.test(amount)) {
      const decimals = amount.includes('.') ? amount.split('.')[1].length : 0;
      if (decimals > currency[1] || (decimals > 0 && decimals !== currency[1])) {
        warn('54', '4.7.4.1', `O ${currency[0]} usa ${currency[1]} casa(s) decimal(is); o valor tem ${decimals}.`);
      }
    }
  }
  const tip = byId.get('55')?.value;
  if (tip !== undefined && !TIP_INDICATOR[tip]) err('55', '4.7.6.1', 'Indicador de gorjeta deve ser 01, 02 ou 03.');
  const fixedFee = byId.get('56')?.value;
  const pctFee = byId.get('57')?.value;
  if (tip === '02' && fixedFee === undefined) err('56', '4.7.7.1', 'Com indicador 02, a taxa fixa (ID 56) é obrigatória.');
  if (tip !== '02' && fixedFee !== undefined) err('56', '4.7.7.1', 'A taxa fixa (ID 56) só pode existir com indicador 02.');
  if (fixedFee !== undefined) checkAmount(fixedFee, '56', 'Taxa fixa', '4.7.7.2', err);
  if (tip === '03' && pctFee === undefined) err('57', '4.7.8.1', 'Com indicador 03, a taxa percentual (ID 57) é obrigatória.');
  if (tip !== '03' && pctFee !== undefined) err('57', '4.7.8.1', 'A taxa percentual (ID 57) só pode existir com indicador 03.');
  if (pctFee !== undefined) {
    const v = parseFloat(pctFee);
    if (!/^\d+(\.\d*)?$/.test(pctFee) || !(v >= 0.01 && v <= 99.99)) {
      err('57', '4.7.8.1', 'A taxa percentual deve ser um número entre 00.01 e 99.99, sem "%".');
    }
  }

  // Resumo para a interface
  summary.merchantName = byId.get('59')?.value;
  summary.city = byId.get('60')?.value;
  const cc = byId.get('58')?.value;
  summary.country = cc ? (COUNTRIES[cc.toUpperCase()] ? `${COUNTRIES[cc.toUpperCase()]} (${cc})` : cc) : undefined;
  summary.postalCode = byId.get('61')?.value;
  summary.mcc = byId.get('52')?.value;
  summary.currency = currency ? currency[0] : currencyCode;
  summary.amount = amount;
  summary.amountDisplay = amount ? `${summary.currency ?? ''} ${amount}`.trim() : undefined;
  summary.tip = tip ? TIP_INDICATOR[tip] : undefined;
  const poi = byId.get('01')?.value;
  summary.initiation = poi ? POINT_OF_INITIATION[poi] : undefined;

  return { valid: !issues.some(i => i.level === 'error'), crc, fields, issues, summary };
}

function isMerchantAccount(id: string) {
  const n = parseInt(id, 10);
  return n >= 2 && n <= 51;
}

type Report = (path: string, rule: string, message: string) => void;

/** 4.3.1.2 — cada ID aparece uma única vez em cada nível. */
function checkUnique(nodes: TlvNode[], prefix: string, err: Report) {
  const seen = new Set<string>();
  for (const n of nodes) {
    const path = prefix ? `${prefix}.${n.id}` : n.id;
    if (seen.has(n.id)) err(path, '4.3.1.2', `O ID ${n.id} aparece mais de uma vez${prefix ? ` no template ${prefix}` : ''}.`);
    seen.add(n.id);
  }
}

/** Verifica formato (N/ans/S) e comprimento conforme o dicionário. */
function checkSpec(node: TlvNode, spec: ObjectSpec, path: string, err: Report) {
  if (spec.fixed !== undefined && node.length !== spec.fixed) {
    err(path, '4.4 / Tabela 3.6', `${spec.name} deve ter exatamente ${spec.fixed} caracteres (tem ${node.length}).`);
  }
  if (spec.max !== undefined && node.length > spec.max) {
    err(path, '4.4 / Tabela 3.6', `${spec.name} deve ter no máximo ${spec.max} caracteres (tem ${node.length}).`);
  }
  if (spec.format === 'N' && !NUM.test(node.value)) err(path, '4.5.1.1', `${spec.name} deve conter apenas dígitos.`);
  if (spec.format === 'ans' && !ANS.test(node.value)) {
    err(path, '4.5.2.1', `${spec.name} contém caracteres fora do conjunto comum (ans).`);
  }
  if (node.length === 0) err(path, '4.4.1.2', `${spec.name} não pode ter comprimento 00.`);

  if (path === '00' && node.value !== '01') err(path, '4.7.1.1', 'O indicador de formato deve ser "01".');
  if (path === '01' && !POINT_OF_INITIATION[node.value]) err(path, '4.7.2.1', 'O método de iniciação deve ser 11 ou 12.');
  if (path === '53' && /^\d{3}$/.test(node.value) && !CURRENCIES[node.value]) {
    // Não é erro: a tabela embutida é parcial.
  }
  if (path === '58' && !/^[A-Z]{2}$/.test(node.value)) err(path, '4.7.13.1', 'O código do país deve ter 2 letras (ISO 3166-1 alpha-2).');
}

function checkAmount(value: string, path: string, name: string, rule: string, err: Report) {
  if (!/^\d+(\.\d*)?$/.test(value) || (value.match(/\./g)?.length ?? 0) > 1) {
    err(path, rule, `${name} deve conter apenas dígitos e no máximo um "." (ex.: 98.73).`);
  } else if (parseFloat(value) === 0) {
    err(path, rule, `${name} deve ser diferente de zero.`);
  }
}

function describeRoot(node: TlvNode, currency?: [string, number]): string | undefined {
  switch (node.id) {
    case '00': return node.value === '01' ? 'Versão 01' : undefined;
    case '01': return POINT_OF_INITIATION[node.value];
    case '53': return currency ? `${currency[0]} (${currency[1]} casas decimais)` : undefined;
    case '55': return TIP_INDICATOR[node.value];
    case '57': return `${node.value}%`;
    case '58': return COUNTRIES[node.value.toUpperCase()];
    default: return undefined;
  }
}

function parseChildren(node: TlvNode, path: string, err: Report): TlvNode[] | undefined {
  try {
    const children = parseTlv(node.value, node.offset + 4);
    checkUnique(children, path, err);
    return children;
  } catch (e) {
    err(path, '3.2', `Template ${path} com estrutura TLV inválida: ${e instanceof Error ? e.message : e}`);
    return undefined;
  }
}

/** Templates com GUI obrigatório no ID "00": 26–51, 62[50–99] e 80–99. */
function decodeGuiTemplate(
  node: TlvNode, path: string, name: string, rule: string, err: Report, summary?: EmvSummary,
): EmvField {
  const field: EmvField = { id: node.id, path, name, value: node.value, children: [] };
  const children = parseChildren(node, path, err);
  if (!children) return field;

  const gui = children.find(c => c.id === '00')?.value;
  if (gui === undefined) err(`${path}.00`, rule, `O template ${path} precisa do identificador global (GUI) no ID 00.`);
  else {
    if (gui.length > GUI_MAX) err(`${path}.00`, rule, `O GUI deve ter no máximo ${GUI_MAX} caracteres.`);
    if (!ANS.test(gui)) err(`${path}.00`, rule, 'O GUI deve usar o conjunto de caracteres ans.');
  }
  const known = gui ? KNOWN_GUIS[gui.toLowerCase()] : undefined;
  const isPix = gui?.toLowerCase() === 'br.gov.bcb.pix';
  if (gui) field.display = known ?? gui;
  if (summary) summary.networks.push(known ?? gui ?? `Template ${path}`);

  for (const c of children) {
    const label = c.id === '00' ? 'Identificador global (GUI)'
      : isPix && PIX_FIELDS[c.id] ? PIX_FIELDS[c.id]
      : `Dado específico (ID ${c.id})`;
    if (isPix && c.id === '01' && summary) summary.pixKey = c.value;
    field.children!.push({ id: c.id, path: `${path}.${c.id}`, name: label, value: c.value, display: c.id === '00' ? known : undefined });
  }
  return field;
}

/** 4.8 — Additional Data Field Template (ID "62"). */
function decodeAdditional(node: TlvNode, err: Report, warn: Report): EmvField {
  const field: EmvField = { id: '62', path: '62', name: ROOT['62'].name, value: node.value, children: [] };
  checkSpec(node, ROOT['62'], '62', err);
  const children = parseChildren(node, '62', err);
  if (!children) return field;
  if (!children.length) err('62', '4.8.1.1', 'O template de dados adicionais deve ter pelo menos 1 objeto.');

  for (const c of children) {
    const path = `62.${c.id}`;
    const n = parseInt(c.id, 10);
    const spec = ADDITIONAL_DATA[c.id];
    if (spec) {
      checkSpec(c, spec, path, err);
      let display: string | undefined;
      if (n >= 1 && n <= 8 && c.value === '***') display = 'O app deve pedir este dado ao consumidor';
      if (c.id === '09') {
        const letters = c.value.split('');
        if (!letters.every(l => CONSUMER_DATA[l]) || new Set(letters).size !== letters.length) {
          err(path, '4.8.1.3', 'Deve conter apenas A, M e/ou E, sem repetir.');
        }
        display = `Enviar: ${letters.map(l => CONSUMER_DATA[l] ?? l).join(', ')}`;
      }
      if (c.id === '11') {
        const [m, l, p] = c.value.split('');
        if (!CHANNEL_MEDIA[m] || !CHANNEL_LOCATION[l] || !CHANNEL_PRESENCE[p]) {
          err(path, '4.8.1.6', 'Canal do comerciante com valor fora das tabelas 4.5–4.7.');
        }
        display = [CHANNEL_MEDIA[m], CHANNEL_LOCATION[l], CHANNEL_PRESENCE[p]].filter(Boolean).join(' · ');
      }
      field.children!.push({ id: c.id, path, name: spec.name, value: c.value, display });
    } else if (n >= 12 && n <= 49) {
      warn(path, '4.8.1.4 / Tabela 4.3', `O ID ${c.id} em dados adicionais é RFU da EMVCo.`);
      field.children!.push({ id: c.id, path, name: 'RFU EMVCo', value: c.value });
    } else if (n >= 50) {
      field.children!.push(decodeGuiTemplate(c, path, `Template do sistema de pagamento ${c.id}`, '4.8.1.5', err));
    } else {
      field.children!.push({ id: c.id, path, name: `ID ${c.id}`, value: c.value });
    }
  }
  return field;
}

/** 4.9 — Merchant Information—Language Template (ID "64"). */
function decodeLanguage(node: TlvNode, err: Report, summary: EmvSummary): EmvField {
  const field: EmvField = { id: '64', path: '64', name: ROOT['64'].name, value: node.value, children: [] };
  const children = parseChildren(node, '64', err);
  if (!children) return field;
  const ids = new Set(children.map(c => c.id));
  if (!ids.has('00')) err('64.00', '4.9.1.1', 'O template 64 precisa do idioma (ID 00).');
  if (!ids.has('01')) err('64.01', '4.9.1.1', 'O template 64 precisa do nome no idioma alternativo (ID 01).');
  for (const c of children) {
    const path = `64.${c.id}`;
    const spec = LANGUAGE_TEMPLATE[c.id];
    if (!spec) {
      err(path, '4.9.1.1', `O ID ${c.id} no template 64 é RFU da EMVCo.`);
      field.children!.push({ id: c.id, path, name: 'RFU EMVCo', value: c.value });
      continue;
    }
    checkSpec(c, spec, path, err);
    if (c.id === '00' && !/^[A-Za-z]{2}$/.test(c.value)) err(path, '4.9.2.1', 'O idioma deve ter 2 letras (ISO 639).');
    if (c.id === '01') summary.merchantNameAlt = c.value;
    field.children!.push({ id: c.id, path, name: spec.name, value: c.value });
  }
  return field;
}
