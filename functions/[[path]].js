export async function onRequest(context) {
  const { request, env } = context;
  // Change this to your exact home server's cloudflare tunnel backend URL
  const localTunnelBackend = "https://authentication.quantal-labs.com";
  const url = new URL(request.url);

  try {
    // 1. Forward the traffic to your home computer first
    const targetUrl = localTunnelBackend + url.pathname + url.search;
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().text() : null,
      redirect: 'manual'
    });

    // If your local machine throws an error code (Tunnel Down, Timeout, Server Crash)
    if (response.status === 502 || response.status === 504 || response.status === 522 || response.status === 523) {
      return await handleEdgeAuthFallback(request, env, url, context);
    }

    return response;

  } catch (error) {
    // 2. If your computer is turned off completely, catch block executes the edge backup
    return await handleEdgeAuthFallback(request, env, url, context);
  }
}

// 3. Cloudflare Edge Fallback Engine
async function handleEdgeAuthFallback(request, env, url, context) {
  
  // A. STATIC FILES: Serve the standard public HTML files natively from your Pages project
  if (!url.pathname.startsWith("/api/")) {
    return await context.next(); 
  }

  // B. LOGIN ROUTE BACKUP: Process verification directly on Cloudflare using D1 SQL
  if (url.pathname === "/api/login" && request.method === "POST") {
    try {
      const { username, password } = await request.json();
      const { results } = await env.DB.prepare(
        "SELECT * FROM users WHERE username = ? LIMIT 1"
      ).bind(username).all();

      if (results && results.length > 0) {
        const user = results[0];
        // Match your password verification format here
        if (password === user.password_hash) {
          return new Response(JSON.stringify({ 
            success: true, 
            source: "Cloudflare Edge Engine (Backup Mode)",
            user: { username: user.username } 
          }), { headers: { "Content-Type": "application/json" } });
        }
      }
      return new Response(JSON.stringify({ success: false, error: "Invalid credentials" }), { status: 401 });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Edge DB Failover Error" }), { status: 500 });
    }
  }

  // C. SIGNUP ROUTE BACKUP: Push new user registrations straight to the cloud D1 database
  if (url.pathname === "/api/signup" && request.method === "POST") {
    try {
      const { username, email, password } = await request.json();
      await env.DB.prepare(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
      ).bind(username, email, password).run();

      return new Response(JSON.stringify({ success: true, message: "Registered on Cloudflare Edge!" }), { status: 201 });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: "Username or Email already exists" }), { status: 400 });
    }
  }

  return new Response("Quantal Labs Backup Node: Resource Not Found", { status: 404 });
}
