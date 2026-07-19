export async function onRequestPost(context) {
    const { request, env } = context;
    const { username, email, password } = await request.json();

    // 1. Generate random salt
    const salt = crypto.randomUUID();
    const hash = await deriveHash(password, salt);

    try {
        await env.DB.prepare("INSERT INTO Users (username, email, passwordHash, salt) VALUES (?, ?, ?, ?)")
            .bind(username.toLowerCase(), email.toLowerCase(), hash, salt)
            .run();
            
        return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (e) {
        return new Response(JSON.stringify({ error: "User already exists" }), { status: 400 });
    }
}

// Reuse the same deriveHash function here
async function deriveHash(password, salt) { /* (Same as above) */ }
