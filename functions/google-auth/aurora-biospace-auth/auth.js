export async function onRequestPost(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  const clientId = "1073478097806-e1uppnsvsmddbqp1hifdt2s8iqjrp7ns.apps.googleusercontent.com";
  const clientSecret = context.env['aurora-biospace-google-auth-client-secret'];
  
  if (!clientSecret) {
    return new Response(
      JSON.stringify({ error: "Server error: Secret key configuration missing." }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. ADD codeVerifier to the extracted properties from the desktop request
    const { code, redirectUri, codeVerifier } = await context.request.json();

    if (!code || !redirectUri || !codeVerifier) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code, redirectUri, or codeVerifier" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Pass code_verifier onto Google
    const googleResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier, // <-- Google requires this to validate the PKCE handshake!
        grant_type: "authorization_code",
      }),
    });

    const tokens = await googleResponse.json();

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
