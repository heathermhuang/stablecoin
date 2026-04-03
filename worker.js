/**
 * Cloudflare Worker for stablecoin.io
 * Serves index.html and proxies DeFi Llama + CoinGecko APIs.
 * Uses Cloudflare Cache API for stale-while-revalidate.
 */

const LLAMA_BASE = 'https://stablecoins.llama.fi';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Endpoint allowlists — prevents open-proxy abuse of third-party API quotas.
const LLAMA_ALLOWED     = ['/stablecoins'];
const COINGECKO_ALLOWED = ['/coins/markets'];

function isAllowed(allowlist, subpath) {
  return allowlist.some(p => subpath === p || subpath.startsWith(p + '?') || subpath.startsWith(p + '/'));
}

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

const SC_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0d0f14"/><circle cx="16" cy="16" r="11" fill="none" stroke="#22c55e" stroke-width="2"/><text x="16" y="21.5" text-anchor="middle" font-size="14" font-weight="900" fill="#22c55e" font-family="Arial,Helvetica,sans-serif">$</text></svg>`;

const SC_SHARED_CSS = `<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#07080c;color:#e4e6ef;font-family:'DM Sans',sans-serif;min-height:100vh;line-height:1.7}.topnav{position:sticky;top:0;z-index:200;background:rgba(7,8,12,0.92);backdrop-filter:blur(16px);border-bottom:1px solid #1c1f2b}.topnav-inner{max-width:900px;margin:0 auto;padding:0 24px;height:54px;display:flex;align-items:center;gap:0}.tnav-brand{display:flex;align-items:center;gap:9px;text-decoration:none;color:#e4e6ef}.tnav-logo{width:30px;height:30px;background:#191c25;border:1px solid #252938;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px;color:#22c55e;font-family:'IBM Plex Mono',monospace;font-weight:800}.tnav-name{font-size:13px;font-weight:700;color:#9498ad}.tnav-back{margin-left:auto;font-size:12px;font-family:'IBM Plex Mono',monospace;color:#3b82f6;text-decoration:none;padding:6px 14px;border:1px solid rgba(59,130,246,0.2);border-radius:6px;background:rgba(59,130,246,0.05)}.tnav-back:hover{background:rgba(59,130,246,0.1)}.legal-wrap{max-width:760px;margin:0 auto;padding:48px 24px 80px}.legal-wrap h1{font-size:28px;font-weight:800;letter-spacing:-0.5px;margin-bottom:6px}.legal-wrap .updated{font-size:12px;color:#5d6178;font-family:'IBM Plex Mono',monospace;margin-bottom:40px}.legal-wrap h2{font-size:16px;font-weight:700;color:#e4e6ef;margin:32px 0 10px;padding-bottom:8px;border-bottom:1px solid #1c1f2b}.legal-wrap p{font-size:14px;color:#9498ad;margin-bottom:12px}.legal-wrap ul{margin:8px 0 14px 20px}.legal-wrap li{font-size:14px;color:#9498ad;margin-bottom:6px}.legal-wrap a{color:#3b82f6}.disclaimer-box{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:16px 20px;margin:24px 0}.disclaimer-box p{color:#fca5a5;margin:0;font-size:13px;font-weight:500}.footer{text-align:center;padding:32px 0;border-top:1px solid #1c1f2b;font-size:12px;color:#5d6178;font-family:'IBM Plex Mono',monospace}.footer a{color:#3b82f6;text-decoration:none}</style>`;

const SC_TERMS_HTML = `<!DOCTYPE html><html lang="en"><head><title>Terms of Use · stablecoin.io</title>${SC_SHARED_CSS}</head><body><nav class="topnav"><div class="topnav-inner"><a class="tnav-brand" href="/"><div class="tnav-logo">$</div><span class="tnav-name">stablecoin.io</span></a><a class="tnav-back" href="/">&#8592; Back to Monitor</a></div></nav><div class="legal-wrap"><h1>Terms of Use</h1><div class="updated">Last updated: March 2026</div><div class="disclaimer-box"><p>&#9888;&#65039; IMPORTANT: This site does not provide financial advice. Stablecoin peg data is for informational purposes only. Stablecoins can and do lose their peg.</p></div><h2>1. Acceptance</h2><p>By accessing stablecoin.io you agree to these Terms. If you disagree, please do not use the service.</p><h2>2. What We Do</h2><p>stablecoin.io displays publicly available stablecoin market data from DeFi Llama, CoinGecko, and other sources. We show peg deviations, risk scores, market caps, and mechanism analysis. This is a data aggregation and display service only.</p><h2>3. No Financial Advice</h2><p>Nothing on this site constitutes financial advice, investment advice, or any other form of professional advice. Risk scores and peg health indicators are algorithmic calculations &mdash; they are not guarantees or recommendations.</p><p>Stablecoins are not risk-free. Historical peg stability does not guarantee future stability. You could lose money in stablecoin positions.</p><h2>4. Data Accuracy</h2><p>Data is sourced from third-party APIs (DeFi Llama, CoinGecko). We make no representations about the accuracy, completeness, or timeliness of any data. Peg deviation data may be delayed or incorrect.</p><h2>5. Eligibility</h2><p>You must be at least 18 years old to use this service.</p><h2>6. Prohibited Uses</h2><p>You may not: scrape data for commercial resale, interfere with the service, violate applicable law, or misrepresent data from this site as original research.</p><h2>7. Disclaimer of Warranties</h2><p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED.</p><h2>8. Limitation of Liability</h2><p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.</p><h2>9. Changes</h2><p>We may modify these Terms at any time. Continued use constitutes acceptance.</p><h2>10. Contact</h2><p>Questions? See our <a href="/privacy">Privacy Policy</a>. stablecoin.io is part of the <a href="https://shitcoin.io">Crypto Monitor</a> network.</p></div><div class="footer"><a href="/">stablecoin.io</a> &nbsp;&middot;&nbsp; <a href="/terms">Terms</a> &nbsp;&middot;&nbsp; <a href="/privacy">Privacy</a> &nbsp;&middot;&nbsp; <a href="https://shitcoin.io">shitcoin.io</a></div></body></html>`;

const SC_PRIVACY_HTML = `<!DOCTYPE html><html lang="en"><head><title>Privacy Policy · stablecoin.io</title>${SC_SHARED_CSS}</head><body><nav class="topnav"><div class="topnav-inner"><a class="tnav-brand" href="/"><div class="tnav-logo">$</div><span class="tnav-name">stablecoin.io</span></a><a class="tnav-back" href="/">&#8592; Back to Monitor</a></div></nav><div class="legal-wrap"><h1>Privacy Policy</h1><div class="updated">Last updated: March 2026</div><p>stablecoin.io is committed to your privacy. This policy explains what data we collect, how we use it, and your rights.</p><h2>1. Data We Collect</h2><p><strong>Analytics (with consent only):</strong> If you accept cookies, Google Analytics collects anonymized data including pages visited, session duration, general geographic region, browser type, and device type. No personally identifiable information is collected.</p><p><strong>Local storage:</strong> We store your cookie consent preference and UI state (sort order, active filter) in your browser's localStorage. This data never leaves your device.</p><p><strong>No accounts:</strong> We do not require registration. We do not collect names, emails, or payment information.</p><h2>2. Cookies</h2><p>Cookies are only used with your consent. If accepted, Google Analytics sets:</p><ul><li><strong>_ga</strong> &mdash; Distinguishes users (2 year expiry)</li><li><strong>_ga_*</strong> &mdash; Session state (2 year expiry)</li></ul><p>Withdraw consent anytime by clearing browser cookies and localStorage.</p><h2>3. How We Use Data</h2><p>Analytics data is used solely to understand aggregate traffic patterns. We do not sell, share, or use data for advertising.</p><h2>4. Third-Party Services</h2><ul><li><strong>DeFi Llama</strong> (stablecoins.llama.fi) &mdash; Stablecoin data</li><li><strong>CoinGecko</strong> (api.coingecko.com) &mdash; Price and market cap data</li><li><strong>Google Analytics</strong> (googletagmanager.com) &mdash; Analytics, consent-gated</li><li><strong>Google Fonts</strong> (fonts.googleapis.com) &mdash; Typography</li><li><strong>DeFi Llama Icons</strong> (icons.llamao.fi) &mdash; Chain logos</li><li><strong>CoinGecko Images</strong> (coin-images.coingecko.com) &mdash; Coin icons</li></ul><p>API calls to DeFi Llama and CoinGecko are proxied through our Cloudflare Worker.</p><h2>5. Data Retention</h2><p>Google Analytics data is retained for 14 months. Local storage data remains until cleared. We have no server-side database.</p><h2>6. Your Rights (GDPR)</h2><p>EEA residents have the right to: access data we hold, request deletion, withdraw consent, and lodge a complaint with their local DPA.</p><h2>7. Children</h2><p>This service is not intended for users under 18.</p><h2>8. Changes</h2><p>We may update this policy. Continued use after changes constitutes acceptance.</p><h2>9. Contact</h2><p>For privacy questions, use the site footer links. We aim to respond within 30 days. stablecoin.io is part of the <a href="https://shitcoin.io">Crypto Monitor</a> network.</p></div><div class="footer"><a href="/">stablecoin.io</a> &nbsp;&middot;&nbsp; <a href="/terms">Terms</a> &nbsp;&middot;&nbsp; <a href="/privacy">Privacy</a> &nbsp;&middot;&nbsp; <a href="https://shitcoin.io">shitcoin.io</a></div></body></html>`;

const SC_OG_IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#020408"/><defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0a1a0e"/><stop offset="100%" stop-color="#020408"/></linearGradient></defs><rect width="1200" height="630" fill="url(#grad)"/><rect x="60" y="60" width="1080" height="510" rx="16" fill="#080c14" stroke="#1a2540" stroke-width="1.5"/><circle cx="110" cy="135" r="20" fill="none" stroke="#22c55e" stroke-width="2.5"/><text x="110" y="141" text-anchor="middle" font-family="monospace" font-weight="900" font-size="18" fill="#22c55e">$</text><text x="145" y="147" font-family="monospace" font-weight="800" font-size="26" fill="#22c55e">stablecoin.io</text><text x="90" y="230" font-family="monospace" font-weight="700" font-size="52" fill="#e4e6ef">Stablecoin</text><text x="90" y="295" font-family="monospace" font-weight="700" font-size="52" fill="#e4e6ef">Monitor</text><text x="90" y="365" font-family="sans-serif" font-size="26" fill="#5d6178">Peg health &amp; risk scores for 50+ stablecoins</text><rect x="90" y="415" width="160" height="44" rx="8" fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.3)" stroke-width="1"/><text x="170" y="443" font-family="monospace" font-size="15" fill="#22c55e" text-anchor="middle">PEG HEALTH</text><rect x="270" y="415" width="160" height="44" rx="8" fill="rgba(234,179,8,0.12)" stroke="rgba(234,179,8,0.3)" stroke-width="1"/><text x="350" y="443" font-family="monospace" font-size="15" fill="#eab308" text-anchor="middle">RISK SCORES</text><rect x="450" y="415" width="160" height="44" rx="8" fill="rgba(59,130,246,0.12)" stroke="rgba(59,130,246,0.3)" stroke-width="1"/><text x="530" y="443" font-family="monospace" font-size="15" fill="#3b82f6" text-anchor="middle">MARKET CAPS</text></svg>`;

const HTML = `__HTML_PLACEHOLDER__`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } });
    }

    // Favicon
    if (path === '/favicon.svg' || path === '/favicon.ico') {
      return new Response(SC_FAVICON_SVG, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
    }

    // SEO: robots.txt
    if (path === '/robots.txt') {
      return new Response(
        'User-agent: *\nAllow: /\nDisallow: /llama/\nDisallow: /cg/\nSitemap: https://stablecoin.io/sitemap.xml\n',
        { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } }
      );
    }

    // SEO: sitemap.xml
    if (path === '/sitemap.xml') {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://stablecoin.io/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url><url><loc>https://stablecoin.io/terms</loc><changefreq>monthly</changefreq><priority>0.2</priority></url><url><loc>https://stablecoin.io/privacy</loc><changefreq>monthly</changefreq><priority>0.2</priority></url></urlset>`,
        { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } }
      );
    }

    // SEO: OG image
    if (path === '/og-image.png' || path === '/og-image.svg') {
      return new Response(SC_OG_IMAGE_SVG, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
    }

    // Legal pages
    if (path === '/terms') {
      return new Response(SC_TERMS_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
    }
    if (path === '/privacy') {
      return new Response(SC_PRIVACY_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
    }

    if (path === '/' || path === '/index.html') {
      return new Response(HTML, { headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=60',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      }});
    }

    // Proxy DeFi Llama stablecoins API (allowlisted endpoints only)
    if (path.startsWith('/llama/')) {
      const sub = path.slice(6).split('?')[0];
      if (!isAllowed(LLAMA_ALLOWED, sub)) {
        return new Response('{"error":"not allowed"}', { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      const upstream = LLAMA_BASE + path.slice(6) + url.search;
      return cachedProxy(request, upstream, getTTL(path));
    }

    // Proxy CoinGecko (allowlisted endpoints only)
    if (path.startsWith('/cg/')) {
      const sub = path.slice(3).split('?')[0];
      if (!isAllowed(COINGECKO_ALLOWED, sub)) {
        return new Response('{"error":"not allowed"}', { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      const upstream = COINGECKO_BASE + path.slice(3) + url.search;
      return cachedProxy(request, upstream, getTTL(path));
    }

    return new Response('Not Found', { status: 404 });
  }
};
