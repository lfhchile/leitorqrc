# Leitor QR

Aplicativo móvel (Android e iOS) em **Expo / React Native + TypeScript** que lê vários formatos de códigos.

## Formatos de código lidos
QR Code · Aztec · Data Matrix · PDF417 · EAN-13 · EAN-8 · UPC-A · UPC-E · Code 39 · Code 93 · Code 128 · Codabar · ITF-14

## Conteúdos reconhecidos
| Tipo | Exemplo | Ação |
|---|---|---|
| Link | `https://...` | Abrir no navegador |
| Wi-Fi | `WIFI:T:WPA;S:Rede;P:senha;;` | Mostra rede e senha (copiar) |
| Pix (BR Code) | `000201...br.gov.bcb.pix...` | Mostra recebedor, chave, valor |
| Contato | vCard / MeCard | Ligar |
| E-mail | `mailto:` / `MATMSG:` | Enviar e-mail |
| Telefone / SMS | `tel:` / `SMSTO:` | Ligar / enviar SMS |
| Localização | `geo:lat,lng` | Abrir no mapa |
| Evento | `BEGIN:VEVENT` | Mostra os dados |
| Produto | EAN/UPC | Pesquisar produto |
| Texto | qualquer outro | Copiar / compartilhar |

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
src/parseContent.ts          Interpretação do conteúdo (URL, Wi-Fi, Pix, vCard...)
src/history.ts               Histórico salvo com AsyncStorage
src/components/ResultSheet.tsx  Painel de resultado com ações
```
