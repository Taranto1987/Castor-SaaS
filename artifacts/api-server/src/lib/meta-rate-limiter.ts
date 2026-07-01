interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

// 1 batch call per loja; Meta's undocumented limit is ~200 calls/hr per catalog
// We conservatively allow 10 batch calls/minute per loja (up to 50 products each)
const CAPACITY = 10;
const REFILL_AMOUNT = 10;
const REFILL_INTERVAL_MS = 60_000;

const buckets = new Map<number, Bucket>();

function getBucket(lojaId: number): Bucket {
  let b = buckets.get(lojaId);
  if (!b) {
    b = { tokens: CAPACITY, lastRefillAt: Date.now() };
    buckets.set(lojaId, b);
  }
  return b;
}

function refill(b: Bucket): void {
  const intervals = Math.floor((Date.now() - b.lastRefillAt) / REFILL_INTERVAL_MS);
  if (intervals > 0) {
    b.tokens = Math.min(CAPACITY, b.tokens + intervals * REFILL_AMOUNT);
    b.lastRefillAt += intervals * REFILL_INTERVAL_MS;
  }
}

export function tryConsume(lojaId: number, count = 1): boolean {
  const b = getBucket(lojaId);
  refill(b);
  if (b.tokens >= count) {
    b.tokens -= count;
    return true;
  }
  return false;
}

export function getStatus(lojaId: number): { tokens: number; capacity: number; nextRefillMs: number } {
  const b = getBucket(lojaId);
  refill(b);
  return {
    tokens: b.tokens,
    capacity: CAPACITY,
    nextRefillMs: Math.max(0, REFILL_INTERVAL_MS - (Date.now() - b.lastRefillAt)),
  };
}
