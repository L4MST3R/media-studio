// Shared by the suites: a fake EveryApp Gateway that answers the AI provider
// and Replicate calls the app makes, so successful paths can be exercised
// without any real provider. It lives only in the checks, never in the app.
import { deflateSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** A soft diagonal gradient PNG, so generated "images" look like pictures. */
export function gradientPng(width, height, from, to) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const t = (x / width + y / height) / 2;
      const wave = 0.08 * Math.sin((x + y) / 18);
      for (let i = 0; i < 3; i++) {
        row[1 + x * 3 + i] = Math.max(
          0,
          Math.min(255, Math.round(from[i] + (to[i] - from[i]) * (t + wave))),
        );
      }
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PALETTE = [
  [
    [245, 196, 140],
    [120, 70, 50],
  ],
  [
    [150, 200, 230],
    [30, 60, 110],
  ],
  [
    [210, 230, 190],
    [60, 110, 80],
  ],
  [
    [240, 180, 190],
    [110, 50, 90],
  ],
];
const IMAGES = PALETTE.map(([a, b]) =>
  gradientPng(320, 200, a, b).toString("base64"),
);

export const FAKE_GATEWAY = "fake-gateway";

const SCRIPT = `
const IMAGES = ${JSON.stringify(IMAGES)};
const calls = [];
let mode = "on";
let counter = 0;
const polls = new Map();
const refuse = (code) => Response.json(
  { error: "Service Unavailable", code, message: "Not configured.", setup: "Ask an admin to add the provider key on the Gateway.", settings: [], command: null },
  { status: 503, headers: { "x-everyapp-error": code } });
export default { async fetch(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/__calls") return Response.json(calls);
  if (path === "/__mode") { mode = await request.text(); return new Response("ok"); }
  const body = request.method === "GET" ? null : await request.text();
  calls.push({ method: request.method, path, body: body && body.length > 200000 ? body.slice(0, 200000) : body, size: body ? body.length : 0 });
  if (path.startsWith("/api/ai/")) {
    if (mode === "off") return refuse("ai_provider_not_configured");
    if (path === "/api/ai/openrouter/api/v1/chat/completions") {
      const payload = JSON.parse(body);
      const text = JSON.stringify(payload.messages);
      if (text.includes("watermark")) return Response.json({ error: { message: "This request was declined by the model.", code: 400 } }, { status: 400 });
      const image = IMAGES[counter++ % IMAGES.length];
      return Response.json({ id: "gen-" + counter, choices: [{ message: { role: "assistant", content: "", images: [{ type: "image_url", image_url: { url: "data:image/png;base64," + image } }] } }] });
    }
    if (path === "/api/ai/openai/v1/audio/speech") {
      const bytes = new Uint8Array(2048); bytes[0] = 0xff; bytes[1] = 0xfb;
      return new Response(bytes, { headers: { "content-type": "audio/mpeg" } });
    }
    return Response.json({ error: { message: "unexpected path " + path } }, { status: 404 });
  }
  if (path.startsWith("/api/integrations/replicate/api.replicate.com/")) {
    if (mode === "off") return refuse("integration_not_configured");
    const rest = path.slice("/api/integrations/replicate/api.replicate.com".length);
    if (request.method === "POST" && /^\\/v1\\/models\\/[^/]+\\/[^/]+\\/predictions$/.test(rest)) {
      const id = "pred" + (++counter);
      return Response.json({ id, status: "starting", output: null, error: null }, { status: 201 });
    }
    const m = rest.match(/^\\/v1\\/predictions\\/([^/]+)$/);
    if (request.method === "GET" && m) {
      const n = (polls.get(m[1]) || 0) + 1; polls.set(m[1], n);
      if (n < 2) return Response.json({ id: m[1], status: "processing", output: null, error: null });
      return Response.json({ id: m[1], status: "failed", output: null, error: "The model ran out of memory at this resolution." });
    }
    return Response.json({ detail: "unexpected " + rest }, { status: 404 });
  }
  return refuse("integration_not_configured");
} };`;

export function fakeGatewayOptions() {
  return {
    bindings: { EVERY_APP_GATEWAY: { type: "worker", worker: FAKE_GATEWAY } },
    workers: [
      {
        config: {
          name: FAKE_GATEWAY,
          compatibilityDate: "2025-09-01",
          manifest: {
            mainModule: "fake.mjs",
            modules: { "fake.mjs": { type: "esm", contents: SCRIPT } },
          },
        },
      },
    ],
  };
}

async function fake(runtime) {
  return runtime.mf.getWorker(FAKE_GATEWAY);
}
export async function gatewayMode(runtime, mode) {
  const worker = await fake(runtime);
  await worker.fetch("http://fake/__mode", { method: "POST", body: mode });
}
export async function fakeCalls(runtime) {
  const worker = await fake(runtime);
  return (await worker.fetch("http://fake/__calls")).json();
}

/** A small PNG a member uploads as a reference or start image. */
export const REFERENCE_PNG = gradientPng(64, 64, [200, 160, 120], [90, 60, 40]);

/** Catches the next server-function POST the page sends, without letting it through. */
export async function captureServerFnPost(page, trigger) {
  let resolve;
  const captured = new Promise((r) => (resolve = r));
  const handler = async (route) => {
    const req = route.request();
    if (req.method() !== "POST") return route.continue();
    resolve({
      url: req.url(),
      headers: await req.allHeaders(),
      body: req.postDataBuffer(),
    });
    await route.abort();
  };
  await page.route("**/_serverFn/**", handler);
  await trigger();
  const result = await captured;
  await page.unroute("**/_serverFn/**", handler);
  return result;
}

/** Sends a captured server-function call again from another member's page. */
export async function replayAs(page, captured) {
  const headers = {};
  for (const [name, value] of Object.entries(captured.headers)) {
    const lower = name.toLowerCase();
    if (
      lower === "content-type" ||
      lower === "accept" ||
      lower.startsWith("x-tsr")
    )
      headers[name] = value;
  }
  return page.evaluate(
    async ({ url, headers, body }) => {
      const res = await fetch(url, { method: "POST", headers, body });
      return { ok: res.ok, status: res.status, text: await res.text() };
    },
    {
      url: captured.url,
      headers,
      body: captured.body ? captured.body.toString("utf8") : null,
    },
  );
}
