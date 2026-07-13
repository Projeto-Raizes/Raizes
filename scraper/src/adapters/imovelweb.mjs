// ─────────────────────────────────────────────────────────────────
// Adapter ImovelWeb (plataforma Navent). DataDome + geo-controle, mas
// acessível de IP brasileiro. Sem estado pré-carregado: extraímos os cards
// do DOM da busca ([data-qa="posting PROPERTY"]). Como buscamos POR MUNICÍPIO,
// a cidade é conhecida (geocodificada p/ distância); coordenadas exatas só na
// promoção (página de detalhe).
//   URL busca:  /{tipo}-venda-{cidade}-sp.html   (paginação: ...-pagina-N.html)
// ─────────────────────────────────────────────────────────────────
import { MUNICIPIOS } from '../data/municipios.mjs';
import { slug, parsePrecoBrl, parseAreaM2 } from '../lib/util.mjs';

export const key = 'imovelweb';
export const nome = 'ImovelWeb';

const HOST = 'https://www.imovelweb.com.br';
const TIPOS = ['chacaras-sitios-e-fazendas', 'terrenos']; // rural primeiro
const MAX_MUNICIPIOS = 16;
const RURAL = new Set(['Sorocaba/Ibiúna', 'Itapetininga', 'Vale do Ribeira', 'Mantiqueira', 'Circuito das Águas']);

function urlBusca(tipo, citySlug, pagina) {
  const p = pagina > 1 ? `-pagina-${pagina}` : '';
  return `${HOST}/${tipo}-venda-${citySlug}-sp${p}.html`;
}

async function extrairCards(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-qa="posting PROPERTY"], div[data-to-posting]')];
    return cards.map((c) => {
      const id = c.getAttribute('data-id') || c.getAttribute('data-to-posting');
      const t = (sel) => c.querySelector(sel)?.textContent?.trim() || null;
      const price = t('[data-qa="POSTING_CARD_PRICE"]');
      const feats = [...c.querySelectorAll('[data-qa="POSTING_CARD_FEATURES"] span')].map((e) => e.textContent.trim()).join(' ');
      const desc = t('[data-qa="POSTING_CARD_DESCRIPTION"]');
      const loc = t('[data-qa="POSTING_CARD_LOCATION"]');
      const a = c.querySelector('a[href]');
      const img = [...c.querySelectorAll('img')].map((i) => i.src).find((s) => /imovelwebcdn|naventcdn/.test(s)) || null;
      return { id, price, feats, desc, loc, href: a?.getAttribute('href') || null, img, text: c.innerText };
    });
  });
}

function card2partial(c, tipo) {
  if (!c.id) return null;
  const text = c.text || '';
  const price = parsePrecoBrl(c.price) ?? parsePrecoBrl((text.match(/R\$\s*[\d.]+/) || [])[0]);
  const areaTxt = c.feats || (text.match(/[\d.]+\s*m²\s*tot/i) || text.match(/[\d.]+\s*m²/i) || [])[0] || '';
  const area = parseAreaM2(areaTxt);
  const hrefRaw = c.href ? (c.href.startsWith('http') ? c.href : HOST + c.href) : null;
  const href = hrefRaw ? hrefRaw.split('?')[0] : null; // tira params de tracking (?n_src=...)
  // cidade real do card (última parte de "Bairro, Cidade"); pode ser vizinha da buscada
  const cidade = c.loc ? c.loc.split(',').pop().trim() : null;
  return {
    sourceId: String(c.id),
    fonteUrl: href,
    titulo: (c.desc || '').split('\n')[0]?.slice(0, 120) || null,
    tipoOriginal: tipo,
    descricao: c.desc || '',
    cidade,
    areaM2: area,
    precoBrl: price,
    fotos: c.img ? [c.img] : [],
    fotosTotal: c.img ? 1 : 0,
    raw: { tipo },
  };
}

export async function coletar(ctx) {
  const { context, log, limits, polite } = ctx;
  const seeds = MUNICIPIOS.filter((m) => m.uf === 'SP')
    .sort((a, b) => (RURAL.has(b.regiao) - RURAL.has(a.regiao)) || (a.distanciaSpKm - b.distanciaSpKm))
    .slice(0, Math.min(MAX_MUNICIPIOS, limits.limit ? 4 : MAX_MUNICIPIOS));
  const page = await context.newPage();
  const partials = [];
  const paginas = Math.max(1, Math.min(limits.maxPaginas ?? 2, 5));
  try {
    for (const m of seeds) {
      const citySlug = slug(m.nome);
      for (const tipo of TIPOS) {
        let got = 0;
        for (let pg = 1; pg <= paginas; pg++) {
          const resp = await page.goto(urlBusca(tipo, citySlug, pg), { waitUntil: 'domcontentloaded' }).catch(() => null);
          if (!resp || resp.status() >= 400) break;
          await page.waitForTimeout(1800);
          const cards = await extrairCards(page);
          if (!cards.length) break;
          for (const c of cards) {
            const p = card2partial(c, tipo);
            if (p) { p.cidade = p.cidade || m.nome; p.uf = 'SP'; partials.push(p); got++; }
          }
          await polite();
        }
        if (got) log(`  ${m.nome} · ${tipo}: ${got} anúncios`);
        if (limits.limit && partials.length >= limits.limit) break;
      }
      if (limits.limit && partials.length >= limits.limit) break;
    }
  } finally {
    await page.close().catch(() => {});
  }
  return partials;
}
