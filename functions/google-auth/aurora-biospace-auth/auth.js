export async function onRequestPost(context) {
  // 1. Set up CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // 2. Safely extract your newly named secret using bracket notation
  const clientSecret = context.env['aurora-biospace-google-auth-client-secret'];
  
  if (!clientSecret) {
    return new Response(
      JSON.stringify({ error: "Server error: Secret key is not configured." }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 3. Parse the temporary authorization code, Client ID, and redirect URI sent by the desktop app
    const { code, clientId, redirectUri } = await context.request.json();

    if (!code || !clientId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code, clientId, or redirectUri" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Send the payload securely from Cloudflare to Google's token endpoint
    const googleResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret, // Safely passed behind the scenes
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await googleResponse.json();

    // 5. Send the access/refresh tokens back to your Aurora-Biospace app
    return new Response(JSON.stringify(tokens), {
      status: googleResponse.status,
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json" 
      },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Internal Server Error: ${error.message}` }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Handle preflight OPTIONS requests for CORS compliance
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
