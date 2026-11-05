/** Interpreta o conteúdo de um código (URL, Wi-Fi, contato, Pix, etc.). */
export type ContentKind =
  | 'url' | 'wifi' | 'email' | 'phone' | 'sms' | 'geo'
  | 'vcard' | 'mecard' | 'event' | 'pix' | 'product' | 'text';

export interface ParsedContent {
  kind: ContentKind;
  title: string;
  fields: { label: string; value: string }[];
  /** Link que pode ser aberto com Linking.openURL, se houver. */
  action?: { label: string; url: string };
}

const KIND_TITLES: Record<ContentKind, string> = {
  url: 'Link', wifi: 'Rede Wi-Fi', email: 'E-mail', phone: 'Telefone', sms: 'SMS',
  geo: 'Localização', vcard: 'Contato (vCard)', mecard: 'Contato (MeCard)',
  event: 'Evento', pix: 'Pix', product: 'Produto', text: 'Texto',
};

/** Divide "A:1;B:2;" respeitando escapes com "\". */
function splitKeyValues(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let key = '', val = '', inKey = true, esc = false;
  for (const ch of body) {
    if (esc) { (inKey ? (key += ch) : (val += ch)); esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (inKey && ch === ':') { inKey = false; continue; }
    if (!inKey && ch === ';') { if (key) out[key.toUpperCase()] = val; key = ''; val = ''; inKey = true; continue; }
    inKey ? (key += ch) : (val += ch);
  }
  if (key && !inKey) out[key.toUpperCase()] = val;
  return out;
}

/** Lê campos TLV do padrão EMV (usado pelo Pix). */
function parseEmv(data: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= data.length) {
    const id = data.slice(i, i + 2);
    const len = parseInt(data.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len) || i + 4 + len > data.length) return null;
    out[id] = data.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return i === data.length ? out : null;
}

function make(kind: ContentKind, fields: ParsedContent['fields'], action?: ParsedContent['action']): ParsedContent {
  return { kind, title: KIND_TITLES[kind], fields: fields.filter(f => f.value), action };
}

export function parseContent(raw: string, format?: string): ParsedContent {
  const data = raw.trim();
  const upper = data.toUpperCase();

  // Códigos de produto (EAN/UPC)
  if (format && /ean|upc|itf/i.test(format) && /^\d+$/.test(data)) {
    return make('product', [{ label: 'Código', value: data }],
      { label: 'Pesquisar produto', url: `https://www.google.com/search?q=${data}` });
  }

  if (/^https?:\/\//i.test(data) || /^www\.[^\s]+\.[a-z]{2,}/i.test(data)) {
    const url = data.startsWith('www.') ? `https://${data}` : data;
    return make('url', [{ label: 'Endereço', value: url }], { label: 'Abrir link', url });
  }

  if (upper.startsWith('WIFI:')) {
    const kv = splitKeyValues(data.slice(5));
    return make('wifi', [
      { label: 'Rede (SSID)', value: kv.S ?? '' },
      { label: 'Senha', value: kv.P ?? '' },
      { label: 'Segurança', value: kv.T || 'Aberta' },
      { label: 'Oculta', value: kv.H === 'true' ? 'Sim' : '' },
    ]);
  }

  if (upper.startsWith('MAILTO:') || upper.startsWith('MATMSG:')) {
    if (upper.startsWith('MATMSG:')) {
      const kv = splitKeyValues(data.slice(7));
      const url = `mailto:${kv.TO ?? ''}?subject=${encodeURIComponent(kv.SUB ?? '')}&body=${encodeURIComponent(kv.BODY ?? '')}`;
      return make('email', [
        { label: 'Para', value: kv.TO ?? '' }, { label: 'Assunto', value: kv.SUB ?? '' }, { label: 'Mensagem', value: kv.BODY ?? '' },
      ], { label: 'Enviar e-mail', url });
    }
    const [addr, query = ''] = data.slice(7).split('?');
    const params = new URLSearchParams(query);
    return make('email', [
      { label: 'Para', value: decodeURIComponent(addr) },
      { label: 'Assunto', value: params.get('subject') ?? '' },
      { label: 'Mensagem', value: params.get('body') ?? '' },
    ], { label: 'Enviar e-mail', url: data });
  }

  if (upper.startsWith('TEL:')) {
    const n = data.slice(4);
    return make('phone', [{ label: 'Número', value: n }], { label: 'Ligar', url: `tel:${n}` });
  }

  if (upper.startsWith('SMSTO:') || upper.startsWith('SMS:')) {
    const rest = data.slice(data.indexOf(':') + 1);
    const [num, ...msg] = rest.split(/[:?]/);
    const body = msg.join(':').replace(/^body=/i, '');
    return make('sms', [{ label: 'Número', value: num }, { label: 'Mensagem', value: body }],
      { label: 'Enviar SMS', url: `sms:${num}${body ? `?body=${encodeURIComponent(body)}` : ''}` });
  }

  if (upper.startsWith('GEO:')) {
    const [coords, query = ''] = data.slice(4).split('?');
    const [lat, lng] = coords.split(',');
    return make('geo', [
      { label: 'Latitude', value: lat ?? '' }, { label: 'Longitude', value: lng ?? '' },
      { label: 'Busca', value: new URLSearchParams(query).get('q') ?? '' },
    ], { label: 'Abrir no mapa', url: `https://maps.google.com/?q=${lat},${lng}` });
  }

  if (upper.startsWith('BEGIN:VCARD')) {
    const get = (k: string) => {
      const m = data.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, 'im'));
      return m ? m[1].trim().replace(/;+/g, ' ').trim() : '';
    };
    const tel = get('TEL');
    return make('vcard', [
      { label: 'Nome', value: get('FN') || get('N') },
      { label: 'Telefone', value: tel }, { label: 'E-mail', value: get('EMAIL') },
      { label: 'Empresa', value: get('ORG') }, { label: 'Cargo', value: get('TITLE') },
      { label: 'Endereço', value: get('ADR') }, { label: 'Site', value: get('URL') },
    ], tel ? { label: 'Ligar', url: `tel:${tel}` } : undefined);
  }

  if (upper.startsWith('MECARD:')) {
    const kv = splitKeyValues(data.slice(7));
    return make('mecard', [
      { label: 'Nome', value: (kv.N ?? '').replace(',', ' ') }, { label: 'Telefone', value: kv.TEL ?? '' },
      { label: 'E-mail', value: kv.EMAIL ?? '' }, { label: 'Endereço', value: kv.ADR ?? '' },
      { label: 'Site', value: kv.URL ?? '' }, { label: 'Nota', value: kv.NOTE ?? '' },
    ], kv.TEL ? { label: 'Ligar', url: `tel:${kv.TEL}` } : undefined);
  }

  if (upper.includes('BEGIN:VEVENT')) {
    const get = (k: string) => data.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, 'im'))?.[1]?.trim() ?? '';
    return make('event', [
      { label: 'Título', value: get('SUMMARY') }, { label: 'Início', value: get('DTSTART') },
      { label: 'Fim', value: get('DTEND') }, { label: 'Local', value: get('LOCATION') },
      { label: 'Descrição', value: get('DESCRIPTION') },
    ]);
  }

  // Pix "copia e cola" (BR Code / EMV)
  if (data.startsWith('000201')) {
    const emv = parseEmv(data);
    if (emv && (emv['26'] ?? '').toLowerCase().includes('br.gov.bcb.pix')) {
      const acct = parseEmv(emv['26']) ?? {};
      return make('pix', [
        { label: 'Recebedor', value: emv['59'] ?? '' }, { label: 'Cidade', value: emv['60'] ?? '' },
        { label: 'Chave', value: acct['01'] ?? '' }, { label: 'Valor (R$)', value: emv['54'] ?? '' },
        { label: 'Descrição', value: acct['02'] ?? '' }, { label: 'URL dinâmica', value: acct['25'] ?? '' },
      ]);
    }
  }

  return make('text', [{ label: 'Conteúdo', value: data }]);
}
