// Auto-teste do núcleo (sem rede/Playwright/Azure): parsing, modelo,
// filtros, normalização, dedup e store local. Rode: node src/selftest.mjs
import { makeLead, STATUS } from './model.mjs';
import { leadToTerreno, classifyTipo } from './lib/normalize.mjs';
import { clusterLeads } from './lib/dedup.mjs';
import { createStore } from './lib/store.mjs';
import { parseAreaM2, parsePrecoBrl } from './lib/util.mjs';

let fail = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}${c ? '' : ' — ' + extra}`); if (!c) fail++; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m, `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

// ── parsing pt-BR ──────────────────────────────────────────────────
eq(parsePrecoBrl('R$ 1.350.000,00'), 1350000, 'preço 1.350.000');
eq(parseAreaM2('24.200 m²'), 24200, 'área 24.200 m²');
eq(parseAreaM2('2,4 ha'), 24000, 'área 2,4 ha → 24000');
eq(parseAreaM2('1 alqueire'), 24200, 'área 1 alqueire → 24200');
eq(parseAreaM2('1.162,2m²'), 1162, 'área decimal');

// ── lead 8285-like (Delmasso, cidade Ibiúna geocodável) ────────────
const lead = makeLead('delmasso', {
  sourceId: '347', fonteUrl: 'https://www.delmassoimoveis.com.br/imovel/347',
  titulo: 'Sítio com nascente e represa', tipoOriginal: 'Sítio', cidade: 'Ibiúna', uf: 'SP',
  areaM2: 24200, precoBrl: 790000,
  descricao: 'acesso asfaltado, escritura definitiva, energia elétrica, relevo ondulado, nascente e represa',
  estrutura: ['Piscina', 'Área gourmet', 'Casa de caseiro', 'Pomar e horta'],
  infraTxt: ['Acesso ao asfalto', 'Internet fibra'], fotos: ['https://cdn/x1.jpg', 'https://cdn/x2.jpg'], fotosTotal: 2,
});
lead.tipo = classifyTipo(lead.tipoOriginal, lead.titulo);
ok(lead.distanciaSpKm > 40 && lead.distanciaSpKm < 120, 'distância Ibiúna ~62km', String(lead.distanciaSpKm));
ok(lead.filtros.area === true, 'filtro área ok');
ok(lead.filtros.preco === true, 'filtro preço ok');
ok(lead.filtros.distancia === true, 'filtro distância ok');
ok(lead.passaFiltros === true, 'passaFiltros=true');
eq(lead.tipo, 'sitio', 'tipo → sitio');
eq(lead.precoM2, Math.round((790000 / 24200) * 100) / 100, 'precoM2 calc');

// ── mapeamento → Terreno (schema do app) ───────────────────────────
const terreno = leadToTerreno(lead);
eq(terreno.infra.acesso, 'asfalto', 'infra.acesso → asfalto');
eq(terreno.infra.agua, 'nascente', 'infra.agua → nascente');
eq(terreno.infra.internet, 'fibra', 'infra.internet → fibra');
eq(terreno.documentacao, 'escritura', 'documentacao → escritura');
eq(terreno.topografia, 'ondulado', 'topografia → ondulado');
ok(terreno.temAguaNatural === true, 'temAguaNatural=true');
ok(terreno.modulosExistentes.includes('piscina'), 'módulo piscina detectado');
ok(terreno.distancias.saoPauloKm > 0, 'terreno.distancias.saoPauloKm preenchido');
ok(terreno.uf === 'SP' && terreno.precoBrl === 790000, 'campos básicos do terreno');

// ── filtros duros rejeitam fora de faixa ───────────────────────────
const grande = makeLead('x', { sourceId: '1', cidade: 'Ibiúna', areaM2: 120000, precoBrl: 3800000 });
ok(grande.passaFiltros === false, 'rejeita área/preço grandes');
const semDist = makeLead('x', { sourceId: '2', cidade: 'CidadeInexistenteXYZ', areaM2: 10000, precoBrl: 500000 });
ok(semDist.filtros.distancia === null && semDist.passaFiltros === false, 'distância desconhecida não passa');

// ── dedup cross-source ─────────────────────────────────────────────
const a = makeLead('delmasso', { sourceId: '347', cidade: 'Ibiúna', areaM2: 24200, precoBrl: 790000, fotosTotal: 20 });
const b = makeLead('zapvivareal', { sourceId: '999', cidade: 'Ibiúna', areaM2: 24000, precoBrl: 800000, fotosTotal: 5 });
const c = makeLead('imovelweb', { sourceId: '777', cidade: 'Sorocaba', areaM2: 10000, precoBrl: 500000, fotosTotal: 3 });
const { clusters, duplicados } = clusterLeads([a, b, c]);
ok(clusters.length === 1 && duplicados === 1, 'dedup: 1 cluster, 1 duplicado', `clusters=${clusters.length} dup=${duplicados}`);
ok(a.canonico === true && b.status === STATUS.DUPLICADO, 'canônica = mais fotos (Delmasso)');
ok(c.dedupCluster === null, 'Sorocaba fica fora do cluster');

// ── store local ────────────────────────────────────────────────────
const store = await createStore();
await store.upsert(a);
const got = await store.get(a.id);
ok(got && got.id === a.id, 'store upsert/get');
await store.remove(a.id);
ok((await store.get(a.id)) === null, 'store remove (limpa teste)');

console.log(`\n${fail ? `❌ ${fail} FALHA(S)` : '✅ TODOS OS TESTES PASSARAM'}`);
process.exit(fail ? 1 : 0);
