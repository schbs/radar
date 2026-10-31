// Costo por pedido, en USD, con la tabla de Google Maps Platform (developers.google.com/maps/billing-and-pricing/pricing
// y .../places/web-service/data-fields, consultadas el 31/10/2026):
// - Text Search Essentials (IDs Only): sin cargo y sin tope.
// - Place Details Enterprise (websiteUri, rating y userRatingCount lo exigen): USD 20 cada 1.000, con 1.000 gratis
//   por mes. El costo que se muestra es el de lista, sin descontar ese cupo gratis.
// - PageSpeed Insights: sin cargo (cupo diario con clave).
export const PRECIO = {
  textSearchIds: 0,
  detalleLugar: 0.02,
  pagespeed: 0,
  sitio: 0,
} as const;

export const DIA_MS = 24 * 60 * 60 * 1000;
