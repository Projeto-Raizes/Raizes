// ─────────────────────────────────────────────────────────────────
// Ferramenta de RECON: abre uma URL, captura JSON de rede que casa com um
// padrão, e resume a estrutura da página (cards, JSON-LD, og:meta, fotos).
// Salva o payload completo em data/probe/<host>.json para inspeção.
//
//   node src/probe.mjs <url> [regexJsonUrl]
//   node src/probe.mjs "https://www.delmassoimoveis.com.br/busca" "ajax|Properties"
// ─────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, jsonCollector } from './lib/browser.mjs';

const url = process.argv[2];
const pat = process.argv[3]
  ? new RegExp(process.argv[3], 'i')
  : /(_api|ajax|glue|\/api\/|posting|listing|search|result|imovel|property|graphql)/i;

if (!url) { console.error('uso: node src/probe.mjs <url> [regexJsonUrl]'); process.exit(1); }

const { browser, context } = await launchBrowser({ headless: true });
const page = await context.newPage();
const col = jsonCollector(page, (u) => pat.test(u));

let status = null;
try {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
  status = resp ? resp.status() : null;
} catch (e) {
  console.log('goto erro:', String(e).slice(0, 200));
}
await page.waitForTimeout(3500);
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 4200).catch(() => {}); await page.waitForTimeout(1300); }
col.stop();

const info = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const detailLinks = [...new Set(q('a[href]').map((a) => a.getAttribute('href'))
    .filter((h) => h && /(imovel|imoveis|propriedade|\/id-|-id-|\/\d{4,})/i.test(h)))].slice(0, 15);
  const jsonld = q('script[type="application/ld+json"]').map((s) => s.textContent.trim());
  const metas = {};
  document.querySelectorAll('meta[property],meta[name]').forEach((m) => {
    const k = m.getAttribute('property') || m.getAttribute('name');
    if (/og:|geo|price|type|latitude|longitude/i.test(k)) metas[k] = m.content;
  });
  const imgs = [...new Set(q('img').map((i) => i.currentSrc || i.src).filter((s) => /^http/.test(s)))].slice(0, 8);
  return {
    title: document.title,
    detailLinks,
    jsonldCount: jsonld.length,
    jsonldSample: jsonld.slice(0, 2).map((s) => s.slice(0, 500)),
    metas,
    imgSample: imgs,
    bodySample: document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 700),
  };
});

const caps = col.hits.map((h) => ({
  url: h.url.slice(0, 140),
  status: h.status,
  shape: h.body && typeof h.body === 'object'
    ? (Array.isArray(h.body) ? `array[${h.body.length}]` : `keys: ${Object.keys(h.body).slice(0, 25).join(',')}`)
    : typeof h.body,
}));

const outDir = 'data/probe';
fs.mkdirSync(outDir, { recursive: true });
const host = new URL(url).host.replace(/[^a-z0-9]/gi, '_');
fs.writeFileSync(path.join(outDir, `${host}.json`), JSON.stringify({ url, status, info, captured: col.hits }, null, 2));

console.log(JSON.stringify({ url, status, info, capturedCount: col.hits.length, caps }, null, 2));
await browser.close();
