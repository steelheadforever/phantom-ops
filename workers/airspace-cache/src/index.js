/**
 * Cloudflare Worker: serves cached FAA Class B/C/D airspace GeoJSON from R2,
 * and refreshes the data on a daily cron schedule.
 *
 * R2 binding: AIRSPACE_BUCKET
 * Route: phantom-ops.net/data/airspace/*
 */

const BASE_URL =
  'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0/query';

const CLASSES = ['B', 'C', 'D'];

function r2Key(cls) {
  return `class-${cls.toLowerCase()}.geojson`;
}

// ── Fetch handler: serve GeoJSON from R2 ────────────────────────────────

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/data\/airspace\/(class-[bcd]\.geojson)$/);

  if (!match) {
    // Not a Worker-managed path — let Cloudflare Pages serve it
    return fetch(request);
  }

  const key = match[1];
  const object = await env.AIRSPACE_BUCKET.get(key);

  if (!object) {
    return new Response('Not found — data may not be cached yet', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/geo+json');
  headers.set('Cache-Control', 'public, max-age=86400');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(object.body, { headers });
}

// ── Cron handler: fetch from FAA ArcGIS and write to R2 ─────────────────

async function handleScheduled(env) {
  for (const cls of CLASSES) {
    const key = r2Key(cls);
    const queryUrl =
      `${BASE_URL}?where=CLASS%3D%27${cls}%27&outFields=*&f=geojson`;

    console.log(`Fetching Class ${cls} airspace...`);
    const response = await fetch(queryUrl);

    if (!response.ok) {
      console.error(`Class ${cls} fetch failed: ${response.status}`);
      continue;
    }

    const body = await response.text();

    // Basic validation
    const parsed = JSON.parse(body);
    if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
      console.error(`Class ${cls}: invalid GeoJSON response`);
      continue;
    }

    await env.AIRSPACE_BUCKET.put(key, body, {
      httpMetadata: { contentType: 'application/geo+json' },
    });

    console.log(`Class ${cls}: cached ${parsed.features.length} features`);
  }

  console.log('Airspace cache refresh complete.');
}

// ── Worker entry point ──────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },

  async scheduled(event, env) {
    await handleScheduled(env);
  },
};
