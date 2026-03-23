/**
 * Cloudflare Worker for stablecoin.io
 * Serves index.html and proxies DeFi Llama + CoinGecko APIs.
 * Uses Cloudflare Cache API for stale-while-revalidate.
 */

const LLAMA_BASE = 'https://stablecoins.llama.fi';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const TTL_MAP = [
  ['/stablecoins', 180],
  ['/cg/', 300],
];

function getTTL(path) {
  for (const [k, v] of TTL_MAP) if (path.includes(k)) return v;
  return 180;
}

async function cachedProxy(request, upstream, ttl) {
  const cache = caches.default;
  const isCG = upstream.includes('coingecko.com');
  const storageTtl = isCG ? 86400 : ttl * 10;
  const cacheKey = new Request(upstream, { headers: { 'Cache-Control': 'no-transform' } });

  const cached = await cache.match(cacheKey);
  if (cached) {
    const age = Date.now()/1000 - new Date(cached.headers.get('X-Cached-At') || 0).getTime()/1000;
    if (age > ttl) {
      fetch(upstream, { headers: { 'User-Agent': 'StablecoinMonitor/1.0' } })
        .then(r => r.ok ? r.blob().then(b => {
          const fresh = new Response(b, { headers: {
            'Content-Type': r.headers.get('Content-Type') || 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Cached-At': new Date().toUTCString(),
            'Cache-Control': `public, max-age=${storageTtl}`,
          }});
          cache.put(cacheKey, fresh.clone());
        }) : null)
        .catch(() => null);
    }
    const headers = new Headers(cached.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(cached.body, { status: 200, headers });
  }

  try {
    const resp = await fetch(upstream, {
      headers: { 'User-Agent': 'StablecoinMonitor/1.0' },
      cf: { cacheTtl: ttl, cacheEverything: true },
    });
    if (!resp.ok) {
      if (isCG) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      return new Response('{"error":"upstream"}', { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    const body = await resp.blob();
    const response = new Response(body, { headers: {
      'Content-Type': resp.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-Cached-At': new Date().toUTCString(),
      'Cache-Control': `public, max-age=${storageTtl}`,
    }});
    cache.put(cacheKey, response.clone());
    return response;
  } catch(e) {
    if (isCG) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    return new Response('{"error":"fetch failed"}', { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
}

const HTML = `__HTML_PLACEHOLDER__`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } });
    }

    if (path === '/' || path === '/index.html') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=60' } });
    }

    // Proxy DeFi Llama stablecoins API
    if (path.startsWith('/llama/')) {
      const upstream = LLAMA_BASE + path.slice(6) + url.search;
      return cachedProxy(request, upstream, getTTL(path));
    }

    // Proxy CoinGecko
    if (path.startsWith('/cg/')) {
      const upstream = COINGECKO_BASE + path.slice(3) + url.search;
      return cachedProxy(request, upstream, getTTL(path));
    }

    return new Response('Not Found', { status: 404 });
  }
};
