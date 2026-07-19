export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const MAC_SERVER = "https://authentication.quantal-labs.com"; // Your Tunnel URL

    // 1. ROUTING: Only intercept /api/ routes
    if (url.pathname.startsWith("/api/")) {
        try {
            // Attempt to proxy to your Mac Server
            const response = await fetch(`${MAC_SERVER}${url.pathname}`, {
                method: request.method,
                headers: request.headers,
                body: request.method !== 'GET' ? await request.clone().text() : null
            });

            // If Mac is down, trigger failover
            if (response.status >= 500) throw new Error("Mac Down");
            return response;
        } catch (e) {
            // FAILOVER: Mac is offline, handle via D1
            return await handleEdgeAuthFallback(context);
        }
    }

    // 2. STATIC ASSETS: Serve from /auth/ folder
    return await context.next();
}

async function handleEdgeAuthFallback(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

    // SIGNUP FALLBACK
    if (url.pathname === "/api/signup" && request.method === "POST") {
        const { username, email, password } = await request.json();
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
        const hashHex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
        
        try {
            await env.DB.prepare("INSERT INTO Users (username, email, passwordHash) VALUES (?, ?, ?)")
                .bind(username.toLowerCase(), email.toLowerCase(), hashHex).run();
            return new Response(JSON.stringify({ message: "Registered via Edge" }), { status: 201, headers: cors });
        } catch (e) {
            return new Response(JSON.stringify({ error: "User exists" }), { status: 400, headers: cors });
        }
    }

    // LOGIN FALLBACK
    if (url.pathname === "/api/login" && request.method === "POST") {
        const { username, password } = await request.json();
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
        const hashHex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');

        const user = await env.DB.prepare("SELECT * FROM Users WHERE username = ?").bind(username.toLowerCase()).first();
        if (user && user.passwordHash === hashHex) {
            return new Response(JSON.stringify({ message: "Logged in via Edge" }), { headers: cors });
        }
        return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: cors });
    }

    return new Response("Not Found", { status: 404 });
}
