// Vercel Serverless Function — proxy para o entry SSR do TanStack Start.
// O build do Vite gera dist/server/server.js exportando { fetch(request) }.
// Convertemos req/res Node em Request/Response Web standard.

import server from "../dist/server/server.js";

export const config = {
  runtime: "nodejs",
};

function nodeReqToWebRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, String(value));
    }
  }

  const init = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req;
    init.duplex = "half";
  }
  return new Request(url, init);
}

async function pipeWebResponse(webRes, res) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!webRes.body) {
    res.end();
    return;
  }
  const reader = webRes.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

export default async function handler(req, res) {
  try {
    const webRequest = nodeReqToWebRequest(req);
    const webResponse = await server.fetch(webRequest);
    await pipeWebResponse(webResponse, res);
  } catch (err) {
    console.error("[vercel handler] erro", err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain");
    res.end("Internal Server Error");
  }
}
