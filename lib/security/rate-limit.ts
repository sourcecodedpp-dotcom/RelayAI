interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const limiters = new Map<string, TokenBucket>();

const BUCKET_CAPACITY = 100;
const REFILL_RATE_PER_MS = 100 / 60000; // Refill 100 tokens every 60,000ms (1 minute)

/**
 * Checks if a specific IP address has exceeded its rate limit.
 * Returns true if rate limited, false otherwise.
 */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  let bucket = limiters.get(ip);

  if (!bucket) {
    bucket = { tokens: BUCKET_CAPACITY, lastRefill: now };
    limiters.set(ip, bucket);
    return false;
  }

  // Calculate refilled tokens since last access
  const elapsed = now - bucket.lastRefill;
  const refilled = elapsed * REFILL_RATE_PER_MS;
  
  bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + refilled);
  bucket.lastRefill = now;

  // Consume a token if available
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return false;
  }

  return true;
}
