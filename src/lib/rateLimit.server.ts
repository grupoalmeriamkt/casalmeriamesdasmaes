type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Máximo de requisições na janela. */
  max: number;
  /** Janela em milissegundos. */
  windowMs: number;
};

export function getRemoteIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Rate limit in-memory por IP + chave de rota.
 * Em serverless com múltiplas instâncias a proteção é parcial — complementar com Vercel Firewall.
 * Retorna Response 429 se exceder, ou null se permitido.
 */
export function rateLimit(
  request: Request,
  routeKey: string,
  options: RateLimitOptions,
): Response | null {
  const ip = getRemoteIp(request);
  const key = `${routeKey}:${ip}`;
  const now = Date.now();

  let bucket = store.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + options.windowMs };
    store.set(key, bucket);
  }

  bucket.count += 1;

  // Limpeza ocasional para não crescer indefinidamente.
  if (store.size > 10_000) {
    for (const [k, b] of store) {
      if (now >= b.resetAt) store.delete(k);
    }
  }

  if (bucket.count > options.max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    });
  }

  return null;
}
