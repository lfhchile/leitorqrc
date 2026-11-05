/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc16, decodeEmv, looksLikeEmv, withCrc } from '../index';

/** Exemplo oficial do Anexo B.7 do EMV QRCPS-MPM v1.1. */
const ANNEX_B =
  '00020101021229300012D156000000000510A93FO3230Q31280012D15600000001030812345678' +
  '520441115802CN5914BEST TRANSPORT6007BEIJING64200002ZH0104最佳运输0202北京' +
  '540523.7253031565502016233030412340603***0708A60086670902ME91320016A0112233449988770708123456786304A13A';

const rules = (r: ReturnType<typeof decodeEmv>, level: 'error' | 'warning' = 'error') =>
  r.issues.filter(i => i.level === level).map(i => i.rule);

/** Monta um payload mínimo válido, permitindo trocar/remover objetos. */
function build(overrides: Record<string, string | null> = {}): string {
  const objs: [string, string][] = [
    ['00', '01'], ['01', '11'], ['26', '0014br.gov.bcb.pix011112345678901'],
    ['52', '0000'], ['53', '986'], ['54', '100.00'], ['58', 'BR'], ['59', 'FULANO DE TAL'], ['60', 'BRASILIA'],
  ];
  const map = new Map(objs);
  for (const [k, v] of Object.entries(overrides)) v === null ? map.delete(k) : map.set(k, v);
  const body = [...map].map(([id, v]) => id + String(Array.from(v).length).padStart(2, '0') + v).join('');
  return withCrc(body);
}

test('CRC-16/CCITT-FALSE do exemplo do Anexo B é A13A', () => {
  assert.equal(crc16(ANNEX_B.slice(0, -4)), 'A13A');
});

test('exemplo oficial do Anexo B é válido e decodificado', () => {
  const r = decodeEmv(ANNEX_B);
  assert.deepEqual(r.issues, []);
  assert.equal(r.valid, true);
  assert.equal(r.crc.ok, true);
  assert.equal(r.summary.merchantName, 'BEST TRANSPORT');
  assert.equal(r.summary.merchantNameAlt, '最佳运输');
  assert.equal(r.summary.city, 'BEIJING');
  assert.equal(r.summary.country, 'China (CN)');
  assert.equal(r.summary.currency, 'CNY');
  assert.equal(r.summary.amount, '23.72');
  assert.equal(r.summary.initiation, 'Dinâmico (uso único)');
  assert.deepEqual(r.summary.networks, ['D15600000000', 'D15600000001']);
  const add = r.fields.find(f => f.id === '62')!;
  assert.equal(add.children!.find(c => c.id === '06')!.display, 'O app deve pedir este dado ao consumidor');
  assert.equal(add.children!.find(c => c.id === '09')!.display, 'Enviar: celular, e-mail');
  const unreserved = r.fields.find(f => f.id === '91')!;
  assert.equal(unreserved.children![0].value, 'A011223344998877');
});

test('detecta payload EMV', () => {
  assert.equal(looksLikeEmv(ANNEX_B), true);
  assert.equal(looksLikeEmv('https://exemplo.com'), false);
});

test('CRC alterado é rejeitado (4.7.3)', () => {
  const r = decodeEmv(ANNEX_B.slice(0, -4) + 'FFFF');
  assert.equal(r.valid, false);
  assert.equal(r.crc.ok, false);
  assert.equal(r.crc.expected, 'A13A');
  assert.ok(rules(r).includes('4.7.3'));
});

test('payload Pix válido é reconhecido', () => {
  const r = decodeEmv(build());
  assert.deepEqual(r.issues, []);
  assert.equal(r.summary.pixKey, '12345678901');
  assert.deepEqual(r.summary.networks, ['Pix (Banco Central do Brasil)']);
  assert.equal(r.summary.amountDisplay, 'BRL 100.00');
});

test('objetos obrigatórios ausentes (4.2.1.1 e 4.7.9.1)', () => {
  const r = decodeEmv(build({ '59': null, '26': null }));
  assert.ok(rules(r).includes('4.2.1.1'));
  assert.ok(rules(r).includes('4.7.9.1'));
});

test('ordem: 00 primeiro e 63 por último (4.6.1)', () => {
  const body = '52040000' + '000201';
  const r = decodeEmv(withCrc(body));
  assert.ok(rules(r).includes('4.6.1.1'));
});

test('valor da transação (4.7.4.1)', () => {
  assert.ok(rules(decodeEmv(build({ '54': '98,73' }))).includes('4.7.4.1'));
  assert.ok(rules(decodeEmv(build({ '54': '0.00' }))).includes('4.7.4.1'));
  assert.deepEqual(rules(decodeEmv(build({ '54': '98.' }))), []);
});

test('casas decimais conforme ISO 4217 — CLP sem decimais', () => {
  const r = decodeEmv(build({ '53': '152', '58': 'CL', '54': '1500.50' }));
  assert.ok(rules(r, 'warning').includes('4.7.4.1'));
  assert.equal(r.summary.currency, 'CLP');
  assert.equal(r.summary.country, 'Chile (CL)');
});

test('gorjeta e taxas de conveniência (4.7.6–4.7.8)', () => {
  assert.ok(rules(decodeEmv(build({ '55': '02' }))).includes('4.7.7.1'));
  assert.deepEqual(rules(decodeEmv(build({ '55': '02', '56': '9.85' }))), []);
  assert.ok(rules(decodeEmv(build({ '55': '03', '57': '3%' }))).includes('4.7.8.1'));
  assert.deepEqual(rules(decodeEmv(build({ '55': '03', '57': '3.00' }))), []);
  assert.ok(rules(decodeEmv(build({ '56': '1.00' }))).includes('4.7.7.1'));
  assert.ok(rules(decodeEmv(build({ '55': '04' }))).includes('4.7.6.1'));
});

test('método de iniciação deve ser 11 ou 12 (4.7.2.1)', () => {
  assert.ok(rules(decodeEmv(build({ '01': '13' }))).includes('4.7.2.1'));
});

test('dados adicionais: ID 09 e canal (4.8.1.3, 4.8.1.6)', () => {
  assert.ok(rules(decodeEmv(build({ '62': '0902MM' }))).includes('4.8.1.3'));
  assert.ok(rules(decodeEmv(build({ '62': '0902MX' }))).includes('4.8.1.3'));
  const ok = decodeEmv(build({ '62': '1103521' }));
  assert.deepEqual(rules(ok), []);
  assert.equal(ok.fields.find(f => f.id === '62')!.children![0].display, 'Tela – site · Comércio remoto · Autoatendimento');
  assert.ok(rules(decodeEmv(build({ '62': '1103900' }))).includes('4.8.1.6'));
});

test('template de sistema de pagamento em 62 exige GUI (4.8.1.5)', () => {
  assert.ok(rules(decodeEmv(build({ '62': '50080104ABCD' }))).includes('4.8.1.5'));
});

test('template de idioma exige 00 e 01 (4.9.1.1)', () => {
  assert.ok(rules(decodeEmv(build({ '64': '0002ES' }))).includes('4.9.1.1'));
  assert.deepEqual(rules(decodeEmv(build({ '64': '0002ES0104Café' }))), []);
});

test('IDs RFU 65–79 não podem aparecer (4.5.4.1)', () => {
  assert.ok(rules(decodeEmv(build({ '70': 'X' }))).includes('4.5.4.1'));
});

test('template não reservado 80–99 exige GUI (4.11.1.2)', () => {
  assert.ok(rules(decodeEmv(build({ '80': '0103ABC' }))).includes('4.11.1.2'));
});

test('comprimentos fixos e máximos (Tabela 3.6)', () => {
  assert.ok(rules(decodeEmv(build({ '59': 'NOME MUITO LONGO PARA O CAMPO' }))).includes('4.4 / Tabela 3.6'));
  assert.ok(rules(decodeEmv(build({ '53': '98' }))).includes('4.4 / Tabela 3.6'));
});

test('caracteres fora do conjunto ans na raiz (4.5.2.1)', () => {
  assert.ok(rules(decodeEmv(build({ '59': 'CAFÉ' }))).includes('4.5.2.1'));
});

test('ID duplicado (4.3.1.2)', () => {
  const body = '000201' + '26180014br.gov.bcb.pix' + '520400005303986' + '5802BR' + '5802BR' + '5903ABC6003RIO';
  assert.ok(rules(decodeEmv(withCrc(body))).includes('4.3.1.2'));
});

test('TLV truncado é rejeitado (3.2)', () => {
  const r = decodeEmv('000201010211265000');
  assert.equal(r.valid, false);
  assert.ok(rules(r).includes('3.2'));
});
