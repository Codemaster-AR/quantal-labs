export async function onRequest(context) {
  try {
    // 1. Force fetch to pull the asset target
    const response = await context.next();

    // 2. Check the response body or headers. 
    // When Cloudflare intercepts with a 1033 page, it drops its own specific server tracking headers
    const text = await response.clone().text();
    const isCFErrorPage = text.includes("error code: 1033") || text.includes("Argo Tunnel error");

    if (isCFErrorPage || response.status >= 500) {
      return returnMaintenancePage();
    }

    return response;
  } catch (err) {
    // 3. Absolute fallback if the runtime context breaks completely
    return returnMaintenancePage();
  }
}

// Your beautiful dark-mode layout remains right here
function returnMaintenancePage() {
  return new Response(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quantal Labs | Maintenance</title>
    <style>
      body {
        margin: 0; padding: 0; display: flex; justify-content: center; align-items: center;
        height: 100vh; background: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #fff;
      }
      .card {
        text-align: center; padding: 40px; border-radius: 24px;
        background: rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-width: 450px; margin: 20px;
      }
      h1 { font-size: 2rem; margin-bottom: 10px; color: #3b82f6; font-weight: 700; letter-spacing: -0.5px; }
      p { color: #9ca3af; line-height: 1.6; font-size: 1.05rem; }
      .date {
        display: inline-block; margin-top: 20px; padding: 8px 16px; 
        background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2);
        border-radius: 30px; color: #60a5fa; font-weight: 600; font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Quantal Labs</h1>
      <p>ez-chat is currently undergoing planned system infrastructure optimizations and upgrades.</p>
      <div class="date">Estimated Return: August 1st</div>
    </div>
  </body>
  </html>
  `, {
    status: 503,
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}
