// ─────────────────────────────────────────────────────────────────
// Harness do Playwright: browser com contexto pt-BR (geo correto, evita
// bloqueio DataDome/Cloudflare), atraso "humano", captura de JSON de rede
// e fetch dentro do contexto da página (reaproveita cookies anti-bot).
// ─────────────────────────────────────────────────────────────────
import { chromium } from 'playwright';
import { COLETA } from '../config.mjs';
import { jitter } from './util.mjs';

/** Lança Chrome do sistema (channel:'chrome'); cai para o Chromium do
 *  Playwright se o Chrome não estiver instalado. */
export async function launchBrowser({ headless = COLETA.headless } = {}) {
  let browser;
  try {
    browser = await chromium.launch({ headless, channel: 'chrome' });
  } catch {
    browser = await chromium.launch({ headless });
  }
  const context = await browser.newContext({
    locale: COLETA.locale,
    timezoneId: COLETA.timezone,
    userAgent: COLETA.userAgent,
    viewport: COLETA.viewport,
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
  });
  // pequenas medidas anti-fingerprint
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en'] });
  });
  context.setDefaultTimeout(45_000);
  context.setDefaultNavigationTimeout(60_000);
  return { browser, context };
}

/** atraso educado entre requisições. */
export const polite = () => jitter(COLETA.minDelayMs, COLETA.maxDelayMs);

/**
 * Coletor de respostas JSON: registra na page um listener que guarda toda
 * resposta cujo URL casa com `urlTest`. Use antes de navegar; chame stop()
 * depois. hits = [{ url, status, body }].
 */
export function jsonCollector(page, urlTest) {
  const hits = [];
  const handler = async (resp) => {
    try {
      if (!urlTest(resp.url())) return;
      const ct = resp.headers()['content-type'] || '';
      if (!/json/i.test(ct)) return;
      hits.push({ url: resp.url(), status: resp.status(), body: await resp.json().catch(() => null) });
    } catch { /* resposta já descartada */ }
  };
  page.on('response', handler);
  return { hits, stop: () => page.off('response', handler) };
}

/**
 * Executa fetch DENTRO da página (mesmo origin/cookies do contexto real →
 * atravessa Cloudflare/DataDome). Retorna { status, json, text }.
 */
export async function fetchInPage(page, url, init = {}) {
  return page.evaluate(async ({ url, init }) => {
    try {
      const r = await fetch(url, init);
      const t = await r.text();
      let json = null;
      try { json = JSON.parse(t); } catch { /* não é json */ }
      return { status: r.status, json, text: json ? null : t.slice(0, 4000) };
    } catch (e) {
      return { status: 0, json: null, text: String(e) };
    }
  }, { url, init });
}

/** baixa uma URL usando o contexto (cookies) → Buffer, ou null. */
export async function downloadBuffer(context, url) {
  try {
    const resp = await context.request.get(url, { timeout: 30_000 });
    if (!resp.ok()) return null;
    return await resp.body();
  } catch {
    return null;
  }
}
