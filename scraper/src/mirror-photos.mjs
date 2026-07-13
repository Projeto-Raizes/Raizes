// ─────────────────────────────────────────────────────────────────
// Espelha a foto principal de cada lead para o Blob do app (/api/upload).
// Baixa a imagem AQUI (máquina BR, com o Referer do portal — contorna o
// hotlink-protection do ZAP) e re-serve pela nossa origem (/media/uploads).
// Assim TODA plataforma exibe foto no app, sem depender do CDN externo.
//   node src/mirror-photos.mjs --url https://raizesapp-2e8bc7.azurewebsites.net --por-fonte 25 --only-pass
//   node src/mirror-photos.mjs --url http://localhost:4600 --all
// ─────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './lib/browser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEADS = path.join(__dirname, '..', 'data', 'leads.json');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const appUrl = opt('url', 'http://localhost:4600');
const porFonte = flag('all') ? Infinity : Number(opt('por-fonte', 25));
const onlyPass = flag('only-pass');
const soFonte = opt('source', null);

const REFERER = {
  delmasso: 'https://www.delmassoimoveis.com.br/',
  zapvivareal: 'https://www.zapimoveis.com.br/',
  imovelweb: 'https://www.imovelweb.com.br/',
};

const db = JSON.parse(fs.readFileSync(LEADS, 'utf8'));
const all = Object.values(db);
const bySrc = {};
for (const l of all) (bySrc[l.source] = bySrc[l.source] || []).push(l);

// seleção: por-fonte, candidatos primeiro (e só candidatos se --only-pass)
const alvo = [];
for (const src of Object.keys(bySrc)) {
  if (soFonte && src !== soFonte) continue;
  // mesma ordenação do push-to-app (candidatos primeiro, mais perto de SP) → seleção consistente
  let leads = bySrc[src].sort((a, b) =>
    (Number(b.passaFiltros) - Number(a.passaFiltros)) || ((a.distanciaSpKm ?? 1e9) - (b.distanciaSpKm ?? 1e9)));
  if (onlyPass) leads = leads.filter((l) => l.passaFiltros);
  alvo.push(...leads.slice(0, porFonte));
}

const { browser, context } = await launchBrowser({ headless: true });
const extDe = (ct) => (/png/.test(ct) ? 'png' : /webp/.test(ct) ? 'webp' : /gif/.test(ct) ? 'gif' : 'jpg');
let mirrados = 0, jaOk = 0, falhou = 0;

for (const lead of alvo) {
  const f = lead.fotos?.[0];
  if (!f?.url) { continue; }
  if (String(f.url).startsWith('/media/')) { jaOk++; continue; } // já espelhada
  try {
    const dl = await context.request.get(f.url, { headers: { Referer: REFERER[lead.source] || '' }, timeout: 25000, maxRedirects: 6 });
    const ct = dl.headers()['content-type'] || '';
    if (!dl.ok() || !/image\//i.test(ct)) { falhou++; continue; }
    const buf = await dl.body();
    const filename = `${lead.source}-${lead.sourceId}.${extDe(ct)}`;
    const up = await context.request.post(`${appUrl}/api/upload`, {
      data: { filename, dataBase64: buf.toString('base64') }, timeout: 40000,
    });
    if (!up.ok()) { falhou++; continue; }
    const { url } = await up.json();
    f.fotoOriginalUrl = f.url;
    f.url = url;
    f.mirrored = url;
    mirrados++;
    if (mirrados % 10 === 0) { fs.writeFileSync(LEADS, JSON.stringify(db, null, 2)); process.stdout.write(`  ${mirrados} espelhadas…\n`); }
  } catch { falhou++; }
}

fs.writeFileSync(LEADS, JSON.stringify(db, null, 2));
await browser.close();
console.log(`espelhadas: ${mirrados} · já ok: ${jaOk} · falhas: ${falhou} · alvo: ${alvo.length} (para ${appUrl})`);
