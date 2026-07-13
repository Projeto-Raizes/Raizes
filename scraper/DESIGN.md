# 🌱 RAÍZES — Motor de Pesquisa de Imóveis · Design

> Coleta estruturada de imóveis rurais dos portais, com deduplicação, filtros
> duros e persistência no mesmo storage do app, para **não pesquisar o mesmo
> imóvel duas vezes** e alimentar o *banco de terrenos* do Projeto Raízes.

## 1. Objetivo e critérios

Encontrar imóveis rurais candidatos ao projeto RAÍZES e guardar tudo de
relevante num banco próprio. **Filtros duros** (um lead que falha em qualquer
um é marcado, não promovido):

| Critério | Faixa |
|---|---|
| Área do terreno | **5.000 – 50.000 m²** |
| Preço de venda | **≤ R$ 1.500.000** |
| Distância de São Paulo (capital) | **≤ 300 km** (haversine) |

Ranqueamento por proximidade (alvo Ibiúna ~62 km) e match de critérios
(água natural, edificações, acesso asfalto, documentação).

## 2. Arquitetura em duas camadas de dados

Espelha o padrão que o projeto já usa (`dados.json` bruto → `Terreno`
normalizado, como no imóvel 8285):

- **LEAD bruto** (`src/model.mjs`) — superset do anúncio: origem, ids, título,
  tipo, cidade/UF/bairro, **coordenadas**, área, preço, IPTU, quartos/banheiros,
  `estrutura[]`/`infraTxt[]` cruas, corretora, `fotos[]`, `videos[]`, distância a
  SP, flags de filtro, `dedupCluster`, `status`, e o `raw` do adapter.
- **Terreno normalizado** (`src/lib/normalize.mjs → leadToTerreno`) — o schema
  exato do app: `precoBrl`, `areaM2`, enum `topografia`, `infra{agua|energia|
  internet|acesso|saneamento}`, `distancias{...}`, `benfeitorias[]`,
  `modulosExistentes[]`, `anuncioUrl`, `documentacao`, `observacoes`. É gerado na
  **promoção** (texto livre → enums via dicionários + leitura qualitativa).

## 3. Fluxo do pipeline

```
adapter (por site) ──▶ partial cru
      │
      ▼
makeLead()  ── distância (coords▸cidade) · filtros duros · contentHash
      │
      ▼
freshness   ── se já existe e não mudou (preço/área/fotos) e < 14 dias → pula
      │
      ▼
mirror amostra (só p/ quem passa) ── baixa foto-destaque → Blob/local
      │
      ▼
store.upsert  (Azure Table `leads`  |  local data/leads.json)
      │
      ▼
dedup cross-source  ── agrupa o MESMO imóvel de fontes diferentes
```

## 4. Deduplicação (o "não pesquisar 2×")

- **Primária:** `id = source:sourceId` (código do próprio portal — ZAP
  `listingId`, Delmasso `Codigo`, ImovelWeb `data-id`). É a RowKey da store:
  revisitar o mesmo anúncio sobrescreve/atualiza, nunca duplica.
- **Freshness:** re-scrapeia só se o lead tem > 14 dias **ou** preço/área/fotos
  mudaram (`contentHash`). Evita reprocessar o inventário inteiro a cada run.
- **Cross-source** (`src/lib/dedup.mjs`): o mesmo imóvel anunciado por
  corretoras diferentes é agrupado — coordenadas ≤ 150 m **ou** (cidade + área
  ±5% + preço ±10%), **apenas entre fontes distintas**. Escolhe a canônica
  (mais fotos > tem coords > menor preço) e marca as outras `duplicado`.

## 5. Armazenamento (dois backends, `src/lib/store.mjs`)

Mesma filosofia de `server/db.mjs` do app:

- **Azure** (quando `AZURE_STORAGE_CONNECTION_STRING` está setada) → Table
  **`leads`** (PK `'l'`, RowKey `id`, coluna `j`=JSON — idêntico às tabelas
  `terrenos/modulos`) + Blob **`leads-media`** para fotos-amostra. Fica na mesma
  conta do app → a app pode ler `leads` direto na Fase 2.
- **Local** (padrão, zero nuvem) → `data/leads.json` + `data/media/`.

A tabela `leads` é **separada** da `terrenos` (curada): um lead só vira Terreno
na **promoção** (decisão humana), mantendo o comparador limpo.

## 6. Mídia

- Para todo lead: guarda as **URLs** das fotos + `fotosTotal`.
- Para leads que **passam nos filtros**: baixa a **foto-destaque** como amostra
  para o Blob/local (browseável) — controla volume/custo (centenas × dezenas de
  fotos).
- Galeria completa + vídeo: só na **promoção** (via página de detalhe). *(Fase 2.)*

## 7. Onde roda

CLI Node local (`node src/run.mjs`) na máquina do André — **IP brasileiro**
(geo correto, passa Cloudflare/DataDome) e Chrome real (Playwright,
`channel:'chrome'`). Escreve direto no Azure quando a connection string está no
ambiente. **Não** roda no App Service F1 (US, sem browser headed). Ritmo
educado (delay 1,5–4,2 s, jitter humano).

## 8. Fontes e contratos (recon real, jul/2026)

| Fonte | Plataforma | Extração | Observações |
|---|---|---|---|
| **Delmasso** | Vista Software / Wix | web method `Properties.ajax` (JSON) — `[{filter,order,page}]`, 50/página, 22 páginas. **Tem lat/lng, AreaTotal, Descricao, Caracteristicas, InfraEstrutura.** | Corretora regional Ibiúna/Sorocaba (alto sinal). Header `authorization` (wixcode-pub) capturado da própria página. |
| **ZAP + VivaReal** | Glue API (Next.js/Cloudflare) | navega a busca por município → captura o template `glue-api/v2/listings` → pagina via fetch in-page (`size≤24`, header `x-domain`). | `unitTypes`, `pricingInfos`, `usableAreas/totalAreas`, `address.point{lat,lon}`, `medias`. Área filtra o rural entre "todos os tipos". |
| **ImovelWeb** | Navent (DataDome) | DOM cards `[data-qa="posting PROPERTY"]` na busca `/{tipo}-venda-{cidade}-sp.html`, paginação `-pagina-N`. | Cidade lida do card; coords por centroide do município (exatas só na promoção). |

**Como buscar o rural:** o filtro de **área** (5k–50k m²) seleciona sozinho os
imóveis rurais — nenhum apartamento tem 5.000+ m². Busca-se "todos os tipos" por
município (priorizando regiões rurais: Sorocaba/Ibiúna, Itapetininga, Vale do
Ribeira, Mantiqueira, Circuito das Águas) e os filtros duros finalizam.

Geocodificação: 99 municípios num raio de ~300 km de SP (`src/data/municipios.mjs`),
usados como fallback quando o anúncio não traz coordenadas, e como sementes de
busca por município.

## 9. Normalização texto→enum

`src/data/normalize-dict.mjs` traz dicionários ordenados (mais específico
primeiro) que mapeiam texto livre pt-BR (com acentos removidos) para os enums do
app: água, energia, internet, acesso, saneamento, topografia, documentação, tipo;
+ `AGUA_NATURAL`, `BENFEITORIAS` (→ `moduloId`), `APP_RESERVA`. Campos que o
anúncio não fornece ficam anotados em `observacoes` para due-diligence na visita.

## 10. Modelos por tarefa

- **Haiku** — extração de alto volume (parsing de cards/JSON) — feito por código,
  determinístico.
- **Sonnet** — geração dos dicionários e da tabela de municípios (feito por
  subagents nesta sessão).
- **Opus** — arquitetura, dedup, orquestração.

## 11. Fase 2 (app)

- Endpoints `/api/leads` (GET/PUT/promover) no `server/index.mjs`.
- Aba **"Prospecção"** no app: navegar/filtrar/favoritar leads, ver amostra de
  fotos, e **promover** lead → `terreno` (mapeia via `leadToTerreno`, espelha a
  galeria completa para o Blob `uploads`).

## 12. Legal / ToS

Uso pessoal, baixa frequência, ritmo educado. Os portais têm ToS que restringem
coleta automatizada; a coleta é para pesquisa própria do grupo, não republica
dados nem os revende. Rodar com parcimônia.
