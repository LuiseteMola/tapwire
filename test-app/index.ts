/**
 * Tapwire test-app
 *
 * A simple poller that makes varied HTTP requests to JSONPlaceholder so you
 * can watch live traffic flow through the Tapwire UI.
 *
 * Run standalone:
 *   tsx test-app/index.ts
 *
 * Run under Tapwire (after building the register):
 *   npm run build:register
 *   tapwire -- tsx test-app/index.ts
 *
 * Options (env vars):
 *   POLL_INTERVAL_MS   Milliseconds between each request (default: 3000)
 */

import http from 'node:http';
import https from 'node:https';
import axios from 'axios';

const BASE = 'https://jsonplaceholder.typicode.com';
const INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 3000);

// ---------------------------------------------------------------------------
// Request abstraction
// ---------------------------------------------------------------------------

interface RequestParams {
  method: string;
  url: string;
  body?: unknown;
}

interface RequestResult {
  status: number;
  body: unknown;
}

async function runWithFetch({ method, url, body }: RequestParams): Promise<RequestResult> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = text || null; }
  return { status: res.status, body: parsed };
}

async function runWithHttp({ method, url, body }: RequestParams): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}),
      },
    };

    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk: string) => { raw += chunk; });
      res.on('end', () => {
        let responseBody: unknown;
        try { responseBody = JSON.parse(raw); } catch { responseBody = raw || null; }
        resolve({ status: res.statusCode ?? 0, body: responseBody });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runWithAxios({ method, url, body }: RequestParams): Promise<RequestResult> {
  const res = await axios({ method, url, data: body, validateStatus: () => true });
  return { status: res.status, body: res.data };
}

async function runWithAbort({ method, url, body }: RequestParams): Promise<RequestResult> {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 1);
  const res = await axios({ method, url, data: body, signal: controller.signal, validateStatus: () => true });
  return { status: res.status, body: res.data };
}

// ---------------------------------------------------------------------------
// Round-robin runner
// ---------------------------------------------------------------------------

const runners: Array<(p: RequestParams) => Promise<RequestResult>> = [
  runWithFetch,
  runWithHttp,
  runWithAxios,
  // runWithAbort,
];
const runnerNames = ['fetch', 'http', 'axios', 'abort'];

async function runRequest(params: RequestParams, runnerIndex: number): Promise<void> {
  const runner = runners[runnerIndex % runners.length];
  const name = runnerNames[runnerIndex % runnerNames.length];
  const path = new URL(params.url).pathname;

  const start = Date.now();
  try {
    const { status, body } = await runner(params);
    const latency = Date.now() - start;
    const preview = JSON.stringify(body).slice(0, 80);
    console.log(`[${new Date().toISOString()}] [${name}] ${params.method} ${path} → ${status} (${latency}ms) ${preview}`);
  } catch (err) {
    const latency = Date.now() - start;
    console.error(`[${new Date().toISOString()}] [${name}] ${params.method} ${path} → ERROR (${latency}ms)`, (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Scenarios — cycled in order, IDs increment so each tick looks different
// ---------------------------------------------------------------------------

type Scenario = (tick: number) => { method: string; path: string; body?: unknown };

const scenarios: Scenario[] = [
  // (t) => ({ method: 'GET', path: `/poasdasdsts/99999` }),  // → 404
  // (t) => ({ method: 'GET',   path: `/users/${(t % 10) + 1}` }),
  // (t) => ({ method: 'GET',   path: `/posts?userId=${(t % 10) + 1}` }),
  (t) => ({ method: 'GET',   path: `/posts/${(t % 100) + 1}` }),
  // (t) => ({ method: 'POST', path: `/posts`, body: { title: `Post ${t}`, body: `Body of post ${t}`, userId: (t % 10) + 1 } }),
  // (t) => ({ method: 'PUT',   path: `/posts/${(t % 100) + 1}`, body: { id: (t % 100) + 1, title: `Updated ${t}`, body: 'Updated body', userId: 1 } }),
  // (t) => ({ method: 'PATCH', path: `/posts/${(t % 100) + 1}`, body: { title: `Patched ${t}` } }),
  // (t) => ({ method: 'POST', path: `/posts/${(t % 100) + 1}`, body: { title: `Posted ${t}` } }),
  // (t) => ({ method: 'PUT', path: `/posts/${(t % 100) + 1}`, body: { title: `Posted ${t}` } }),
  // (t) => ({ method: 'GET',   path: `/todos/${(t % 200) + 1}` }),
  // (t) => ({ method: 'GET',   path: `/comments?postId=${(t % 100) + 1}` }),
  // (t) => ({ method: 'DELETE', path: `/posts/${(t % 100) + 1}` }),
  // (t) => ({ method: 'GET',   path: `/albums/${(t % 100) + 1}` }),
];

// ---------------------------------------------------------------------------
// Poller
// ---------------------------------------------------------------------------

console.log(`Tapwire test-app starting — polling every ${INTERVAL_MS}ms`);
console.log(`Target: ${BASE}\n`);

let tick = 0;

async function poll(): Promise<void> {
  const scenario = scenarios[tick % scenarios.length];
  const { method, path, body } = scenario(tick);
  await runRequest({ method, url: `${BASE}${path}`, body }, tick);
  tick++;
  setTimeout(poll, INTERVAL_MS);
}

poll();
