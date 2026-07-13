# 🌱 RAÍZES — Scraper de Imóveis

Motor de coleta de imóveis rurais dos portais → banco de **leads** (Azure Table
`leads` + Blob `leads-media`, ou local `data/leads.json`). Alimenta o *banco de
terrenos* do Projeto Raízes sem pesquisar o mesmo imóvel duas vezes.

Ver **[DESIGN.md](DESIGN.md)** para a arquitetura completa.

## Instalar

```bash
cd scraper
npm install                 # instala playwright + @azure/*
# usa o Chrome do sistema (channel:'chrome'); se não tiver, rode:
npm run browsers            # baixa o Chromium do Playwright
```

## Rodar

```bash
node src/run.mjs                                # todas as fontes habilitadas
node src/run.mjs --source delmasso              # só uma fonte
node src/run.mjs --source zapvivareal,imovelweb # várias
node src/run.mjs --max-paginas 3 --limit 100    # coleta reduzida (teste)
node src/run.mjs --no-mirror                    # não baixa fotos-amostra
node src/run.mjs --headed                       # browser visível (debug)
```

Flags: `--source a,b` · `--max-paginas N` · `--limit N` · `--no-mirror` · `--headed`.

**Persistência:** por padrão local (`data/leads.json`). Para gravar no **mesmo
Azure do app**, exporte a connection string antes:

```bash
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=...;AccountKey=...;"
node src/run.mjs
```

Cria a tabela `leads` e o container `leads-media` automaticamente (idempotente).

## Verificar

```bash
node src/selftest.mjs                            # testes do núcleo (sem rede)
node src/probe.mjs "<url>" "<regexJson>"         # recon de um site novo
```

## Estrutura

```
src/
 ├─ config.mjs          filtros duros, fontes, política de coleta
 ├─ model.mjs           LEAD bruto + enriquecimento (distância/filtros)
 ├─ run.mjs             orquestrador (CLI)
 ├─ probe.mjs           ferramenta de recon (captura JSON + estrutura)
 ├─ selftest.mjs        testes do núcleo
 ├─ data/
 │   ├─ municipios.mjs      99 municípios ≤300 km de SP (+ coords)
 │   └─ normalize-dict.mjs  dicionários texto→enum
 ├─ lib/
 │   ├─ browser.mjs     Playwright pt-BR + fetch in-page + captura de rede
 │   ├─ store.mjs       persistência (Azure Table/Blob | local)
 │   ├─ distance.mjs    haversine → km de SP
 │   ├─ geo.mjs         cidade → coords (fallback)
 │   ├─ dedup.mjs       clustering cross-source
 │   ├─ normalize.mjs   texto → enums + leadToTerreno
 │   └─ util.mjs        parsing pt-BR (preço/área/ha/alqueire), norm, hash
 └─ adapters/
     ├─ delmasso.mjs        Vista Software (JSON)
     ├─ zapvivareal.mjs     Glue API
     └─ imovelweb.mjs       Navent (DOM cards)
data/
 ├─ leads.json         store local (gitignored)
 ├─ media/             fotos-amostra locais (gitignored)
 └─ probe/             saídas de recon
```

## Adicionar uma nova corretora / portal

1. **Recon:** `node src/probe.mjs "https://site/busca" "api|ajax|json"` — vê se
   há JSON de rede (melhor), JSON-LD, ou cards no DOM. Saída completa em
   `data/probe/<host>.json`.
2. **Crie** `src/adapters/<chave>.mjs` exportando:
   ```js
   export const key = '<chave>';
   export const nome = 'Nome Exibido';
   export async function coletar(ctx) {
     // ctx = { context, log, limits, polite, shouldFetchDetail }
     // retorna: array de "partials" crus (cada um com ao menos sourceId)
     return partials;
   }
   ```
   Um *partial* usa os campos do LEAD (ver `src/model.mjs`): `sourceId`,
   `fonteUrl`, `titulo`, `tipoOriginal`, `descricao`, `cidade`, `uf`,
   `coordenadas{lat,lng}`, `areaM2`, `precoBrl`, `fotos[]`, etc. O orquestrador
   cuida de classificar tipo, calcular distância, aplicar filtros, dedup e store.
3. **Registre** em `src/config.mjs → FONTES` com `enabled: true`.
4. **Teste:** `node src/run.mjs --source <chave> --max-paginas 1 --limit 30`.

**Plataformas comuns no Brasil** (um adapter serve a muitas corretoras):
- **Vista Software** (`vistahost.com.br`) → como Delmasso: web method
  `Properties.ajax`, `[{filter,order,page}]`.
- **Navent/ImovelWeb** → DOM cards `[data-qa="posting PROPERTY"]`.
- **Glue API** (ZAP/VivaReal/OLX) → `glue-api.*/v2/listings`, header `x-domain`.
- **Tecimob / Jetimob / Ingaia / Union** → costumam ter feed XML ou JSON-LD.

## Status dos adapters (MVP)

| Fonte | Estado |
|---|---|
| Delmasso (Vista) | ✅ completo — JSON com coords, 22 páginas |
| ZAP + VivaReal (Glue) | ✅ Glue API por município (ZAP; VivaReal = trocar host/portal) |
| ImovelWeb (Navent) | ✅ DOM cards por município/tipo |

Próximas fontes sugeridas: Chaves na Mão, OLX Imóveis, Imovirtual, e portais
rurais (Fazendas.com.br, AgroFY, Rede Imóveis Rurais).
