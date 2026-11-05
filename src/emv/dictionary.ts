/** Dicionário de objetos de dados — Tabelas 3.6, 3.7, 3.8, 4.1 e 4.5–4.7 do EMV QRCPS-MPM v1.1. */
export type Format = 'N' | 'ans' | 'S';
export type Presence = 'M' | 'C' | 'O';

export interface ObjectSpec {
  name: string;
  format: Format;
  /** Comprimento fixo. */
  fixed?: number;
  /** Comprimento máximo (var. up to). */
  max?: number;
  presence: Presence;
  template?: boolean;
}

export const ROOT: Record<string, ObjectSpec> = {
  '00': { name: 'Indicador de formato do payload', format: 'N', fixed: 2, presence: 'M' },
  '01': { name: 'Método de iniciação', format: 'N', fixed: 2, presence: 'O' },
  '52': { name: 'Código de categoria do comerciante (MCC)', format: 'N', fixed: 4, presence: 'M' },
  '53': { name: 'Moeda da transação', format: 'N', fixed: 3, presence: 'M' },
  '54': { name: 'Valor da transação', format: 'ans', max: 13, presence: 'C' },
  '55': { name: 'Indicador de gorjeta/taxa', format: 'N', fixed: 2, presence: 'O' },
  '56': { name: 'Taxa de conveniência fixa', format: 'ans', max: 13, presence: 'C' },
  '57': { name: 'Taxa de conveniência (%)', format: 'ans', max: 5, presence: 'C' },
  '58': { name: 'Código do país', format: 'ans', fixed: 2, presence: 'M' },
  '59': { name: 'Nome do comerciante', format: 'ans', max: 25, presence: 'M' },
  '60': { name: 'Cidade do comerciante', format: 'ans', max: 15, presence: 'M' },
  '61': { name: 'Código postal', format: 'ans', max: 10, presence: 'O' },
  '62': { name: 'Dados adicionais', format: 'S', max: 99, presence: 'O', template: true },
  '63': { name: 'CRC', format: 'ans', fixed: 4, presence: 'M' },
  '64': { name: 'Informações em idioma alternativo', format: 'S', max: 99, presence: 'O', template: true },
};

/** Tabela 4.1 — alocação dos IDs "02" a "51". */
export function merchantAccountOwner(id: string): string {
  const n = parseInt(id, 10);
  if (n <= 3) return 'Visa';
  if (n <= 5) return 'Mastercard';
  if (n <= 8) return 'Reservado EMVCo';
  if (n <= 10) return 'Discover';
  if (n <= 12) return 'Amex';
  if (n <= 14) return 'JCB';
  if (n <= 16) return 'UnionPay';
  if (n <= 25) return 'Reservado EMVCo';
  return 'Template de rede de pagamento';
}

export const ADDITIONAL_DATA: Record<string, ObjectSpec> = {
  '01': { name: 'Número da fatura', format: 'ans', max: 25, presence: 'O' },
  '02': { name: 'Número de celular', format: 'ans', max: 25, presence: 'O' },
  '03': { name: 'Identificação da loja', format: 'ans', max: 25, presence: 'O' },
  '04': { name: 'Número de fidelidade', format: 'ans', max: 25, presence: 'O' },
  '05': { name: 'Referência', format: 'ans', max: 25, presence: 'O' },
  '06': { name: 'Identificação do cliente', format: 'ans', max: 25, presence: 'O' },
  '07': { name: 'Identificação do terminal', format: 'ans', max: 25, presence: 'O' },
  '08': { name: 'Finalidade da transação', format: 'ans', max: 25, presence: 'O' },
  '09': { name: 'Dados solicitados ao consumidor', format: 'ans', max: 3, presence: 'O' },
  '10': { name: 'ID fiscal do comerciante', format: 'ans', max: 20, presence: 'O' },
  '11': { name: 'Canal do comerciante', format: 'ans', fixed: 3, presence: 'O' },
};

export const LANGUAGE_TEMPLATE: Record<string, ObjectSpec> = {
  '00': { name: 'Idioma', format: 'ans', fixed: 2, presence: 'M' },
  '01': { name: 'Nome (idioma alternativo)', format: 'S', max: 25, presence: 'M' },
  '02': { name: 'Cidade (idioma alternativo)', format: 'S', max: 15, presence: 'O' },
};

export const POINT_OF_INITIATION: Record<string, string> = {
  '11': 'Estático (reutilizável)',
  '12': 'Dinâmico (uso único)',
};

export const TIP_INDICATOR: Record<string, string> = {
  '01': 'Consumidor informa a gorjeta',
  '02': 'Taxa de conveniência fixa',
  '03': 'Taxa de conveniência percentual',
};

export const CONSUMER_DATA: Record<string, string> = { A: 'endereço', M: 'celular', E: 'e-mail' };

/** Tabelas 4.5, 4.6 e 4.7. */
export const CHANNEL_MEDIA: Record<string, string> = {
  '0': 'Impresso – adesivo', '1': 'Impresso – boleto/fatura', '2': 'Impresso – revista/cartaz',
  '3': 'Impresso – outro', '4': 'Tela – PDV', '5': 'Tela – site', '6': 'Tela – app', '7': 'Tela – outro',
};
export const CHANNEL_LOCATION: Record<string, string> = {
  '0': 'No estabelecimento', '1': 'Fora do estabelecimento', '2': 'Comércio remoto', '3': 'Outro',
};
export const CHANNEL_PRESENCE: Record<string, string> = {
  '0': 'Atendido', '1': 'Autoatendimento', '2': 'Semi-atendido (self-checkout)', '3': 'Outro',
};

/** ISO 4217 (seleção) — código numérico → [sigla, casas decimais]. */
export const CURRENCIES: Record<string, [string, number]> = {
  '032': ['ARS', 2], '036': ['AUD', 2], '068': ['BOB', 2], '124': ['CAD', 2], '152': ['CLP', 0],
  '156': ['CNY', 2], '170': ['COP', 2], '188': ['CRC', 2], '214': ['DOP', 2], '320': ['GTQ', 2],
  '340': ['HNL', 2], '344': ['HKD', 2], '356': ['INR', 2], '360': ['IDR', 2], '392': ['JPY', 0],
  '410': ['KRW', 0], '458': ['MYR', 2], '484': ['MXN', 2], '558': ['NIO', 2], '590': ['PAB', 2],
  '600': ['PYG', 0], '604': ['PEN', 2], '608': ['PHP', 2], '643': ['RUB', 2], '702': ['SGD', 2],
  '704': ['VND', 0], '710': ['ZAR', 2], '756': ['CHF', 2], '764': ['THB', 2], '784': ['AED', 2],
  '826': ['GBP', 2], '840': ['USD', 2], '858': ['UYU', 2], '901': ['TWD', 2], '928': ['VES', 2],
  '949': ['TRY', 2], '978': ['EUR', 2], '986': ['BRL', 2],
};

/** ISO 3166-1 alpha-2 (seleção). */
export const COUNTRIES: Record<string, string> = {
  AR: 'Argentina', AU: 'Austrália', BO: 'Bolívia', BR: 'Brasil', CA: 'Canadá', CL: 'Chile', CN: 'China',
  CO: 'Colômbia', CR: 'Costa Rica', DE: 'Alemanha', DO: 'Rep. Dominicana', EC: 'Equador', ES: 'Espanha',
  FR: 'França', GB: 'Reino Unido', GT: 'Guatemala', HK: 'Hong Kong', ID: 'Indonésia', IN: 'Índia',
  IT: 'Itália', JP: 'Japão', KR: 'Coreia do Sul', MX: 'México', MY: 'Malásia', PA: 'Panamá', PE: 'Peru',
  PH: 'Filipinas', PT: 'Portugal', PY: 'Paraguai', SG: 'Singapura', TH: 'Tailândia', US: 'Estados Unidos',
  UY: 'Uruguai', VE: 'Venezuela', VN: 'Vietnã', ZA: 'África do Sul',
};

/** GUIs conhecidos de templates de conta (IDs 26–51). */
export const KNOWN_GUIS: Record<string, string> = {
  'br.gov.bcb.pix': 'Pix (Banco Central do Brasil)',
  'a000000677010111': 'PromptPay (Tailândia)',
  'a000000615': 'UnionPay',
  'sg.paynow': 'PayNow (Singapura)',
  'com.p2pqrpay': 'QR Ph (Filipinas)',
  'id.co.qris.www': 'QRIS (Indonésia)',
};

/** Campos específicos do Pix dentro do template "26" (Manual do BR Code). */
export const PIX_FIELDS: Record<string, string> = {
  '01': 'Chave Pix', '02': 'Descrição', '25': 'URL do payload dinâmico',
};
