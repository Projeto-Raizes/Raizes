/**
 * municipios.mjs
 * Geocoding + search-seed table for the Raízes rural real-estate scraper.
 * Covers ~300 km radius from São Paulo capital (Praça da Sé).
 *
 * Exports:
 *   SP_CENTRO               – reference point (Praça da Sé)
 *   distanciaSpKm(lat, lng) – haversine distance to SP_CENTRO, km rounded to 1 decimal
 *   MUNICIPIOS              – array of municipalities with pre-computed distanciaSpKm
 */

export const SP_CENTRO = { lat: -23.5505, lng: -46.6333 };

export function distanciaSpKm(lat, lng) {
  const R = 6371;
  const dLat = (lat - SP_CENTRO.lat) * Math.PI / 180;
  const dLng = (lng - SP_CENTRO.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(SP_CENTRO.lat * Math.PI / 180) *
    Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

const _m = (nome, uf, lat, lng, regiao) => ({
  nome, uf, lat, lng, regiao,
  distanciaSpKm: distanciaSpKm(lat, lng),
});

export const MUNICIPIOS = [
  // ── Sorocaba / Ibiúna sweet-spot (SW/W of SP, 40–120 km) ───────────────────
  _m('Cotia',                   'SP', -23.6036, -46.9192, 'Sorocaba/Ibiúna'),
  _m('Vargem Grande Paulista',  'SP', -23.5997, -47.0303, 'Sorocaba/Ibiúna'),
  _m('Araçariguama',            'SP', -23.4386, -47.0614, 'Sorocaba/Ibiúna'),
  _m('São Roque',               'SP', -23.5278, -47.1361, 'Sorocaba/Ibiúna'),
  _m('Mairinque',               'SP', -23.5436, -47.1875, 'Sorocaba/Ibiúna'),
  _m('Alumínio',                'SP', -23.5342, -47.2269, 'Sorocaba/Ibiúna'),
  _m('Ibiúna',                  'SP', -23.6561, -47.2225, 'Sorocaba/Ibiúna'),
  _m('Piedade',                 'SP', -23.7133, -47.4250, 'Sorocaba/Ibiúna'),
  _m('Salto de Pirapora',       'SP', -23.6478, -47.5728, 'Sorocaba/Ibiúna'),
  _m('Votorantim',              'SP', -23.5475, -47.4375, 'Sorocaba/Ibiúna'),
  _m('Sorocaba',                'SP', -23.5015, -47.4526, 'Sorocaba/Ibiúna'),
  _m('Pilar do Sul',            'SP', -23.8077, -47.7222, 'Sorocaba/Ibiúna'),
  _m('Tapiraí',                 'SP', -23.9612, -47.5062, 'Sorocaba/Ibiúna'),

  // ── Grande SP / periurbano sul ──────────────────────────────────────────────
  _m('Itapecerica da Serra',    'SP', -23.7169, -46.8492, 'Grande SP'),
  _m('Embu-Guaçu',              'SP', -23.8311, -46.8125, 'Grande SP'),
  _m('São Lourenço da Serra',   'SP', -23.8519, -46.9439, 'Grande SP'),
  _m('Juquitiba',               'SP', -23.9344, -47.0650, 'Grande SP'),
  _m('Santana de Parnaíba',     'SP', -23.4439, -46.9172, 'Grande SP'),
  _m('Pirapora do Bom Jesus',   'SP', -23.3978, -47.0000, 'Grande SP'),
  _m('Cajamar',                 'SP', -23.3578, -46.8761, 'Grande SP'),
  _m('Franco da Rocha',         'SP', -23.3300, -46.7281, 'Grande SP'),

  // ── Campinas / RMC ─────────────────────────────────────────────────────────
  _m('Jundiaí',                 'SP', -23.1864, -46.8964, 'Campinas/RMC'),
  _m('Itu',                     'SP', -23.2644, -47.2997, 'Campinas/RMC'),
  _m('Salto',                   'SP', -23.2014, -47.2875, 'Campinas/RMC'),
  _m('Porto Feliz',             'SP', -23.2150, -47.5228, 'Campinas/RMC'),
  _m('Cerquilho',               'SP', -23.1675, -47.7461, 'Campinas/RMC'),
  _m('Tietê',                   'SP', -23.1017, -47.7133, 'Campinas/RMC'),
  _m('Boituva',                 'SP', -23.2842, -47.6736, 'Campinas/RMC'),
  _m('Indaiatuba',              'SP', -23.0900, -47.2194, 'Campinas/RMC'),
  _m('Campinas',                'SP', -22.9099, -47.0626, 'Campinas/RMC'),
  _m('Valinhos',                'SP', -22.9700, -46.9961, 'Campinas/RMC'),
  _m('Itatiba',                 'SP', -23.0044, -46.8383, 'Campinas/RMC'),
  _m('Piracicaba',              'SP', -22.7253, -47.6492, 'Campinas/RMC'),
  _m('Limeira',                 'SP', -22.5647, -47.4017, 'Campinas/RMC'),
  _m('São Pedro',               'SP', -22.5481, -47.9156, 'Campinas/RMC'),
  _m('Conchas',                 'SP', -23.0150, -48.0133, 'Campinas/RMC'),

  // ── Circuito das Águas ─────────────────────────────────────────────────────
  _m('Amparo',                  'SP', -22.7022, -46.7706, 'Circuito das Águas'),
  _m('Serra Negra',             'SP', -22.6097, -46.7003, 'Circuito das Águas'),
  _m('Socorro',                 'SP', -22.5903, -46.5264, 'Circuito das Águas'),
  _m('Águas de Lindóia',        'SP', -22.4789, -46.6344, 'Circuito das Águas'),
  _m('Monte Alegre do Sul',     'SP', -22.6817, -46.6839, 'Circuito das Águas'),
  _m('Pedreira',                'SP', -22.7414, -46.9006, 'Circuito das Águas'),

  // ── Atibaia / Bragança / Mantiqueira SP ────────────────────────────────────
  _m('Atibaia',                 'SP', -23.1172, -46.5506, 'Mantiqueira'),
  _m('Bragança Paulista',       'SP', -22.9519, -46.5419, 'Mantiqueira'),
  _m('Piracaia',                'SP', -23.0528, -46.3578, 'Mantiqueira'),
  _m('Nazaré Paulista',         'SP', -23.1814, -46.3947, 'Mantiqueira'),
  _m('Joanópolis',              'SP', -22.9283, -46.2742, 'Mantiqueira'),

  // ── Mantiqueira / Sul de Minas MG ──────────────────────────────────────────
  _m('Extrema',                 'MG', -22.8561, -46.3192, 'Sul de Minas'),
  _m('Camanducaia',             'MG', -22.7572, -46.1461, 'Sul de Minas'),
  _m('Itapeva',                 'MG', -22.7051, -46.2283, 'Sul de Minas'),
  _m('Cambuí',                  'MG', -22.6153, -46.0614, 'Sul de Minas'),
  _m('Gonçalves',               'MG', -22.6545, -45.8557, 'Sul de Minas'),
  _m('Conceição dos Ouros',     'MG', -22.4175, -45.7963, 'Sul de Minas'),
  _m('Pouso Alegre',            'MG', -22.2297, -45.9353, 'Sul de Minas'),
  _m('Santa Rita do Sapucaí',   'MG', -22.2533, -45.7006, 'Sul de Minas'),
  _m('Itajubá',                 'MG', -22.4297, -45.4528, 'Sul de Minas'),
  _m('Piranguçu',               'MG', -22.5265, -45.4933, 'Sul de Minas'),
  _m('Wenceslau Braz',          'MG', -22.5290, -45.3568, 'Sul de Minas'),

  // ── Vale do Paraíba ────────────────────────────────────────────────────────
  _m('São José dos Campos',     'SP', -23.1794, -45.8869, 'Vale do Paraíba'),
  _m('Jacareí',                 'SP', -23.2983, -45.9658, 'Vale do Paraíba'),
  _m('Taubaté',                 'SP', -23.0261, -45.5553, 'Vale do Paraíba'),
  _m('Pindamonhangaba',         'SP', -22.9239, -45.4619, 'Vale do Paraíba'),
  _m('Guaratinguetá',           'SP', -22.8175, -45.1906, 'Vale do Paraíba'),
  _m('Aparecida',               'SP', -22.8506, -45.2322, 'Vale do Paraíba'),
  _m('Lorena',                  'SP', -22.7269, -45.1217, 'Vale do Paraíba'),
  _m('São Luís do Paraitinga',  'SP', -23.2228, -45.3097, 'Vale do Paraíba'),
  _m('Cunha',                   'SP', -23.0781, -44.9589, 'Vale do Paraíba'),
  _m('Silveiras',               'SP', -22.6664, -44.8564, 'Vale do Paraíba'),

  // ── Sul Fluminense / RJ ────────────────────────────────────────────────────
  _m('Resende',                 'RJ', -22.4681, -44.4508, 'Sul Fluminense'),
  _m('Itatiaia',                'RJ', -22.4956, -44.5631, 'Sul Fluminense'),
  _m('Barra Mansa',             'RJ', -22.5436, -44.1711, 'Sul Fluminense'),
  _m('Volta Redonda',           'RJ', -22.5231, -44.1042, 'Sul Fluminense'),
  _m('Angra dos Reis',          'RJ', -23.0067, -44.3181, 'Sul Fluminense'),
  _m('Paraty',                  'RJ', -23.2197, -44.7131, 'Sul Fluminense'),

  // ── Litoral SP ─────────────────────────────────────────────────────────────
  _m('Santos',                  'SP', -23.9608, -46.3336, 'Litoral SP'),
  _m('Guarujá',                 'SP', -23.9928, -46.2567, 'Litoral SP'),
  _m('Bertioga',                'SP', -23.8547, -46.1386, 'Litoral SP'),
  _m('Itanhaém',                'SP', -24.1822, -46.7883, 'Litoral SP'),
  _m('Peruíbe',                 'SP', -24.3194, -47.0058, 'Litoral SP'),
  _m('São Sebastião',           'SP', -23.8050, -45.4064, 'Litoral SP'),
  _m('Caraguatatuba',           'SP', -23.6203, -45.4131, 'Litoral SP'),
  _m('Ubatuba',                 'SP', -23.4336, -45.0711, 'Litoral SP'),

  // ── Vale do Ribeira ────────────────────────────────────────────────────────
  _m('Pedro de Toledo',         'SP', -24.2769, -47.2342, 'Vale do Ribeira'),
  _m('Miracatu',                'SP', -24.2811, -47.4592, 'Vale do Ribeira'),
  _m('Sete Barras',             'SP', -24.3858, -47.9242, 'Vale do Ribeira'),
  _m('Registro',                'SP', -24.4878, -47.8436, 'Vale do Ribeira'),
  _m('Eldorado',                'SP', -24.5219, -48.1153, 'Vale do Ribeira'),
  _m('Jacupiranga',             'SP', -24.6947, -48.0003, 'Vale do Ribeira'),

  // ── Itapetininga / Interior Sul SP ─────────────────────────────────────────
  _m('Itapetininga',            'SP', -23.5919, -48.0531, 'Itapetininga'),
  _m('Angatuba',                'SP', -23.4908, -48.4139, 'Itapetininga'),
  _m('Buri',                    'SP', -23.7975, -48.5927, 'Itapetininga'),
  _m('Capão Bonito',            'SP', -24.0044, -48.3481, 'Itapetininga'),
  _m('Guapiara',                'SP', -24.1850, -48.5330, 'Itapetininga'),
  _m('Ribeirão Branco',         'SP', -24.2206, -48.7635, 'Itapetininga'),
  _m('Itapeva',                 'SP', -23.9814, -48.8757, 'Itapetininga'),
  _m('Itaberá',                 'SP', -23.8643, -49.1405, 'Itapetininga'),
  _m('Taquarivaí',              'SP', -23.9211, -48.6948, 'Itapetininga'),
  _m('Botucatu',                'SP', -22.8856, -48.4447, 'Itapetininga'),
  _m('São Manuel',              'SP', -22.7322, -48.5681, 'Itapetininga'),
];
