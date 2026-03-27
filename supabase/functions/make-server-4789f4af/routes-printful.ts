/**
 * Printful API routes — fetches product catalog for the Secret Shop merch section.
 *
 * Public endpoint (no auth required) — this is storefront data.
 * Caches products in memory for 10 minutes to avoid hitting Printful rate limits.
 */

import { PREFIX } from "./helpers.ts";

const PRINTFUL_BASE = 'https://api.printful.com';

// ── In-memory cache ──
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_VERSION = 1;
let cachedProducts: SimplifiedProduct[] | null = null;
let cacheTimestamp = 0;
let cachedVersion = 0;
let cachedStoreId: number | null = null;

interface SimplifiedProduct {
  id: number;
  name: string;
  thumbnail_url: string;
  variants: {
    id: number;
    name: string;
    retail_price: string;
    preview_url: string | null;
  }[];
  retail_price_range: { min: string; max: string };
}

// ── Products to hide from the storefront ──
// Add lowercase substrings here to temporarily exclude products (e.g. while remaking them).
// Remove entries once the new products are ready.
const HIDDEN_PRODUCT_KEYWORDS: string[] = [];

async function resolveStoreId(apiKey: string): Promise<number> {
  if (cachedStoreId) return cachedStoreId;

  const res = await fetch(`${PRINTFUL_BASE}/stores`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Printful /stores fetch failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const stores = data.result || [];
  if (stores.length === 0) {
    throw new Error('No Printful stores found for this API key');
  }

  // Log all available stores for debugging
  console.log(`Printful stores found (${stores.length}):`);
  for (const s of stores) {
    console.log(`  - id: ${s.id}, name: "${s.name}", type: ${s.type || 'unknown'}, created: ${s.created}`);
  }

  // Prefer a real connected store over the default "Personal orders" store
  const realStore = stores.find((s: any) =>
    s.name && !s.name.toLowerCase().includes('personal order')
  );
  const selectedStore = realStore || stores[0];

  cachedStoreId = selectedStore.id;
  console.log(`Selected Printful store_id: ${cachedStoreId} ("${selectedStore.name}")${realStore ? '' : ' [WARNING: using fallback — no connected store found]'}`);
  return cachedStoreId!;
}

async function fetchPrintfulProducts(apiKey: string): Promise<SimplifiedProduct[]> {
  const storeId = await resolveStoreId(apiKey);

  // Step 1: Get all sync products
  const productsRes = await fetch(`${PRINTFUL_BASE}/store/products?store_id=${storeId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!productsRes.ok) {
    const errText = await productsRes.text();
    throw new Error(`Printful products fetch failed (${productsRes.status}): ${errText}`);
  }
  const productsData = await productsRes.json();
  const products = productsData.result || [];

  console.log(`Printful store ${storeId}: ${products.length} sync product(s) found`);
  if (products.length === 0) return [];

  // Step 2: For each product, fetch full details (includes variants + preview images)
  const detailed: SimplifiedProduct[] = [];

  for (const p of products) {
    // Filter out hidden products
    const nameLower = (p.name || '').toLowerCase();
    if (HIDDEN_PRODUCT_KEYWORDS.some((kw) => nameLower.includes(kw))) continue;

    try {
      const detailRes = await fetch(`${PRINTFUL_BASE}/store/products/${p.id}?store_id=${storeId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!detailRes.ok) {
        console.log(`Skipping product ${p.id} — detail fetch failed (${detailRes.status})`);
        continue;
      }
      const detailData = await detailRes.json();
      const syncProduct = detailData.result?.sync_product;
      const syncVariants = detailData.result?.sync_variants || [];

      const variants = syncVariants.map((v: any) => ({
        id: v.id,
        name: v.name,
        retail_price: v.retail_price || '0.00',
        preview_url: v.files?.find((f: any) => f.type === 'preview')?.preview_url || null,
      }));

      // Compute price range
      const prices = variants
        .map((v: any) => parseFloat(v.retail_price))
        .filter((p: number) => p > 0);
      const minPrice = prices.length > 0 ? Math.min(...prices).toFixed(2) : '0.00';
      const maxPrice = prices.length > 0 ? Math.max(...prices).toFixed(2) : '0.00';

      detailed.push({
        id: syncProduct?.id || p.id,
        name: syncProduct?.name || p.name,
        thumbnail_url: syncProduct?.thumbnail_url || p.thumbnail_url || '',
        variants,
        retail_price_range: { min: minPrice, max: maxPrice },
      });
    } catch (err) {
      console.log(`Skipping product ${p.id} — error: ${err}`);
    }
  }

  return detailed;
}

export function registerPrintfulRoutes(
  app: any,
  _supabase: any,
  _anonSupabase: any,
) {
  // GET /printful/products — public, cached
  app.get(`${PREFIX}/printful/products`, async (c: any) => {
    try {
      const apiKey = Deno.env.get('PRINTFUL_API_KEY');
      if (!apiKey) {
        return c.json({ error: 'PRINTFUL_API_KEY not configured on server' }, 500);
      }

      const now = Date.now();
      if (cachedProducts && cachedVersion === CACHE_VERSION && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return c.json({ products: cachedProducts, cached: true });
      }

      const products = await fetchPrintfulProducts(apiKey);
      cachedProducts = products;
      cacheTimestamp = now;
      cachedVersion = CACHE_VERSION;

      return c.json({ products, cached: false });
    } catch (error: any) {
      console.log(`Printful products fetch error: ${error.message}`);
      return c.json({ error: `Failed to fetch Printful products: ${error.message}` }, 500);
    }
  });
}