// ─────────────────────────────────────────────────────────────────
// RAÍZES · modelo do LEAD (imóvel bruto coletado) e enriquecimento.
//
// Duas camadas (espelha o padrão do projeto: dados.json → Terreno):
//   • LEAD bruto  → superset do anúncio (esta struct). Vai para a store `leads`.
//   • Terreno     → schema normalizado do app; mapeado no PROMOVER (normalize.mjs).
// ─────────────────────────────────────────────────────────────────
import { FILTROS, TIPOS_ALVO } from './config.mjs';
import { distanciaSpKm } from './lib/distance.mjs';
import { geocodeCidade } from './lib/geo.mjs';
import { contentHash } from './lib/util.mjs';

export const STATUS = {
  NOVO: 'novo',           // recém-coletado
  REVISAR: 'revisar',     // passou nos filtros, aguardando análise humana
  PROMOVIDO: 'promovido', // virou Terreno no comparador
  DESCARTADO: 'descartado',
  DUPLICADO: 'duplicado', // é a mesma propriedade de outra fonte (ver dedupCluster)
};

/**
 * Constrói um LEAD canônico a partir do payload parcial de um adapter.
 * Campos ausentes viram null/[] — nunca undefined (Table Storage / JSON).
 */
export function makeLead(source, p = {}) {
  const sourceId = String(p.sourceId ?? '').trim();
  const areaM2 = num(p.areaM2);
  const precoBrl = num(p.precoBrl);
  const nowIso = new Date().toISOString();

  const lead = {
    // ── identidade / origem ──────────────────────────────────────
    source,
    sourceId,
    id: `${source}:${sourceId}`,          // RowKey na store
    fonteUrl: p.fonteUrl || null,
    coletadoEm: nowIso,
    atualizadoEm: nowIso,
    contentHash: null,

    // ── classificação / localização ─────────────────────────────
    titulo: clean(p.titulo),
    tipo: p.tipo || null,                 // classificado (TIPO_IMOVEL)
    tipoOriginal: clean(p.tipoOriginal),  // texto cru do portal
    descricao: clean(p.descricao) || '',
    cidade: clean(p.cidade),
    uf: (p.uf || 'SP').toUpperCase().slice(0, 2),
    bairro: clean(p.bairro),
    endereco: clean(p.endereco),
    cep: clean(p.cep),
    coordenadas: coord(p.coordenadas),

    // ── números ─────────────────────────────────────────────────
    areaM2,
    areaConstruidaM2: num(p.areaConstruidaM2),
    precoBrl,
    precoM2: precoBrl && areaM2 ? Math.round((precoBrl / areaM2) * 100) / 100 : null,
    iptuBrl: num(p.iptuBrl),
    condominioBrl: num(p.condominioBrl),
    quartos: num(p.quartos),
    suites: num(p.suites),
    banheiros: num(p.banheiros),
    salas: num(p.salas),
    vagas: num(p.vagas),

    // ── qualitativo cru do anúncio ──────────────────────────────
    estrutura: arr(p.estrutura),
    infraTxt: arr(p.infraTxt),
    corretora: p.corretora || null,

    // ── mídia (URLs; espelho no Blob só ao promover) ────────────
    fotos: arr(p.fotos).map((f) => (typeof f === 'string' ? { url: f, mirrored: null } : { mirrored: null, ...f })),
    fotosTotal: num(p.fotosTotal) ?? arr(p.fotos).length,
    videos: arr(p.videos).map((v) => (typeof v === 'string' ? { url: v } : v)),
    fotoAmostra: [],                      // paths das fotos-amostra espelhadas

    // ── derivados do pipeline ───────────────────────────────────
    distanciaSpKm: null,
    distanciaFonte: null,                 // 'coordenadas' | 'cidade' | null
    filtros: {},
    passaFiltros: false,
    dedupCluster: null,
    score: null,
    status: STATUS.NOVO,

    // payload cru do adapter (debug / reprocessamento)
    raw: p.raw ?? null,
  };

  return enrichLead(lead);
}

/** resolve distância a SP: coordenadas próprias > centroide da cidade. */
export function resolveDistancia(lead) {
  const g = geocodeCidade(lead.cidade, lead.uf);
  const cidadeKm = g ? distanciaSpKm(g.lat, g.lng) : null;
  if (lead.coordenadas && lead.coordenadas.lat != null) {
    const km = distanciaSpKm(lead.coordenadas.lat, lead.coordenadas.lng);
    // coordenadas "lixo" do publicador (perto demais de SP p/ um imóvel na cidade
    // declarada) → cai para o centroide da cidade. Ex.: sítio em Nazaré marcado a 0,9 km.
    if (cidadeKm != null && km < 10 && cidadeKm - km > 15) return { km: cidadeKm, fonte: 'cidade' };
    return { km, fonte: 'coordenadas' };
  }
  if (cidadeKm != null) return { km: cidadeKm, fonte: 'cidade' };
  return { km: null, fonte: null };
}

/** recalcula distância, filtros duros e hash de conteúdo. */
export function enrichLead(lead) {
  const d = resolveDistancia(lead);
  lead.distanciaSpKm = d.km;
  lead.distanciaFonte = d.fonte;

  const f = {
    area: bool(lead.areaM2 != null && lead.areaM2 >= FILTROS.areaMinM2 && lead.areaM2 <= FILTROS.areaMaxM2),
    preco: bool(lead.precoBrl != null && lead.precoBrl <= FILTROS.precoMaxBrl),
    distancia: lead.distanciaSpKm == null ? null : bool(lead.distanciaSpKm <= FILTROS.distanciaMaxSpKm),
    tipo: lead.tipo == null ? null : bool(TIPOS_ALVO.includes(lead.tipo)),
  };
  lead.filtros = f;
  // passa nos filtros DUROS = área ok + preço ok + distância conhecida e ok.
  lead.passaFiltros = f.area === true && f.preco === true && f.distancia === true;
  lead.contentHash = contentHash(lead.precoBrl, lead.areaM2, lead.titulo, lead.fotosTotal);
  return lead;
}

/** true se o lead novo difere do já armazenado (preço/área/fotos mudaram). */
export function mudou(existente, novo) {
  return !existente || existente.contentHash !== novo.contentHash;
}

// ── helpers de coerção ─────────────────────────────────────────────
function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function clean(v) {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s || null;
}
function arr(v) {
  return Array.isArray(v) ? v.filter((x) => x != null) : [];
}
function coord(c) {
  if (!c || c.lat == null || c.lng == null) return null;
  const lat = Number(c.lat), lng = Number(c.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}
const bool = (x) => x === true;
