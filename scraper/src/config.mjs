// ─────────────────────────────────────────────────────────────────
// RAÍZES · motor de pesquisa de imóveis — configuração central
// Critérios de busca (hard filters) + registro de fontes + política de
// coleta. Alinhado ao schema Terreno do app (Projeto-Raizes-APP).
// ─────────────────────────────────────────────────────────────────

/** Filtros duros: um lead que falha em QUALQUER um destes é descartado. */
export const FILTROS = {
  areaMinM2: 5_000,
  areaMaxM2: 50_000,
  precoMaxBrl: 1_500_000,
  distanciaMaxSpKm: 300,
};

/** Referência de distância: Praça da Sé, São Paulo/SP. */
export const SP_CENTRO = { lat: -23.5505, lng: -46.6333 };

/** Tipos de imóvel de interesse (rural / terreno). */
export const TIPOS_ALVO = ['fazenda', 'chacara', 'sitio', 'terreno', 'lote', 'condominio'];

/** Registro de fontes → cada uma tem um adapter em src/adapters/<key>.mjs. */
export const FONTES = {
  delmasso:    { nome: 'Delmasso Imóveis', enabled: true, plataforma: 'vista',
                 base: 'https://www.delmassoimoveis.com.br' },
  zapvivareal: { nome: 'ZAP + VivaReal',   enabled: true, plataforma: 'glue',
                 portais: ['zapimoveis', 'vivareal'] },
  imovelweb:   { nome: 'ImovelWeb',        enabled: true, plataforma: 'navent',
                 base: 'https://www.imovelweb.com.br' },
};

/** Política de coleta — educada e resistente a bloqueio (Cloudflare/DataDome). */
export const COLETA = {
  minDelayMs: 1_500,        // atraso mínimo entre requisições
  maxDelayMs: 4_200,        // atraso máximo (jitter "humano")
  maxPaginas: 25,           // teto de páginas de listagem por fonte / run
  maxDetalhesPorRun: 200,   // teto de páginas de detalhe por run
  reColetarAposDias: 14,    // só re-scrapeia se lead > N dias OU preço mudou
  fotosAmostra: 5,          // fotos-amostra espelhadas por lead não-promovido
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 900 },
  headless: true,
};

/** Onde a mídia espelhada vive. */
export const MEDIA = {
  blobContainer: 'leads-media',   // Azure Blob (separado do container "uploads" do app)
  localDir: 'data/media',         // fallback local (relativo à raiz do scraper)
};
