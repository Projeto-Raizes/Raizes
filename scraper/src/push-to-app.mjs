// ─────────────────────────────────────────────────────────────────
// Ponte scraper → app: empurra os leads coletados (data/leads.json) para
// o app via POST /api/leads/import. Em produção (Azure) o app lê a tabela
// `leads` direto — esta ponte é para o fluxo local.
//   node src/push-to-app.mjs                         # todos os leads
//   node src/push-to-app.mjs --only-pass             # só os que passam nos filtros
//   node src/push-to-app.mjs --por-fonte 2           # 2 por fonte (candidatos primeiro)
//   node src/push-to-app.mjs --url http://localhost:4600
// ─────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEADS = path.join(__dirname, '..', 'data', 'leads.json');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const url = opt('url', 'http://localhost:4600');
let leads = Object.values(JSON.parse(fs.readFileSync(LEADS, 'utf8')));

if (flag('only-pass')) leads = leads.filter((l) => l.passaFiltros);

const porFonte = opt('por-fonte', null);
if (porFonte) {
  const by = {};
  for (const l of leads) (by[l.source] = by[l.source] || []).push(l);
  leads = Object.values(by).flatMap((arr) => arr
    .sort((a, b) => (Number(b.passaFiltros) - Number(a.passaFiltros))
      || ((a.distanciaSpKm ?? 1e9) - (b.distanciaSpKm ?? 1e9)))
    .slice(0, Number(porFonte)));
}

const limit = opt('limit', null);
if (limit) leads = leads.slice(0, Number(limit));

const r = await fetch(`${url}/api/leads/import`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ leads }),
});
console.log(`push → ${url}/api/leads/import : HTTP ${r.status} · ${await r.text()} (${leads.length} enviados)`);
