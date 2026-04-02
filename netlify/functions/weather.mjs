// Netlify Functions v2 — weather data store
// GET  → returns latest weather JSON (called by the website every 60s)
// POST → stores fresh weather JSON (called by Node-RED on HA every 60s)

import { getStore } from "@netlify/blobs";

export default async (request) => {
    const cors = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
            },
        });
    }

    const store = getStore("shedweather");

    // ── POST: Node-RED pushes data ────────────────────────────────────────
    if (request.method === "POST") {
        const incoming = (request.headers.get("x-webhook-secret") || "").trim();
        const expected  = (process.env.WEATHER_SECRET || "").trim();
        if (!expected || incoming !== expected) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: cors,
            });
        }
        const body = await request.text();
        await store.set("latest", body);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
    }

    // ── GET: website fetches data ─────────────────────────────────────────
    if (request.method === "GET") {
        const data = await store.get("latest");
        if (!data) {
            return new Response(
                JSON.stringify({ error: "No weather data yet — is Node-RED running?" }),
                { status: 503, headers: cors }
            );
        }
        return new Response(data, { status: 200, headers: cors });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: cors,
    });
};

// Serve at /api/weather — no redirect needed
export const config = { path: "/api/weather" };
