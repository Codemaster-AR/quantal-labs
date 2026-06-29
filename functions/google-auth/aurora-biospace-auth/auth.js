export async function onRequestPost(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Allows your desktop app to call this endpoint
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // 1. Hardcoded Client ID specific to Aurora-Biospace
  const clientId = "1073478097806-e1uppnsvsmddbqp1hifdt2s8iqjrp7ns.apps.googleusercontent.com";

  // 2. Safely extract the secret from your Cloudflare project settings
  const clientSecret = context.env['aurora-biospace-google-auth-client-secret'];
  
  if (!clientSecret) {
    return new Response(
      JSON.stringify({ error: "Server error: Secret key configuration missing." }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 3. The desktop app now only needs to send the code and redirectUri!
    const { code, redirectUri } = await context.request.json();

    if (!code || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code or redirectUri" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Send the completely constructed token request to Google
    const googleResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,         // Provided automatically by the server
        client_secret: clientSecret, // Provided automatically by the server
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await googleResponse.json();

    // 5. Send the final tokens back to your app
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
