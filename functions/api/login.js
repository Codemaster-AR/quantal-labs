export async function onRequestPost(context) {
    const { request, env } = context;
    
    // DEBUG: Check if DB exists
    if (!env.DB) {
        return new Response(JSON.stringify({ error: "Database binding missing" }), { status: 500 });
    }

    const { username, password } = await request.json();

    // 1. Fetch user by username
    const user = await env.DB.prepare("SELECT * FROM Users WHERE username = ?")
        .bind(username.toLowerCase()).first();

    if (!user) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });

    // 2. Hash incoming password with the user's stored salt
    const inputHash = await deriveHash(password, user.salt);

    // 3. Compare
    if (inputHash === user.passwordHash) {
        return new Response(JSON.stringify({ success: true, message: "Logged in" }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
}

async function deriveHash(password, salt) {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
    const derivedBits = await crypto.subtle.deriveBits({
        name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256"
    }, baseKey, 256);
    return [...new Uint8Array(derivedBits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
