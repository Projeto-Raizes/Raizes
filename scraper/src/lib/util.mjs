// ─────────────────────────────────────────────────────────────────
// Utilitários compartilhados: normalização de texto, parsing de números
// pt-BR (preço/área com ha/alqueire), hashing, sleep/jitter, slug.
// ─────────────────────────────────────────────────────────────────
import crypto from 'node:crypto';

/** minúsculas + remove acentos (para casar com dicionários ASCII). */
export function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const slug = (s) =>
  norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** parse de número pt-BR: "R$ 1.350.000,00" → 1350000 ; "56,25" → 56.25 */
export function parseNumeroBr(txt) {
  if (txt == null) return null;
  if (typeof txt === 'number') return Number.isFinite(txt) ? txt : null;
  const m = String(txt).match(/-?[\d.]*\d(?:,\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export const parsePrecoBrl = (txt) => parseNumeroBr(txt);

/**
 * parse de área → m². Detecta unidade: hectare (ha), alqueire paulista
 * (24.200 m²), metros. Sem unidade → assume m².
 * "24.200 m²" → 24200 ; "2,4 ha" → 24000 ; "1 alqueire" → 24200
 */
export function parseAreaM2(txt) {
  if (txt == null) return null;
  if (typeof txt === 'number') return Number.isFinite(txt) ? txt : null;
  const t = norm(txt);
  const val = parseNumeroBr(t);
  if (val == null) return null;
  if (/\balq(ueir)?/.test(t)) return Math.round(val * 24200);      // alqueire paulista
  if (/\bha\b|hectare/.test(t)) return Math.round(val * 10000);
  return Math.round(val);                                          // m² (default)
}

/** hash curto e estável de um conjunto de campos (detecção de mudança). */
export function contentHash(...parts) {
  return crypto.createHash('sha1').update(parts.map((p) => String(p ?? '')).join('|')).digest('hex').slice(0, 12);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** atraso "humano" entre min e max (ms). */
export function jitter(min, max) {
  return sleep(min + Math.floor(Math.random() * Math.max(0, max - min)));
}

/** deduplica array mantendo ordem. */
export const uniq = (arr) => [...new Set(arr)];

/** clamp numérico. */
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
