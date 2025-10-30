// Vercel Serverless Function: admin proxy
// Proxies /admin-api/* to your external Admin Backend (Express) defined by ADMIN_BACKEND_URL
// Example: GET /admin-api/system/ai-health -> ${ADMIN_BACKEND_URL}/api/system/ai-health

export const config = {
  runtime: 'edge', // faster cold starts; supports fetch streaming
};

function joinURL(base, path) {
  const b = base.replace(/\/$/, '');
  const p = ('/' + path.join('/')).replace(/\/+/g, '/');
  return `${b}/api/${p.replace(/^\//, '')}`;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const backend = process.env.ADMIN_BACKEND_URL || process.env.VITE_API_URL;
  if (!backend) {
    return new Response(
      JSON.stringify({ ok: false, error: 'ADMIN_BACKEND_URL not configured' }),
      { status: 500, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
    );
  }

  const pathParam = url.pathname.split('/').slice(3); // /api/admin-proxy/[...]
  const target = new URL(joinURL(backend, pathParam));
  target.search = url.search;

  const headers = new Headers(req.headers);
  headers.delete('host');
  // Ensure no caching on proxy
  headers.set('x-forwarded-by', 'vercel-admin-proxy');

  const init = {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    redirect: 'manual',
  };

  const upstream = await fetch(target, init);

  // Pass-through SSE and other streaming responses
  const resHeaders = new Headers(upstream.headers);
  resHeaders.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}
