// Supabase Edge Function: send-reminders
// Canh các việc sắp tới giờ nhắc (due_at - remind_minutes) và gửi Web Push
// tới máy của chủ việc, kể cả khi app đã tắt. Được pg_cron gọi mỗi phút.
// Secrets cần đặt (Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), CRON_SECRET
// SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY được Supabase tự cấp.
// Khi deploy function này nhớ TẮT "Verify JWT" (function tự kiểm tra CRON_SECRET).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const APP_URL = "https://nhuy-dev.github.io/to-do-list/";

// ---------- helpers ----------
function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function b64urlEncode(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
const hkdfExtract = (salt: Uint8Array, ikm: Uint8Array) => hmac(salt, ikm);
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, len);
}
async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

// ---------- VAPID JWT ----------
async function vapidJwt(audience: string): Promise<string> {
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT,
  })));
  const pub = b64urlDecode(VAPID_PUBLIC);
  const jwk = {
    kty: "EC", crv: "P-256",
    x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)),
    d: VAPID_PRIVATE, ext: true,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const data = new TextEncoder().encode(`${header}.${claims}`);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data));
  return `${header}.${claims}.${b64urlEncode(sig)}`;
}

// ---------- Mã hoá payload theo RFC 8291 (aes128gcm) ----------
async function encryptPayload(uaPublicB64: string, authB64: string, payload: string): Promise<{ body: Uint8Array; asPublic: Uint8Array }> {
  const uaPublic = b64urlDecode(uaPublicB64);
  const authSecret = b64urlDecode(authB64);
  const uaJwk = { kty: "EC", crv: "P-256", x: b64urlEncode(uaPublic.slice(1, 33)), y: b64urlEncode(uaPublic.slice(33, 65)), ext: true };
  const uaKey = await crypto.subtle.importKey("jwk", uaJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prkKey = await hkdfExtract(authSecret, ecdhSecret);
  const keyInfo = concat(new TextEncoder().encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
  const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const plain = concat(new TextEncoder().encode(payload), new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, cekKey, plain));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  const body = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
  return { body, asPublic };
}

async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string): Promise<number> {
  const { body } = await encryptPayload(sub.p256dh, sub.auth, payload);
  const aud = new URL(sub.endpoint).origin;
  const jwt = await vapidJwt(aud);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600", Urgency: "high",
    },
    body,
  });
  return res.status;
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const now = Date.now();
  const windowStart = now - 2 * 3600 * 1000; // bỏ qua nhắc đã quá cũ >2 giờ
  const q = `tasks?select=id,owner_id,title,due_at,remind_minutes&done=eq.false&remind_minutes=not.is.null&due_at=not.is.null&reminder_sent_at=is.null&order=due_at.asc&limit=100`;
  const tres = await rest(q);
  if (!tres.ok) return new Response(`tasks query failed: ${await tres.text()}`, { status: 500 });
  const tasks = await tres.json();
  let sent = 0, checked = 0;
  for (const t of tasks) {
    const remindAt = new Date(t.due_at).getTime() - Number(t.remind_minutes) * 60000;
    if (remindAt > now || remindAt < windowStart) continue;
    checked++;
    const sres = await rest(`push_subscriptions?select=endpoint,p256dh,auth&user_id=eq.${t.owner_id}`);
    const subs = sres.ok ? await sres.json() : [];
    if (!subs.length) continue;
    const when = new Date(t.due_at).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    const payload = JSON.stringify({
      title: `🔔 Sắp tới giờ: ${t.title}`,
      body: `⏰ ${when} — còn ${t.remind_minutes} phút nữa tới giờ hẹn`,
      tag: `task-${t.id}`, url: APP_URL,
    });
    let ok = false;
    for (const sub of subs) {
      try {
        const status = await sendPush(sub, payload);
        if (status >= 200 && status < 300) ok = true;
        if (status === 404 || status === 410) {
          await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" });
        }
      } catch (e) { console.error("push failed", e); }
    }
    if (ok) {
      sent++;
      await rest(`tasks?id=eq.${t.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }) });
    }
  }
  return new Response(JSON.stringify({ checked, sent }), { headers: { "Content-Type": "application/json" } });
});
