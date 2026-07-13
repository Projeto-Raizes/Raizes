/**
 * normalize-dict.mjs
 *
 * Ordered keyword→value dictionaries for classifying free-text Portuguese
 * real-estate ads. The scraper normalizes text to lowercase ASCII before
 * matching, so all patterns here use plain ASCII (no accents/cedillas).
 *
 * Each entry: { pattern: <regex source string>, value: <enum string> }
 * The classifier returns the VALUE of the FIRST match; if none matches it
 * uses the declared fallback.
 *
 * Pattern strings are used as: new RegExp(pattern).test(normalizedText)
 */

// ---------------------------------------------------------------------------
// 1. AGUA — water source
// fallback: 'nenhuma'
// ---------------------------------------------------------------------------
export const AGUA = [
  // nascente / mina d'agua (strongest — natural spring)
  { pattern: 'nascente',            value: 'nascente' },
  { pattern: 'mina d.?agua',        value: 'nascente' },
  { pattern: 'mina de agua',        value: 'nascente' },

  // lago / represa / acude / lagoa
  { pattern: 'represa',             value: 'lago' },
  { pattern: 'acude',               value: 'lago' },
  { pattern: 'lagoa',               value: 'lago' },
  { pattern: 'lago',                value: 'lago' },

  // poco / cisterna (before generic "agua" patterns)
  { pattern: 'poco artesiano',      value: 'poco' },
  { pattern: 'cisterna',            value: 'poco' },
  { pattern: 'poco',                value: 'poco' },

  // rede publica
  { pattern: 'agua encanada',       value: 'rede' },
  { pattern: 'agua tratada',        value: 'rede' },
  { pattern: 'sabesp',              value: 'rede' },
  { pattern: 'rede de agua',        value: 'rede' },
  { pattern: 'rede publica de agua',value: 'rede' },
];
AGUA.fallback = 'nenhuma';

// ---------------------------------------------------------------------------
// 2. ENERGIA — electricity source
// fallback: 'rede'
// ---------------------------------------------------------------------------
export const ENERGIA = [
  // rede + solar (both present — most specific)
  { pattern: 'rede eletrica.*solar',         value: 'rede+solar' },
  { pattern: 'solar.*rede eletrica',         value: 'rede+solar' },
  { pattern: 'energia eletrica.*solar',      value: 'rede+solar' },
  { pattern: 'solar.*energia eletrica',      value: 'rede+solar' },
  { pattern: 'luz.*solar',                   value: 'rede+solar' },
  { pattern: 'solar.*luz',                   value: 'rede+solar' },

  // solar only
  { pattern: 'fotovoltai',                   value: 'solar' },
  { pattern: 'placa solar',                  value: 'solar' },
  { pattern: 'energia solar',                value: 'solar' },
  { pattern: 'painel solar',                 value: 'solar' },
  { pattern: 'solar',                        value: 'solar' },

  // rede publica
  { pattern: 'energia eletrica',             value: 'rede' },
  { pattern: 'rede eletrica',                value: 'rede' },
  { pattern: 'trifasic',                     value: 'rede' },
  { pattern: 'padrao de energia',            value: 'rede' },
  { pattern: '\\bluz\\b',                    value: 'rede' },
];
ENERGIA.fallback = 'rede';

// ---------------------------------------------------------------------------
// 3. INTERNET — connectivity type
// fallback: 'nenhuma'
// ---------------------------------------------------------------------------
export const INTERNET = [
  // fibra otica (most specific)
  { pattern: 'fibra otica',                  value: 'fibra' },
  { pattern: '\\bfibra\\b',                  value: 'fibra' },

  // satelite
  { pattern: 'starlink',                     value: 'satelite' },
  { pattern: 'satelit',                      value: 'satelite' },
  { pattern: 'internet satelite',            value: 'satelite' },

  // radio
  { pattern: 'internet.*radio',              value: 'radio' },
  { pattern: 'via radio',                    value: 'radio' },
  { pattern: 'link via radio',               value: 'radio' },

  // 4g / 3g / celular
  { pattern: '4g',                           value: '4g' },
  { pattern: '3g',                           value: '4g' },
  { pattern: 'sinal de celular',             value: '4g' },
  { pattern: 'internet movel',               value: '4g' },
];
INTERNET.fallback = 'nenhuma';

// ---------------------------------------------------------------------------
// 4. ACESSO — road access quality
// fallback: 'terra-boa'
// ---------------------------------------------------------------------------
export const ACESSO = [
  // asfalto
  { pattern: 'asfalt',                       value: 'asfalto' },
  { pattern: 'pavimentad',                   value: 'asfalto' },
  { pattern: 'calcad',                       value: 'asfalto' },
  { pattern: 'estrada asfaltada',            value: 'asfalto' },

  // terra ruim (before terra-boa to avoid false positives)
  { pattern: 'terra ruim',                   value: 'terra-ruim' },
  { pattern: 'dificil acesso',               value: 'terra-ruim' },
  { pattern: 'atoleiro',                     value: 'terra-ruim' },
  { pattern: 'nao asfaltad',                 value: 'terra-ruim' },

  // terra boa
  { pattern: 'estrada de terra',             value: 'terra-boa' },
  { pattern: 'chao batido',                  value: 'terra-boa' },
  { pattern: 'terra',                        value: 'terra-boa' },
];
ACESSO.fallback = 'terra-boa';

// ---------------------------------------------------------------------------
// 5. SANEAMENTO — sewage/sanitation
// fallback: 'fossa'
// ---------------------------------------------------------------------------
export const SANEAMENTO = [
  // biodigestor (most specific / eco-friendly)
  { pattern: 'biodigestor',                  value: 'biodigestor' },

  // rede de esgoto (before generic "esgoto")
  { pattern: 'rede de esgoto',               value: 'rede' },
  { pattern: 'saneamento basico',            value: 'rede' },
  { pattern: '\\besgoto\\b',                 value: 'rede' },

  // fossa
  { pattern: 'fossa septica',                value: 'fossa' },
  { pattern: '\\bfossa\\b',                  value: 'fossa' },
];
SANEAMENTO.fallback = 'fossa';

// ---------------------------------------------------------------------------
// 6. TOPOGRAFIA — land relief
// fallback: 'suave'
// ---------------------------------------------------------------------------
export const TOPOGRAFIA = [
  // plano (flat)
  { pattern: 'planicie',                     value: 'plano' },
  { pattern: 'terreno plano',                value: 'plano' },
  { pattern: '\\bplana\\b',                  value: 'plano' },
  { pattern: '\\bplano\\b',                  value: 'plano' },

  // acidentado (steep — before ondulado to avoid overlap)
  { pattern: 'declive acentuad',             value: 'acidentado' },
  { pattern: 'muito inclinad',               value: 'acidentado' },
  { pattern: '\\bingreme\\b',                value: 'acidentado' },
  { pattern: 'acidentad',                    value: 'acidentado' },

  // ondulado
  { pattern: 'meia encosta',                 value: 'ondulado' },
  { pattern: 'ondulad',                      value: 'ondulado' },

  // suave
  { pattern: 'leve declive',                 value: 'suave' },
  { pattern: 'levemente ondulad',            value: 'suave' },
  { pattern: '\\bsuave\\b',                  value: 'suave' },
];
TOPOGRAFIA.fallback = 'suave';

// ---------------------------------------------------------------------------
// 7. DOCUMENTACAO — legal title situation
// fallback: 'verificar'
// ---------------------------------------------------------------------------
export const DOCUMENTACAO = [
  // escritura / matricula (strongest legal title)
  { pattern: 'escritura definitiva',         value: 'escritura' },
  { pattern: 'escritura publica',            value: 'escritura' },
  { pattern: '\\bescritura\\b',              value: 'escritura' },
  { pattern: 'matricula',                    value: 'escritura' },
  { pattern: 'registro de imovel',           value: 'escritura' },
  { pattern: 'registrado',                   value: 'escritura' },

  // inventario / espolio
  { pattern: 'inventario',                   value: 'inventario' },
  { pattern: 'espolio',                      value: 'inventario' },

  // posse / contrato informal
  { pattern: 'compromisso de compra',        value: 'posse' },
  { pattern: 'contrato de gaveta',           value: 'posse' },
  { pattern: '\\bposse\\b',                  value: 'posse' },
];
DOCUMENTACAO.fallback = 'verificar';

// ---------------------------------------------------------------------------
// 8. TIPO_IMOVEL — property type
// fallback: 'outro'
// ---------------------------------------------------------------------------
export const TIPO_IMOVEL = [
  // fazenda (largest / most specific)
  { pattern: '\\bfazenda\\b',                value: 'fazenda' },

  // chacara
  { pattern: '\\bchacara\\b',                value: 'chacara' },

  // sitio
  { pattern: '\\bsitio\\b',                  value: 'sitio' },

  // terreno / lote (before generic "terra")
  { pattern: '\\bterreno\\b',                value: 'terreno' },
  { pattern: '\\blote\\b',                   value: 'lote' },

  // condominio
  { pattern: 'condominio fechado',           value: 'condominio' },
  { pattern: 'condominio',                   value: 'condominio' },

  // casa / sobrado
  { pattern: '\\bsobrado\\b',                value: 'casa' },
  { pattern: '\\bcasa\\b',                   value: 'casa' },
];
TIPO_IMOVEL.fallback = 'outro';

// ---------------------------------------------------------------------------
// AGUA_NATURAL — regex sources for temAguaNatural=true
// ANY match → true
// ---------------------------------------------------------------------------
export const AGUA_NATURAL = [
  'nascente',
  'mina d.?agua',
  'rio',
  'corrego',
  'riacho',
  'cachoeira',
  'represa',
  'acude',
  'lagoa',
  'lago',
];

// ---------------------------------------------------------------------------
// BENFEITORIAS — ad keywords → { label, moduloId }
// ORDER: most specific phrases before shorter/broader terms
// ---------------------------------------------------------------------------
export const BENFEITORIAS = [
  // casa principal / sede
  { pattern: 'casa sede',           label: 'Casa Sede',           moduloId: 'casa-sede' },
  { pattern: 'casa principal',      label: 'Casa Sede',           moduloId: 'casa-sede' },

  // casa de caseiro / funcionario
  { pattern: 'casa de caseiro',     label: 'Casa de Caseiro',     moduloId: 'casa-caseiro' },
  { pattern: 'casa do caseiro',     label: 'Casa de Caseiro',     moduloId: 'casa-caseiro' },
  { pattern: 'casa de funcionario', label: 'Casa de Caseiro',     moduloId: 'casa-caseiro' },
  { pattern: 'caseiro',             label: 'Casa de Caseiro',     moduloId: 'casa-caseiro' },

  // area gourmet
  { pattern: 'espaco gourmet',      label: 'Area Gourmet',        moduloId: 'area-gourmet' },
  { pattern: 'area gourmet',        label: 'Area Gourmet',        moduloId: 'area-gourmet' },

  // salao de festas / eventos
  { pattern: 'salao de festas',     label: 'Salao de Eventos',    moduloId: 'salao-eventos' },
  { pattern: 'salao de eventos',    label: 'Salao de Eventos',    moduloId: 'salao-eventos' },
  { pattern: 'espaco de eventos',   label: 'Salao de Eventos',    moduloId: 'salao-eventos' },

  // piscina
  { pattern: 'piscina',             label: 'Piscina',             moduloId: 'piscina' },

  // campo de futebol / society
  { pattern: 'campo de futebol',    label: 'Campo Society',       moduloId: 'campo-society' },
  { pattern: 'campo society',       label: 'Campo Society',       moduloId: 'campo-society' },
  { pattern: 'campo de society',    label: 'Campo Society',       moduloId: 'campo-society' },
  { pattern: '\\bcampo\\b',         label: 'Campo Society',       moduloId: 'campo-society' },

  // horta / pomar
  { pattern: 'horta e pomar',       label: 'Horta e Pomar',       moduloId: 'horta-pomar' },
  { pattern: '\\bpomar\\b',         label: 'Horta e Pomar',       moduloId: 'horta-pomar' },
  { pattern: '\\bhorta\\b',         label: 'Horta e Pomar',       moduloId: 'horta-pomar' },

  // galinheiro / canil / aviario
  { pattern: 'galinheiro',          label: 'Galinheiro',          moduloId: 'galinheiro' },
  { pattern: '\\bcapoeira\\b',      label: 'Galinheiro',          moduloId: 'galinheiro' },
  { pattern: 'aviario',             label: 'Galinheiro',          moduloId: 'galinheiro' },
  { pattern: '\\bcanil\\b',         label: 'Galinheiro',          moduloId: 'galinheiro' },

  // lago de pesca
  { pattern: 'lago de pesca',       label: 'Lago de Pesca',       moduloId: 'lago-pesca' },
  { pattern: 'pesqueiro',           label: 'Lago de Pesca',       moduloId: 'lago-pesca' },
  { pattern: 'tanque de peixe',     label: 'Lago de Pesca',       moduloId: 'lago-pesca' },
  { pattern: 'piscicultura',        label: 'Lago de Pesca',       moduloId: 'lago-pesca' },

  // fogo de chao / churrasqueira / forno
  { pattern: 'fogo de chao',        label: 'Fogo de Chao',        moduloId: 'fogo-de-chao' },
  { pattern: 'churrasqueira',       label: 'Churrasqueira',       moduloId: 'fogo-de-chao' },
  { pattern: 'forno de pizza',      label: 'Forno de Pizza',      moduloId: 'fogo-de-chao' },
  { pattern: 'forno de lenha',      label: 'Forno de Lenha',      moduloId: 'fogo-de-chao' },

  // poco artesiano (extra)
  { pattern: 'poco artesiano',      label: 'Poco Artesiano',      moduloId: 'poco-artesiano' },

  // energia solar (extra)
  { pattern: 'energia solar',       label: 'Energia Solar',       moduloId: 'energia-solar' },
  { pattern: 'fotovoltai',          label: 'Energia Solar',       moduloId: 'energia-solar' },
  { pattern: 'painel solar',        label: 'Energia Solar',       moduloId: 'energia-solar' },

  // sauna (extra)
  { pattern: 'sauna',               label: 'Sauna',               moduloId: 'sauna' },

  // quadra (extra)
  { pattern: 'quadra de tenis',     label: 'Quadra de Tenis',     moduloId: 'quadra' },
  { pattern: 'quadra poliesportiva',label: 'Quadra Poliesportiva', moduloId: 'quadra' },
  { pattern: '\\bquadra\\b',        label: 'Quadra',              moduloId: 'quadra' },

  // curral / baia / estabulo (extra)
  { pattern: 'estabulo',            label: 'Curral/Estabulo',     moduloId: 'curral' },
  { pattern: '\\bbaia\\b',          label: 'Baia',                moduloId: 'curral' },
  { pattern: '\\bcurral\\b',        label: 'Curral',              moduloId: 'curral' },

  // galpao / barracao (extra)
  { pattern: 'barracao',            label: 'Galpao/Barracao',     moduloId: 'galpao' },
  { pattern: 'galpao',              label: 'Galpao',              moduloId: 'galpao' },
];

// ---------------------------------------------------------------------------
// APP_RESERVA — environmental protection area signals
// ANY match → flag for review
// ---------------------------------------------------------------------------
export const APP_RESERVA = [
  '\\bapp\\b',
  'area de preservacao',
  'reserva legal',
  'mata nativa',
  'mata atlantica',
  '\\bapa\\b',
];

// ---------------------------------------------------------------------------
// Self-test (only runs when executed directly: node normalize-dict.mjs)
// ---------------------------------------------------------------------------
const _thisFile = new URL(import.meta.url).href;
const _callerFile = new URL('file:///' + process.argv[1].replace(/\\/g, '/')).href;
if (_thisFile === _callerFile) {
  const dicts = { AGUA, ENERGIA, INTERNET, ACESSO, SANEAMENTO, TOPOGRAFIA, DOCUMENTACAO, TIPO_IMOVEL };
  console.log('=== normalize-dict.mjs self-test ===');
  for (const [name, arr] of Object.entries(dicts)) {
    console.log(`${name}: ${arr.length} entries  (fallback: '${arr.fallback}')`);
  }
  console.log(`AGUA_NATURAL: ${AGUA_NATURAL.length} entries`);
  console.log(`BENFEITORIAS: ${BENFEITORIAS.length} entries`);
  console.log(`APP_RESERVA:  ${APP_RESERVA.length} entries`);

  // Smoke-test a few patterns
  const normalize = (s) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const tests = [
    [AGUA, normalize('Tem nascente no fundo do terreno'), 'nascente'],
    [AGUA, normalize('Agua encanada da prefeitura'), 'rede'],
    [ENERGIA, normalize('Energia solar fotovoltaica instalada'), 'solar'],
    [ENERGIA, normalize('Luz da CPFL trifasica'), 'rede'],
    [INTERNET, normalize('Starlink instalado'), 'satelite'],
    [ACESSO, normalize('Acesso por estrada asfaltada'), 'asfalto'],
    [ACESSO, normalize('Atoleiro na chuva, dificil acesso'), 'terra-ruim'],
    [SANEAMENTO, normalize('Possui biodigestor'), 'biodigestor'],
    [TOPOGRAFIA, normalize('Terreno plano, facil construcao'), 'plano'],
    [DOCUMENTACAO, normalize('Escritura definitiva no cartorio'), 'escritura'],
    [TIPO_IMOVEL, normalize('Sitio com 5 hectares'), 'sitio'],
  ];

  let passed = 0;
  for (const [dict, text, expected] of tests) {
    const match = dict.find(({ pattern }) => new RegExp(pattern).test(text));
    const got = match ? match.value : dict.fallback;
    const ok = got === expected;
    if (!ok) console.error(`  FAIL: expected '${expected}', got '${got}' (text: "${text}")`);
    else passed++;
  }
  console.log(`\nSmoke tests: ${passed}/${tests.length} passed`);
}
