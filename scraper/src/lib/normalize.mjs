// ─────────────────────────────────────────────────────────────────
// Normalização: texto livre do anúncio → enums do schema Terreno do app.
// Usa os dicionários de src/data/normalize-dict.mjs. É aqui que um LEAD
// bruto vira um Terreno pronto para o comparador (passo PROMOVER).
// ─────────────────────────────────────────────────────────────────
import {
  AGUA, ENERGIA, INTERNET, ACESSO, SANEAMENTO, TOPOGRAFIA, DOCUMENTACAO,
  TIPO_IMOVEL, AGUA_NATURAL, BENFEITORIAS, APP_RESERVA,
} from '../data/normalize-dict.mjs';
import { norm } from './util.mjs';

// pré-compila os dicionários (regex 1×) preservando .fallback
function compile(dict) {
  const arr = dict.map((e) => ({ re: new RegExp(e.pattern), ...e }));
  arr.fallback = dict.fallback;
  return arr;
}
const C = {
  AGUA: compile(AGUA), ENERGIA: compile(ENERGIA), INTERNET: compile(INTERNET),
  ACESSO: compile(ACESSO), SANEAMENTO: compile(SANEAMENTO), TOPOGRAFIA: compile(TOPOGRAFIA),
  DOCUMENTACAO: compile(DOCUMENTACAO), TIPO_IMOVEL: compile(TIPO_IMOVEL),
};
const AGUA_NATURAL_RE = AGUA_NATURAL.map((p) => new RegExp(p));
const APP_RE = APP_RESERVA.map((p) => new RegExp(p));
const BENF_RE = BENFEITORIAS.map((b) => ({ re: new RegExp(b.pattern), label: b.label, moduloId: b.moduloId }));

/** classifica um texto contra um dicionário compilado (1º match vence). */
export function classify(text, dict) {
  const t = norm(text);
  const hit = dict.find((e) => e.re.test(t));
  return hit ? hit.value : dict.fallback;
}

/** classifica o tipo do imóvel (usa o texto do tipo do portal + título). */
export function classifyTipo(...textos) {
  return classify(textos.filter(Boolean).join(' '), C.TIPO_IMOVEL);
}

export const temAguaNatural = (text) => {
  const t = norm(text);
  return AGUA_NATURAL_RE.some((re) => re.test(t));
};

export const mencionaApp = (text) => {
  const t = norm(text);
  return APP_RE.some((re) => re.test(t));
};

/** casa benfeitorias em uma lista de textos → { labels[], moduloIds[] } (únicos). */
export function matchBenfeitorias(textos) {
  const t = norm(textos.filter(Boolean).join(' . '));
  const labels = new Set();
  const moduloIds = new Set();
  for (const b of BENF_RE) {
    if (b.re.test(t)) { labels.add(b.label); moduloIds.add(b.moduloId); }
  }
  return { labels: [...labels], moduloIds: [...moduloIds] };
}

/**
 * LEAD bruto → Terreno (schema exato do app Projeto-Raizes-APP).
 * Campos que o anúncio não fornece ficam em 0/'verificar' e são anotados em
 * `observacoes` para enriquecimento humano na visita.
 */
export function leadToTerreno(lead) {
  const corpus = [lead.titulo, lead.descricao, ...(lead.estrutura || []), ...(lead.infraTxt || [])]
    .filter(Boolean).join(' . ');
  const benf = matchBenfeitorias([...(lead.estrutura || []), lead.titulo, lead.descricao]);
  const areaTxt = lead.areaM2 ? `${lead.areaM2.toLocaleString('pt-BR')} m²` : '';
  const nome = lead.titulo || `${cap(lead.tipo || 'Imóvel')} ${areaTxt} — ${lead.cidade || ''}`.trim();

  return {
    nome,
    cidade: lead.cidade || '—',
    uf: lead.uf || 'SP',
    precoBrl: lead.precoBrl ?? 0,
    areaM2: lead.areaM2 ?? 0,
    areaConstruidaM2: lead.areaConstruidaM2 ?? 0,
    topografia: classify(corpus, C.TOPOGRAFIA),
    appPct: mencionaApp(corpus) ? 20 : 0,
    temAguaNatural: temAguaNatural(corpus),
    distancias: {
      saoPauloKm: lead.distanciaSpKm ?? 0,
      rodoviaKm: 0,
      hospitalKm: 0,
      centroKm: 0,
      mercadoKm: 0,
    },
    infra: {
      agua: classify(corpus, C.AGUA),
      energia: classify(corpus, C.ENERGIA),
      internet: classify(corpus, C.INTERNET),
      acesso: classify(corpus, C.ACESSO),
      saneamento: classify(corpus, C.SANEAMENTO),
    },
    benfeitorias: (lead.estrutura && lead.estrutura.length) ? lead.estrutura : benf.labels,
    modulosExistentes: benf.moduloIds,
    fotos: (lead.fotos || []).map((f) => f.url).filter(Boolean),
    videoUrl: lead.videos?.[0]?.url || undefined,
    anuncioUrl: lead.fonteUrl || undefined,
    documentacao: classify(corpus, C.DOCUMENTACAO),
    observacoes: montarObs(lead),
    exemplo: false,
    favorito: false,
  };
}

function montarObs(lead) {
  const p = [];
  p.push(`Fonte: ${lead.source} (${lead.sourceId}) · coletado ${lead.coletadoEm?.slice(0, 10)}`);
  if (lead.precoM2) p.push(`R$/m²: ${lead.precoM2.toLocaleString('pt-BR')}`);
  if (lead.distanciaSpKm != null) p.push(`Distância SP: ${lead.distanciaSpKm} km (via ${lead.distanciaFonte})`);
  if (lead.corretora?.nome) p.push(`Corretora: ${lead.corretora.nome}${lead.corretora.telefone ? ' · ' + lead.corretora.telefone : ''}`);
  if (lead.infraTxt?.length) p.push(`Infra (anúncio): ${lead.infraTxt.join(', ')}`);
  if (mencionaApp([lead.titulo, lead.descricao].join(' '))) p.push('⚠️ Menção a APP/Reserva/Mata — verificar % preservado.');
  p.push('⚠️ Distâncias rodovia/hospital/centro/mercado, docs e áreas a confirmar em visita/DD.');
  return p.join('\n');
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
