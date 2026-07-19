export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. MAIN SITE: Let it pass through
  if (url.hostname !== "auth.quantal-labs.com") {
    return await context.next();
  }

  // 2. API ROUTES: Handle Proxy & Failover
  if (url.pathname.startsWith("/api/")) {
    return await handleEdgeAuth(context);
  }

  // 3. STATIC ASSETS: Force lookups into the /auth/ folder
  // We construct the path carefully to match your GitHub folder structure
  let assetPath = url.pathname;
  if (assetPath === "/" || assetPath === "") assetPath = "/auth/index.html";
  else if (assetPath.startsWith("/login")) assetPath = "/auth/login/index.html";
  else if (assetPath.startsWith("/signup")) assetPath = "/auth/signup/index.html";
  else assetPath = `/auth${assetPath}`;

  // Fetch the asset from your repository
  const assetRequest = new Request(new URL(assetPath, request.url), request);
  const response = await env.ASSETS.fetch(assetRequest);
  
  // If the file isn't found (404), return a simple message
  return response.status === 404 ? new Response("Page not found", { status: 404 }) : response;
}

async function handleEdgeAuth(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cors = { 'Access-Control-Allow-Origin': 'https://quantal-labs.com', 'Content-Type': 'application/json' };

  // Try to reach your Mac Server
  try {
    const macResponse = await fetch("https://authentication.quantal-labs.com" + url.pathname, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' ? await request.clone().text() : null
    });
    // If Mac is up, return its response
    if (macResponse.status < 500) return macResponse;
    throw new Error("Mac Down");
  } catch (e) {
    // FAILOVER: Mac is down, use D1
    if (url.pathname === "/api/login" && request.method === "POST") {
      const { username, password } = await request.json();
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)))]
        .map(b => b.toString(16).padStart(2, '0')).join('');

      const user = await env.DB.prepare("SELECT * FROM Users WHERE username = ?").bind(username.toLowerCase()).first();
      if (user && user.passwordHash === hash) {
        return new Response(JSON.stringify({ success: true, source: "Edge" }), { headers: cors });
      }
      return new Response(JSON.stringify({ error: "Invalid" }), { status: 401, headers: cors });
    }
    return new Response(JSON.stringify({ error: "Service Unavailable" }), { status: 503, headers: cors });
  }
}
