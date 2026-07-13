// ─────────────────────────────────────────────────────────────────
// Adapter ZAP Imóveis (+ VivaReal, mesma "Glue API").
//
// Estratégia: a busca é Next.js (App Router) protegida por Cloudflare. Em vez
// de reconstruir params, NAVEGO na busca de cada município — a própria página
// (a) passa o desafio Cloudflare (cookies no contexto) e (b) monta a chamada
// glue-api /v2/listings com o addressLocationId correto. Capturo essa URL como
// template e pagino via fetch in-page (mesmo origin → passa o Cloudflare),
// só trocando size/from/page/includeFields. O filtro de ÁREA (5k–50k m²)
// seleciona naturalmente os imóveis rurais entre "todos os tipos".
// ─────────────────────────────────────────────────────────────────
import { fetchInPage } from '../lib/browser.mjs';
import { MUNICIPIOS } from '../data/municipios.mjs';
import { slug } from '../lib/util.mjs';

export const key = 'zapvivareal';
export const nome = 'ZAP + VivaReal';

const HOST = 'https://www.zapimoveis.com.br';
const MAX_MUNICIPIOS = 12;   // municípios mais próximos de SP por run (MVP)
const PAGE_SIZE = 24;        // teto da glue-api ("Size is above acceptable limit" acima disso)
const INCLUDE_FIELDS = 'search(result(listings(listing(id,title,unitTypes,usageTypes,listingType,pricingInfos,usableAreas,totalAreas,address,bedrooms,bathrooms,parkingSpaces,description,amenities),link,medias)),totalCount)';

const first = (a) => (Array.isArray(a) ? a[0] : a) ?? null;
const numArr = (a) => { const v = first(a); const n = Number(v); return Number.isFinite(n) ? n : null; };

function resolveMedia(m) {
  let u = m?.url || m?.href || (typeof m === 'string' ? m : null);
  if (!u || !/^http/.test(u)) return null;
  return u.replace('{action}', 'fit-in').replace('{width}', '800').replace('{height}', '600').replace('{description}', 'imovel');
}

function zap2partial(L) {
  const li = L.listing || L;
  if (!li?.id) return null;
  const venda = (li.pricingInfos || []).find((p) => p.businessType === 'SALE') || li.pricingInfos?.[0] || {};
  const price = Number(venda.price) || null;
  const area = numArr(li.totalAreas) || numArr(li.usableAreas); // terra: prefere área total
  const pt = li.address?.point;
  const href = L.link?.href || (typeof L.link === 'string' ? L.link : null);
  const medias = (L.medias || li.medias || []).map(resolveMedia).filter(Boolean);
  return {
    sourceId: String(li.id),
    fonteUrl: href ? (href.startsWith('http') ? href : HOST + href) : null,
    titulo: li.title || null,
    tipoOriginal: (li.unitTypes || []).join('/') || null,
    descricao: li.description || '',
    cidade: li.address?.city || null,
    uf: li.address?.stateAcronym || 'SP',
    bairro: li.address?.district || li.address?.zone || null,
    cep: li.address?.zipCode || null,
    coordenadas: pt && pt.lat != null ? { lat: Number(pt.lat), lng: Number(pt.lon) } : null,
    areaM2: area,
    precoBrl: price,
    iptuBrl: Number(venda.yearlyIptu || venda.iptu) || null,
    condominioBrl: Number(venda.monthlyCondoFee) || null,
    quartos: numArr(li.bedrooms),
    banheiros: numArr(li.bathrooms),
    vagas: numArr(li.parkingSpaces),
    estrutura: li.amenities || [],
    fotos: medias,
    fotosTotal: medias.length,
    raw: { unitTypes: li.unitTypes, usageTypes: li.usageTypes, listingType: li.listingType },
  };
}

// regiões predominantemente rurais → priorizadas (o alvo RAÍZES é rural)
const RURAL = new Set(['Sorocaba/Ibiúna', 'Itapetininga', 'Vale do Ribeira', 'Mantiqueira', 'Circuito das Águas']);

export async function coletar(ctx) {
  const { context, log, limits, polite } = ctx;
  const seeds = MUNICIPIOS.filter((m) => m.uf === 'SP')
    .sort((a, b) => (RURAL.has(b.regiao) - RURAL.has(a.regiao)) || (a.distanciaSpKm - b.distanciaSpKm))
    .slice(0, Math.min(MAX_MUNICIPIOS, limits.limit ? 6 : MAX_MUNICIPIOS));
  const page = await context.newPage();
  const partials = [];
  try {
    // clearance inicial do Cloudflare
    await page.goto(`${HOST}/venda/imoveis/sp+ibiuna/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    for (const m of seeds) {
      const cidadeSlug = `sp+${slug(m.nome)}`;
      let template = null;
      let xDomain = '.zapimoveis.com.br';
      const onReq = (req) => {
        if (!template && /glue-api.*v2\/listings/i.test(req.url())) {
          template = req.url();
          const h = req.headers();
          if (h['x-domain']) xDomain = h['x-domain'];
        }
      };
      page.on('request', onReq);
      const resp = await page.goto(`${HOST}/venda/imoveis/${cidadeSlug}/`, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForTimeout(2500);
      page.off('request', onReq);
      if (!template) { log(`  ${m.nome}: sem template glue (status ${resp ? resp.status() : '?'})`); continue; }

      const paginas = Math.max(1, Math.min(limits.maxPaginas ?? 2, 5));
      let got = 0;
      for (let pg = 0; pg < paginas; pg++) {
        const u = new URL(template);
        u.searchParams.set('size', String(PAGE_SIZE));
        u.searchParams.set('from', String(pg * PAGE_SIZE));
        u.searchParams.set('page', String(pg + 1));
        u.searchParams.set('includeFields', INCLUDE_FIELDS);
        const r = await fetchInPage(page, u.toString(), { headers: { 'x-domain': xDomain, accept: 'application/json' } });
        const listings = r.json?.search?.result?.listings;
        if (!listings?.length) { if (pg === 0) log(`  ${m.nome}: 0 listings (status ${r.status})`); break; }
        for (const L of listings) { const p = zap2partial(L); if (p) partials.push(p); }
        got += listings.length;
        if (listings.length < PAGE_SIZE) break;
        await polite();
      }
      log(`  ${m.nome} (${m.distanciaSpKm}km): ${got} anúncios coletados`);
      if (limits.limit && partials.length >= limits.limit) break;
      await polite();
    }
  } finally {
    await page.close().catch(() => {});
  }
  return partials;
}
