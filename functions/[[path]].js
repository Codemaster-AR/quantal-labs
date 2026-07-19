// Lightweight hashing for Edge
async function hashPasswordEdge(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // A. ROUTE: API Calls (Always handle these via the Edge/D1)
  if (url.pathname.startsWith("/api/")) {
    return await handleEdgeAuthFallback(request, env, url, context);
  }

  // B. ROUTE: Static Pages (Serve from /auth/ folder)
  let targetAssetPath = url.pathname;
  if (url.pathname === "/" || url.pathname === "") targetAssetPath = "/auth/index.html";
  else if (url.pathname.startsWith("/login")) targetAssetPath = "/auth/login/index.html";
  else if (url.pathname.startsWith("/signup")) targetAssetPath = "/auth/signup/index.html";
  else targetAssetPath = `/auth${url.pathname}`;

  return await env.ASSETS.fetch(new Request(new URL(targetAssetPath, request.url), request));
}

async function handleEdgeAuthFallback(request, env, url, context) {
  const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  // SIGNUP API
  if (url.pathname === "/api/signup" && request.method === "POST") {
    const { username, email, password } = await request.json();
    const edgeHash = await hashPasswordEdge(password);
    
    try {
      await env.DB.prepare("INSERT INTO Users (username, email, passwordHash) VALUES (?, ?, ?)")
        .bind(username.toLowerCase(), email.toLowerCase(), edgeHash).run();
      return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: "User exists" }), { status: 400, headers: corsHeaders });
    }
  }

  // LOGIN API
  if (url.pathname === "/api/login" && request.method === "POST") {
    const { username, password } = await request.json();
    const user = await env.DB.prepare("SELECT * FROM Users WHERE username = ?").bind(username.toLowerCase()).first();
    
    if (user && user.passwordHash === await hashPasswordEdge(password)) {
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
    return new Response(JSON.stringify({ error: "Invalid" }), { status: 401, headers: corsHeaders });
  }

  return new Response("Not Found", { status: 404 });
}
