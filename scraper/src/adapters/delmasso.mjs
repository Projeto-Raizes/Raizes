// ─────────────────────────────────────────────────────────────────
// Adapter Delmasso Imóveis — plataforma Vista Software sob front Wix.
// Corretora regional de Ibiúna/Sorocaba (alto sinal para o alvo RAÍZES).
//
// Fonte de dados: web method Wix Velo `Properties.ajax` (Vista), que
// devolve páginas de 50 anúncios COMPLETOS — inclusive Latitude/Longitude,
// AreaTotal, Descricao, Caracteristicas e InfraEstrutura. Não precisa abrir
// página de detalhe para os campos do lead.
//   POST .../vistasoft.jsw/Properties.ajax?gridAppId=...&viewMode=site
//   body: [{"filter":{},"order":{},"page":N}]   → result:[ [..50 imóveis..], {total,paginas,pagina,quantidade} ]
// ─────────────────────────────────────────────────────────────────
import { fetchInPage, jsonCollector } from '../lib/browser.mjs';

export const key = 'delmasso';
export const nome = 'Delmasso Imóveis';

const BASE = 'https://www.delmassoimoveis.com.br';
const GRID_APP_ID = 'a8c49907-a399-4072-9704-c90872e35086';
const AJAX = `${BASE}/_api/wix-code-public-dispatcher-ng/siteview/_webMethods/backend/vistasoft.jsw/Properties.ajax?gridAppId=${GRID_APP_ID}&viewMode=site`;

const CORRETORA = {
  nome: 'Delmasso Imóveis', creci: '25.910-J',
  telefone: '(15) 3241-2846', whatsapp: '+55 15 98178-0158', email: 'contato@delmassoimoveis.com.br',
};

const intOrNull = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

/** objeto Vista {Feature:'Sim'|'Nao'|'3'} → lista de features presentes. */
function vistaFeatures(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const s = String(v).trim();
    if (s === 'Sim') out.push(k);
    else if (/^\d+$/.test(s) && Number(s) > 0 && !/dormitorio|suite|banheiro|vaga|arm/i.test(k)) out.push(`${k} (${s})`);
  }
  return out;
}

function vista2partial(L) {
  const cod = String(L.Codigo || L._id);
  const lat = parseFloat(L.Latitude);
  const lng = parseFloat(L.Longitude);
  const caract = L.Caracteristicas || {};
  const infra = L.InfraEstrutura || {};
  return {
    sourceId: cod,
    fonteUrl: `${BASE}/imovel/${cod}`,
    titulo: L.TituloSite || null,
    tipoOriginal: L.Categoria || null,
    descricao: L.Descricao || '',
    cidade: L.Cidade || null,
    uf: 'SP',
    bairro: L.Bairro || null,
    coordenadas: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    areaM2: Number(L.AreaTotal) || null,
    areaConstruidaM2: Number(L.AreaPrivativa) || null,
    precoBrl: Number(L.ValorVenda) || null,
    iptuBrl: Number(L.ValorIptu) || null,
    condominioBrl: Number(L.ValorCondominio) || null,
    quartos: intOrNull(L.Dormitorios ?? caract.Dormitorios),
    suites: intOrNull(caract.Suites),
    banheiros: intOrNull(L.TotalBanheiros),
    vagas: intOrNull(L.Vagas),
    estrutura: [...vistaFeatures(caract), ...vistaFeatures(infra)],
    infraTxt: vistaFeatures(infra),
    corretora: CORRETORA,
    fotos: L.FotoDestaque ? [L.FotoDestaque] : [],
    fotosTotal: L.FotoDestaque ? 1 : 0,
    raw: { Codigo: cod, Categoria: L.Categoria, Finalidade: L.Finalidade, Status: L.Status },
  };
}

// headers Wix que o web method exige (o `authorization` é capturado da
// própria requisição que a página faz ao carregar a página 1).
const WIX_HEADERS = ['authorization', 'x-xsrf-token', 'commonconfig', 'x-wix-app-instance', 'x-wix-brand', 'x-wix-site-revision'];

export async function coletar(ctx) {
  const { context, log, limits, polite } = ctx;
  const page = await context.newPage();
  const partials = [];
  const teto = Math.min(limits.maxPaginas ?? 22, 22);
  let totalPaginas = 1;

  const processPage = (json, pag) => {
    const listings = json.result?.[0] || [];
    const meta = json.result?.[1] || {};
    totalPaginas = meta.paginas || totalPaginas;
    let venda = 0;
    for (const L of listings) {
      if ((Number(L.ValorVenda) || 0) <= 0) continue; // ignora locação/sem preço de venda
      partials.push(vista2partial(L));
      venda++;
    }
    log(`  página ${pag}/${Math.min(totalPaginas, teto)} — ${listings.length} anúncios (${venda} à venda) · total portal ${meta.total}`);
  };

  // captura os headers de auth da requisição que a página faz sozinha
  let authHeaders = null;
  page.on('request', (req) => {
    if (!authHeaders && /Properties\.ajax/i.test(req.url())) {
      const h = req.headers();
      authHeaders = { 'content-type': 'application/json' };
      for (const k of WIX_HEADERS) if (h[k]) authHeaders[k] = h[k];
    }
  });
  const col = jsonCollector(page, (u) => /Properties\.ajax/i.test(u));

  try {
    await page.goto(`${BASE}/busca`, { waitUntil: 'domcontentloaded' });
    await page.waitForResponse((r) => /Properties\.ajax/i.test(r.url()), { timeout: 25_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    col.stop();

    // página 1 vem da navegação natural (sem precisar reproduzir auth)
    const first = col.hits.find((h) => h.body?.result);
    if (first) processPage(first.body, 1);
    else log('  ⚠️  página 1 não capturada na navegação');

    // páginas 2..N via fetch in-page reutilizando o authorization capturado
    for (let pag = 2; pag <= Math.min(totalPaginas, teto); pag++) {
      if (limits.limit && partials.length >= limits.limit) break;
      await polite();
      const body = JSON.stringify([{ filter: {}, order: {}, page: pag }]);
      const r = await fetchInPage(page, AJAX, { method: 'POST', headers: authHeaders || { 'content-type': 'application/json' }, body });
      if (!r.json?.result) { log(`  página ${pag}: sem result (status ${r.status})`); break; }
      processPage(r.json, pag);
    }
  } finally {
    await page.close().catch(() => {});
  }
  return partials;
}
