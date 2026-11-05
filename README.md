# Leitor QR

Aplicativo móvel (Android e iOS) em **Expo / React Native + TypeScript** que lê vários formatos de códigos.

## Formatos de código lidos
QR Code · Aztec · Data Matrix · PDF417 · EAN-13 · EAN-8 · UPC-A · UPC-E · Code 39 · Code 93 · Code 128 · Codabar · ITF-14

## Conteúdos reconhecidos
| Tipo | Exemplo | Ação |
|---|---|---|
| Link | `https://...` | Abrir no navegador |
| Wi-Fi | `WIFI:T:WPA;S:Rede;P:senha;;` | Mostra rede e senha (copiar) |
| Pagamento EMV | `000201...6304XXXX` (Pix, PromptPay, QRIS...) | Decodifica e valida conforme EMVCo |
| Contato | vCard / MeCard | Ligar |
| E-mail | `mailto:` / `MATMSG:` | Enviar e-mail |
| Telefone / SMS | `tel:` / `SMSTO:` | Ligar / enviar SMS |
| Localização | `geo:lat,lng` | Abrir no mapa |
| Evento | `BEGIN:VEVENT` | Mostra os dados |
| Produto | EAN/UPC | Pesquisar produto |
| Texto | qualquer outro | Copiar / compartilhar |

## Conformidade EMV (QR de pagamento)
O app decodifica e valida QR Codes de pagamento segundo a **EMV® QR Code Specification for
Payment Systems — Merchant-Presented Mode v1.1** (módulo `src/emv/`):

- Leitura ID/Length/Value com comprimentos em caracteres Unicode (Anexo B)
- **CRC-16/CCITT-FALSE** (ISO/IEC 13239, polinômio `1021`, inicial `FFFF`) sobre os bytes UTF-8 — §4.7.3
- Objetos obrigatórios, ordem (`00` primeiro, `63` por último) e IDs únicos — §4.2, §4.3, §4.6
- Formato (N / ans / S) e comprimento fixo ou máximo de cada objeto — Tabelas 3.6–3.8
- Valor, moeda (ISO 4217, com casas decimais), gorjeta e taxas de conveniência — §4.7.4–4.7.8
- Contas do comerciante: primitivas `02`–`25` (Visa, Mastercard, ...) e templates `26`–`51` com GUI — §4.7.9–4.7.11
- Dados adicionais `62` (valores `***`, ID `09` A/M/E, canal do comerciante) — §4.8
- Idioma alternativo `64`, IDs RFU `65`–`79` e templates não reservados `80`–`99` — §4.9–4.11
- Reconhece Pix (chave, descrição, URL dinâmica), PromptPay, QRIS, PayNow, QR Ph

Cada problema aparece na tela com o ID do objeto e a seção da especificação correspondente.

Testes (incluem o exemplo oficial do Anexo B): `npm test`

## Funcionalidades
- Leitura pela câmera, com lanterna
- Leitura a partir de uma imagem da galeria
- Histórico local das leituras (toque para abrir, segure para apagar)
- Copiar e compartilhar o conteúdo

## Como rodar
```bash
npm install
npx expo start
```
Escaneie o QR exibido no terminal com o app **Expo Go** no celular.

> A leitura de imagens da galeria pode exigir um *development build* (`npx expo run:android` / `npx expo run:ios`) em vez do Expo Go.

## Estrutura
```
App.tsx                      Telas: scanner e histórico
src/formats.ts               Lista de formatos suportados
src/parseContent.ts          Interpretação do conteúdo (URL, Wi-Fi, vCard, pagamento...)
src/emv/                     Decodificador e validador EMV MPM v1.1 (TLV, CRC, regras)
src/history.ts               Histórico salvo com AsyncStorage
src/components/ResultSheet.tsx  Painel de resultado com ações
src/components/EmvDetails.tsx   Conformidade EMV e árvore de objetos
```
