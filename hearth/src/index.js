// the hearth of the world of scorsby.
//
// one durable object holds everyone who is here right now and passes love,
// blinks, hearts and songs between them. who you are lives only as long as
// your connection. what is written down: how much love was shared each day
// (just numbers), where love-for-everyone came from today (fuzzy points, gone
// after a day), and the little markers people plant (gone after six hours).
//
// no ip addresses are kept. your location is rounded to about 100 km and
// jittered before anyone else sees it. your voice never arrives here:
// only its pitch and loudness.

import { DurableObject } from 'cloudflare:workers';

const DAY = 24 * 60 * 60 * 1000;
const MARK_LIFE = 6 * 60 * 60 * 1000;
const MAX_HERE = 400;
const MAX_TRAILS = 500;
const MAX_MARKS = 300;

// tokens per second, burst
const LIMITS = {
  move: [6, 12], all: [0.25, 1], blink: [2, 4], sing: [14, 20], hush: [2, 4],
  color: [1, 4], poke: [3, 6], name: [1, 4], mark: [0.05, 2],
};

// strange things that happen to everyone at once
const OMENS = ['eclipse', 'flock', 'sneeze', 'hearts', 'colorstorm', 'unison', 'ears', 'heartstar', 'thirdeye', 'goldrain', 'wings'];
const COLORS = 9; // see heartstar.js: blue pink green orange purple yellow red ghost rainbow. or any #rrggbb.
const HEX = /^#?([0-9a-f]{6})$/i;
const cleanColor = (v) => { const h = HEX.exec(String(v ?? '')); if (h) return '#' + h[1].toLowerCase(); const n = Math.round(Number(v)); return Number.isFinite(n) ? clamp(n, 0, COLORS - 1) : null; };
const MARKS = ['cactus', 'flower', 'tree', 'house', 'mushroom', 'heart', 'pyramid', 'eye', 'lips', 'head'];
const UNKIND = /fuck|shit|cunt|nigg|fag|rape|nazi|hitler|kike|retard|whore|slut|cock|dick|pussy|penis|vagina|porn|sex|kill|hate/i;

const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(new Date());

// names are short, lowercase, letters and numbers, and kind
function cleanName(raw) {
  const n = String(raw ?? '').normalize('NFKC').replace(/[^\p{L}\p{N} '-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16).toLowerCase();
  return UNKIND.test(n.replace(/[^a-z]/g, '')) ? '' : n;
}

function fuzz(lat, lon) {
  // round to a whole degree (~111 km), then wander a little
  const la = clamp(Math.round(lat) + (Math.random() - 0.5) * 1.4, -70, 80);
  let lo = Math.round(lon) + (Math.random() - 0.5) * 1.4;
  if (lo > 180) lo -= 360;
  if (lo < -180) lo += 360;
  return [round(la, 2), round(lo, 2)];
}

function allowed(origin, env, self) {
  if (!origin) return false;
  if (origin === self) return true; // the page this same worker served
  try {
    const u = new URL(origin);
    if (['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return true;
  } catch { return false; }
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).includes(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/hearth') {
      if (env.ASSETS) return env.ASSETS.fetch(request); // the whole site, when this worker serves it
      return new Response('the world of scorsby is breathing.\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('come with a websocket.', { status: 426 });
    if (!allowed(request.headers.get('Origin'), env, url.origin)) return new Response('not from here.', { status: 403 });

    const cf = request.cf || {};
    const lat = parseFloat(cf.latitude), lon = parseFloat(cf.longitude);
    const at = num(lat) && num(lon) ? fuzz(lat, lon) : fuzz(Math.random() * 100 - 40, Math.random() * 360 - 180);

    const headers = new Headers(request.headers);
    headers.set('x-heart-at', at.join(','));
    const stub = env.HEARTH.get(env.HEARTH.idFromName('heartstar-prime'));
    return stub.fetch(new Request(request.url, { headers }));
  },
};

export class Hearth extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.buckets = new Map(); // id -> { kind: [tokens, last] }. forgotten on hibernation, which is fine.
    this.blinks = [];
    this.lastTogether = 0;
    this.trails = null;
    this.marks = null;
    this.tally = null;
    this.lastSave = 0;
    // keepalives are answered without waking anyone up
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async load(key, keep) {
    if (!this[key]) this[key] = (await this.ctx.storage.get(key)) || [];
    const now = Date.now();
    this[key] = this[key].filter((t) => now - t.t < keep);
    return this[key];
  }

  async remember(key, item, keep, max) {
    const list = await this.load(key, keep);
    list.push(item);
    if (list.length > max) list.splice(0, list.length - max);
    await this.ctx.storage.put(key, list);
  }

  // how much love was shared, day by day (albuquerque days)
  async loadTally() {
    if (!this.tally) this.tally = (await this.ctx.storage.get('tally')) || { days: {}, best: { day: '', n: 0 } };
    return this.tally;
  }
  async love(n) {
    const t = await this.loadTally();
    const d = today();
    t.days[d] = (t.days[d] || 0) + n;
    let record = false;
    if (t.days[d] > t.best.n) {
      record = t.best.day !== d && t.best.n > 0; // announced once, the moment today passes the old record
      t.best = { day: d, n: t.days[d] };
    }
    const keys = Object.keys(t.days).sort();
    while (keys.length > 90) delete t.days[keys.shift()];
    if (Date.now() - this.lastSave > 4000 || record) { this.lastSave = Date.now(); await this.ctx.storage.put('tally', t); }
    return { today: t.days[d], best: t.best, record };
  }
  async tallyNow() {
    const t = await this.loadTally();
    return { today: t.days[today()] || 0, best: t.best };
  }

  here() {
    return this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment()).filter(Boolean);
  }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch {} }

  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(s); } catch {}
    }
  }

  allow(id, kind) {
    const [rate, burst] = LIMITS[kind];
    let b = this.buckets.get(id);
    if (!b) this.buckets.set(id, (b = {}));
    const now = Date.now();
    const [tokens, last] = b[kind] || [burst, now];
    const t = Math.min(burst, tokens + ((now - last) / 1000) * rate);
    if (t < 1) { b[kind] = [t, now]; return false; }
    b[kind] = [t - 1, now];
    return true;
  }

  async fetch(request) {
    if (this.ctx.getWebSockets().length >= MAX_HERE) return new Response('the hearth is full. try again soon.', { status: 503 });
    const url = new URL(request.url);
    const [lat, lon] = (request.headers.get('x-heart-at') || '0,0').split(',').map(Number);
    const tz = clamp(parseInt(url.searchParams.get('tz'), 10) || 0, -840, 840);
    const c = cleanColor(url.searchParams.get('c')) ?? 0;
    const n = cleanName(url.searchParams.get('n'));

    const { 0: client, 1: server } = new WebSocketPair();
    const me = { id: crypto.randomUUID().slice(0, 8), lat, lon, tz, c, n, since: Date.now() };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(me);

    const trails = await this.load('trails', DAY);
    const marks = await this.load('marks', MARK_LIFE);
    const tally = await this.tallyNow();
    const others = this.here().filter((p) => p.id !== me.id);
    this.send(server, { t: 'hello', you: me, here: others, trails, marks, tally });
    this.broadcast({ t: 'join', p: me }, server);
    if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + 30000 + Math.random() * 45000);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 300) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment();
    if (!me || !LIMITS[m.t] || !this.allow(me.id, m.t)) return;

    switch (m.t) {
      case 'move': {
        if (!num(m.lat) || !num(m.lon)) return;
        me.lat = round(clamp(m.lat, -85, 85), 1);
        me.lon = round(((m.lon + 540) % 360) - 180, 1);
        ws.serializeAttachment(me);
        this.broadcast({ t: 'move', id: me.id, lat: me.lat, lon: me.lon }, ws);
        break;
      }
      case 'all': {
        const v = clamp(Math.round(num(m.v) ? m.v : 0), 0, 3);
        const trail = { a: [me.lat, me.lon], t: Date.now(), k: 'all' };
        // one point of love, plus one for every hand the sender is holding
        const hands = clamp(Math.round(num(m.h) ? m.h : 0), 0, Math.max(0, this.ctx.getWebSockets().length - 1));
        const tally = await this.love(1 + hands);
        this.broadcast({ t: 'all', from: me.id, a: trail.a, at: trail.t, v, tally });
        await this.remember('trails', trail, DAY, MAX_TRAILS);
        break;
      }
      case 'poke': {
        if (!num(m.lat) || !num(m.lon)) return;
        this.broadcast({ t: 'poke', from: me.id, lat: round(clamp(m.lat, -90, 90), 1), lon: round(clamp(m.lon, -180, 180), 1) });
        break;
      }
      case 'blink': {
        const now = Date.now();
        this.broadcast({ t: 'blink', id: me.id }, ws);
        this.blinks = this.blinks.filter((b) => now - b.t < 1200);
        this.blinks.push({ id: me.id, t: now });
        if (new Set(this.blinks.map((b) => b.id)).size >= 2 && now - this.lastTogether > 4000) {
          this.lastTogether = now;
          this.blinks = [];
          this.broadcast({ t: 'together' });
        }
        break;
      }
      case 'sing': {
        if (!num(m.f) || !num(m.a)) return;
        this.broadcast({ t: 'sing', id: me.id, f: round(clamp(m.f, 60, 1400), 1), a: round(clamp(m.a, 0, 1), 2) }, ws);
        break;
      }
      case 'hush':
        this.broadcast({ t: 'hush', id: me.id }, ws);
        break;
      case 'color': {
        const c = cleanColor(m.c);
        if (c === null) return;
        me.c = c;
        ws.serializeAttachment(me);
        this.broadcast({ t: 'color', id: me.id, c }, ws);
        break;
      }
      case 'name': {
        me.n = cleanName(m.n);
        ws.serializeAttachment(me);
        this.broadcast({ t: 'name', id: me.id, n: me.n });
        break;
      }
      case 'mark': {
        if (!num(m.lat) || !num(m.lon) || !MARKS.includes(m.k)) return;
        const mark = { lat: round(clamp(m.lat, -85, 85), 2), lon: round(clamp(m.lon, -180, 180), 2), k: m.k, n: me.n || '', t: Date.now() };
        this.broadcast({ t: 'mark', lat: mark.lat, lon: mark.lon, k: mark.k, n: mark.n, at: mark.t });
        await this.remember('marks', mark, MARK_LIFE, MAX_MARKS);
        break;
      }
    }
  }

  // every minute or two, while anyone is here, something strange happens
  async alarm() {
    if (!this.ctx.getWebSockets().length) return; // nobody here. no omens. no alarm.
    const last = await this.ctx.storage.get('lastOmen');
    const choices = OMENS.filter((o) => o !== last);
    const k = choices[Math.floor(Math.random() * choices.length)];
    await this.ctx.storage.put('lastOmen', k);
    this.broadcast({ t: 'omen', k, seed: Math.floor(Math.random() * 1e6) });
    await this.ctx.storage.setAlarm(Date.now() + 60000 + Math.random() * 90000);
  }

  async webSocketClose(ws) { this.leave(ws); }
  async webSocketError(ws) { this.leave(ws); }

  leave(ws) {
    const me = ws.deserializeAttachment();
    try { ws.close(1000, 'goodbye'); } catch {}
    if (!me) return;
    this.buckets.delete(me.id);
    this.broadcast({ t: 'leave', id: me.id }, ws);
  }
}
