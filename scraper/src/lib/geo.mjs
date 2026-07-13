// Geocodificação de fallback: cidade (nome + uf) → coordenadas, a partir
// da tabela de municípios dentro de ~300 km de SP (src/data/municipios.mjs).
// Usado quando o anúncio não traz lat/lng próprios.
import { MUNICIPIOS } from '../data/municipios.mjs';
import { norm } from './util.mjs';

const byNomeUf = new Map();
const byNome = new Map();
for (const m of MUNICIPIOS) {
  byNomeUf.set(`${norm(m.nome)}|${norm(m.uf)}`, m);
  if (!byNome.has(norm(m.nome))) byNome.set(norm(m.nome), m);
}

/** { lat, lng, fonte:'municipio', municipio } | null */
export function geocodeCidade(nome, uf) {
  if (!nome) return null;
  const hit = byNomeUf.get(`${norm(nome)}|${norm(uf)}`) || byNome.get(norm(nome));
  return hit ? { lat: hit.lat, lng: hit.lng, fonte: 'municipio', municipio: hit } : null;
}

export { MUNICIPIOS };
