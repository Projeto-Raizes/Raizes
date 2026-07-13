// ─────────────────────────────────────────────────────────────────
// Deduplicação em duas camadas:
//   • Primária: (source, sourceId) = lead.id — é a RowKey da store, então
//     revisitar o mesmo anúncio simplesmente sobrescreve/atualiza.
//   • Cross-source: o MESMO imóvel anunciado por corretoras diferentes é
//     agrupado num cluster (coordenadas ~150m OU cidade+área±5%+preço±10%).
//     Escolhe uma canônica e marca as demais como DUPLICADO.
// ─────────────────────────────────────────────────────────────────
import { haversineKm } from './distance.mjs';
import { norm } from './util.mjs';
import { STATUS } from '../model.mjs';

const LOCAL_KM = 3;      // mesma localidade se coords ≤ 3 km
const AREA_TOL = 0.10;   // ±10%
const PRECO_TOL = 0.15;  // ±15%

function mesmaPropriedade(a, b) {
  // dedup é CROSS-SOURCE: dois anúncios da MESMA fonte têm sourceId distinto
  // e são imóveis distintos por definição — nunca fundir.
  if (a.source === b.source) return false;

  // sinal FORTE (obrigatório): área E preço parecidos. Coordenadas de portal
  // costumam ser aproximadas (centro do bairro), então NÃO bastam sozinhas —
  // dois imóveis distintos podem ter o mesmo ponto aproximado.
  const areaOk = a.areaM2 && b.areaM2 &&
    Math.abs(a.areaM2 - b.areaM2) / Math.max(a.areaM2, b.areaM2) <= AREA_TOL;
  const precoOk = a.precoBrl && b.precoBrl &&
    Math.abs(a.precoBrl - b.precoBrl) / Math.max(a.precoBrl, b.precoBrl) <= PRECO_TOL;
  if (!areaOk || !precoOk) return false;

  // porta de localidade: mesma cidade OU coordenadas próximas.
  const mesmaCidade = a.cidade && b.cidade && norm(a.cidade) === norm(b.cidade);
  const d = a.coordenadas && b.coordenadas ? haversineKm(a.coordenadas, b.coordenadas) : null;
  const coordsProximas = d != null && d <= LOCAL_KM;
  return Boolean(mesmaCidade || coordsProximas);
}

/**
 * Agrupa leads em clusters e marca dedupCluster/canonico/status.
 * Retorna { clusters, duplicados } (mutação in-place nos leads).
 */
export function clusterLeads(leads) {
  const clusters = [];
  for (const l of leads) {
    l.dedupCluster = null;
    l.canonico = true;
    // re-clustering idempotente: desmarca duplicados antigos (serão remarcados
    // se ainda forem duplicados). Não mexe em decisões humanas.
    if (l.status === STATUS.DUPLICADO) l.status = l.passaFiltros ? STATUS.REVISAR : STATUS.NOVO;
    let alvo = null;
    for (const c of clusters) {
      if (c.membros.some((m) => mesmaPropriedade(m, l))) { alvo = c; break; }
    }
    if (alvo) alvo.membros.push(l);
    else clusters.push({ id: `c${clusters.length + 1}`, membros: [l] });
  }

  let duplicados = 0;
  for (const c of clusters) {
    if (c.membros.length < 2) continue;
    // canônica = mais fotos > tem coordenadas > menor preço
    const canon = [...c.membros].sort((a, b) =>
      (b.fotosTotal - a.fotosTotal) ||
      ((b.coordenadas ? 1 : 0) - (a.coordenadas ? 1 : 0)) ||
      ((a.precoBrl ?? Infinity) - (b.precoBrl ?? Infinity)))[0];
    for (const m of c.membros) {
      m.dedupCluster = c.id;
      m.canonico = m === canon;
      if (!m.canonico && m.status === STATUS.NOVO) { m.status = STATUS.DUPLICADO; duplicados++; }
    }
  }
  return { clusters: clusters.filter((c) => c.membros.length > 1), duplicados };
}
