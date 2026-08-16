const HASHED_ASSET = /\/assets\/[^/]+\.[a-f0-9]{12}\.(?:js|css)$/i;
const NO_CACHE = new Set(['/', '/index.html', '/build-manifest.json', '/asset-manifest.json']);

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (!response.ok) return response;
    const url = new URL(request.url);
    const headers = new Headers(response.headers);
    if (HASHED_ASSET.test(url.pathname)) headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    else if (NO_CACHE.has(url.pathname)) headers.set('Cache-Control', 'no-cache');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
