// ─────────────────────────────────────────────────────────────────
// Valida os LEADS coletados: link do anúncio (fonteUrl) e foto principal.
// Usa o navegador real (Playwright) — passa Cloudflare/DataDome e mede o
// que REALMENTE carrega. A foto é testada com Referer do NOSSO app (simula
// o <img> cross-origin) para saber se aparece na Prospecção.
//   node src/validate.mjs [--por-fonte 25] [--all] [--source delmasso]
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

const APP_ORIGIN = 'https://raizesapp-2e8bc7.azurewebsites.net';
const porFonte = flag('all') ? Infinity : Number(opt('por-fonte', 25));
const soFonte = opt('source', null);

const all = Object.values(JSON.parse(fs.readFileSync(LEADS, 'utf8')));
const bySrc = {};
for (const l of all) {
  if (soFonte && l.source !== soFonte) continue;
  (bySrc[l.source] = bySrc[l.source] || []).push(l);
}

const { browser, context } = await launchBrowser({ headless: true });

async function check(url, referer) {
  if (!url) return { status: null, ct: '', ok: false, motivo: 'sem url' };
  try {
    const resp = await context.request.get(url, {
      headers: referer ? { Referer: referer } : {},
      timeout: 25000, maxRedirects: 6,
    });
    return { status: resp.status(), ct: resp.headers()['content-type'] || '' };
  } catch (e) { return { status: 0, ct: '', err: String(e).slice(0, 60) }; }
}

// aquece cookies/clearance de cada portal (Cloudflare/DataDome)
const page = await context.newPage();
for (const base of ['https://www.delmassoimoveis.com.br/', 'https://www.zapimoveis.com.br/', 'https://www.imovelweb.com.br/']) {
  try { await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(1500); } catch {}
}
await page.close().catch(() => {});

const relatorio = {};
for (const src of Object.keys(bySrc)) {
  const leads = bySrc[src].sort((a, b) => Number(b.passaFiltros) - Number(a.passaFiltros)).slice(0, porFonte);
  let linksOk = 0, fotosOk = 0, semFoto = 0;
  const linksRuins = [], fotosRuins = [];
  for (const l of leads) {
    const link = await check(l.fonteUrl);
    const linkOk = link.status != null && link.status >= 200 && link.status < 400;
    if (linkOk) linksOk++; else linksRuins.push({ id: l.id, url: l.fonteUrl, status: link.status, err: link.err });

    const fotoUrl = l.fotos?.[0]?.url;
    if (!fotoUrl) { semFoto++; continue; }
    const foto = await check(fotoUrl, APP_ORIGIN);
    const fotoOk = foto.status === 200 && /image\//i.test(foto.ct);
    if (fotoOk) fotosOk++; else fotosRuins.push({ id: l.id, url: fotoUrl.slice(0, 90), status: foto.status, ct: foto.ct });
  }
  relatorio[src] = {
    checados: leads.length,
    links: `${linksOk}/${leads.length} ok`,
    fotos: `${fotosOk}/${leads.length} ok${semFoto ? ` (${semFoto} sem foto)` : ''}`,
    linksRuins: linksRuins.slice(0, 4),
    fotosRuins: fotosRuins.slice(0, 4),
  };
}

await browser.close();
console.log(JSON.stringify(relatorio, null, 2));
