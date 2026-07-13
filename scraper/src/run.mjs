// ─────────────────────────────────────────────────────────────────
// Orquestrador da coleta RAÍZES.
//   node src/run.mjs                       → todas as fontes habilitadas
//   node src/run.mjs --source delmasso     → só uma fonte
//   node src/run.mjs --max-paginas 3 --limit 40   → coleta reduzida (teste)
//   node src/run.mjs --no-mirror           → não baixa fotos-amostra
//   node src/run.mjs --headed              → browser visível
//
// Fluxo: adapter → makeLead (distância/filtros) → freshness (não re-coleta o
// mesmo anúncio) → mirror de amostra p/ leads que passam → dedup cross-source
// → store (Azure `leads` ou local). Um lead só vira Terreno no PROMOVER.
// ─────────────────────────────────────────────────────────────────
import { FONTES, COLETA } from './config.mjs';
import { makeLead, mudou, STATUS } from './model.mjs';
import { classifyTipo, leadToTerreno } from './lib/normalize.mjs';
import { createStore } from './lib/store.mjs';
import { launchBrowser, polite, downloadBuffer } from './lib/browser.mjs';
import { clusterLeads } from './lib/dedup.mjs';

// ── args ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const sources = (opt('source', '') || Object.keys(FONTES).filter((k) => FONTES[k].enabled).join(','))
  .split(',').map((s) => s.trim()).filter(Boolean);
const limits = {
  maxPaginas: Number(opt('max-paginas', COLETA.maxPaginas)),
  maxDetalhes: Number(opt('max-detalhes', COLETA.maxDetalhesPorRun)),
  limit: opt('limit', null) ? Number(opt('limit', null)) : null,
};
const doMirror = !flag('no-mirror');
const headed = flag('headed');

const log = (m) => console.log(m);
const humanStatus = new Set([STATUS.PROMOVIDO, STATUS.DESCARTADO, STATUS.REVISAR]);

const run = {
  novos: 0, atualizados: 0, inalterados: 0, descartados: 0, espelhadas: 0, erros: 0,
};

// ── main ───────────────────────────────────────────────────────────
const store = await createStore();
log(`RAÍZES · coleta — persistência: ${store.kind}`);
log(`Fontes: ${sources.join(', ')} · filtros 5.000–50.000 m² · ≤ R$ 1,5M · ≤ 300 km de SP\n`);

const existing = new Map((await store.list()).map((l) => [l.id, l]));
log(`Store atual: ${existing.size} leads.\n`);

const { browser, context } = await launchBrowser({ headless: !headed });

for (const src of sources) {
  const fonte = FONTES[src];
  if (!fonte) { log(`⚠️  fonte desconhecida: ${src}`); continue; }
  log(`── ${fonte.nome} (${src}) ────────────────────────────────`);
  let adapter;
  try {
    adapter = await import(`./adapters/${src}.mjs`);
  } catch (e) {
    log(`  ⚠️  sem adapter (${e.message}). Pulando.`); continue;
  }

  const ctx = {
    context, log, limits, polite,
    shouldFetchDetail(sourceId, coarse) {
      const ex = existing.get(`${src}:${sourceId}`);
      if (!ex) return true;
      const ageDays = (Date.now() - Date.parse(ex.coletadoEm)) / 86_400_000;
      if (ageDays > COLETA.reColetarAposDias) return true;
      if (coarse?.precoBrl && ex.precoBrl !== coarse.precoBrl) return true;
      if (coarse?.areaM2 && ex.areaM2 !== coarse.areaM2) return true;
      return false;
    },
  };

  let partials = [];
  try {
    partials = await adapter.coletar(ctx);
  } catch (e) {
    run.erros++; log(`  ❌ erro na coleta: ${e.message}`); continue;
  }
  log(`  → ${partials.length} anúncios coletados. Processando…`);

  for (const p of partials) {
    try {
      p.tipo = classifyTipo(p.tipoOriginal, p.titulo);
      const lead = makeLead(src, p);
      const ex = existing.get(lead.id);

      if (ex && !mudou(ex, lead)) { run.inalterados++; continue; }

      // preserva decisões humanas do lead existente
      if (ex && humanStatus.has(ex.status)) lead.status = ex.status;
      else lead.status = lead.passaFiltros ? STATUS.REVISAR : STATUS.NOVO;
      if (ex) { lead.favorito = ex.favorito; lead.coletadoEm = ex.coletadoEm; }

      // pré-computa o Terreno sugerido (schema do app) → PROMOVER vira só persistir
      lead.terrenoSugerido = leadToTerreno(lead);

      // mirror de amostra (só p/ quem passa nos filtros — controla volume/custo).
      // Falha de mirror é opcional: NUNCA deve impedir o upsert do lead.
      if (doMirror && lead.passaFiltros && lead.fotos[0]?.url) {
        try {
          const buf = await downloadBuffer(context, lead.fotos[0].url);
          if (buf) {
            const ext = (lead.fotos[0].url.split('.').pop() || 'jpg').split('?')[0].slice(0, 4);
            const path = await store.mirrorPhoto(lead.id, 0, buf, ext);
            lead.fotos[0].mirrored = path;
            lead.fotoAmostra = [path];
            run.espelhadas++;
          }
        } catch { /* mirror é best-effort */ }
      }

      await store.upsert(lead);
      existing.set(lead.id, lead);
      if (ex) run.atualizados++; else run.novos++;
      if (!lead.passaFiltros) run.descartados++;
    } catch (e) {
      run.erros++; log(`  ⚠️  lead ${p.sourceId}: ${e.message}`);
    }
  }
  log('');
}

await browser.close();

// ── dedup cross-source sobre a store inteira ───────────────────────
const todos = await store.list();
const { clusters, duplicados } = clusterLeads(todos);
for (const l of todos) await store.upsert(l); // persiste dedupCluster/status
log(`Dedup: ${clusters.length} cluster(s) cross-source, ${duplicados} duplicado(s).`);

// ── resumo ─────────────────────────────────────────────────────────
const stats = await store.stats();
log('\n══════════ RESUMO DA COLETA ══════════');
log(`Novos: ${run.novos} · Atualizados: ${run.atualizados} · Inalterados: ${run.inalterados}`);
log(`Fotos-amostra espelhadas: ${run.espelhadas} · Erros: ${run.erros}`);
log(`\nStore total: ${stats.total} leads · ${stats.passaFiltros} passam nos filtros duros`);
log(`Por fonte: ${JSON.stringify(stats.porFonte)}`);
log(`Por status: ${JSON.stringify(stats.porStatus)}`);

process.exit(0);
