// Netlify serverless function: /api/weather
// - Node-RED on HA POSTs weather JSON here every 60s (with a secret header)
// - The website GETs from here to display data
// - Data is stored in Netlify Blobs (built-in free key-value store)

import { getStore } from "@netlify/blobs";

export const handler = async (event) => {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
      },
    };
  }

  const store = getStore("shedweather");

  // ── POST: Node-RED pushes fresh data ─────────────────────────────────────
  if (event.httpMethod === "POST") {
    const incoming = (event.headers["x-webhook-secret"] || "").trim();
    const expected = (process.env.WEATHER_SECRET || "").trim();

    if (!expected || incoming !== expected) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    try {
      await store.set("latest", event.body);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // ── GET: website fetches current data ────────────────────────────────────
  if (event.httpMethod === "GET") {
    try {
      const data = await store.get("latest");
      if (!data) {
        return {
          statusCode: 503,
          headers: corsHeaders,
          body: JSON.stringify({ error: "No weather data yet — is Node-RED running?" }),
        };
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: data,
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};
