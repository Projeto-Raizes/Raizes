// Haversine + distância ao centro de São Paulo (km).
import { SP_CENTRO } from '../config.mjs';

const R = 6371; // raio da Terra (km)
const rad = (d) => (d * Math.PI) / 180;

export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 10) / 10;
}

export const distanciaSpKm = (lat, lng) => haversineKm(SP_CENTRO, { lat, lng });
