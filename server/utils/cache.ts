import crypto from 'crypto';

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

class InMemCache {
  private store: Map<string, CacheEntry<any>> = new Map();

  generateKey(prefix: string, data: any): string {
    const str = JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    return `${prefix}:${hash}`;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiry: Date.now() + ttlMs });
  }

  delete(key: string) {
    this.store.delete(key);
  }
  
  clear() {
    this.store.clear();
  }
}

export const aiCache = new InMemCache();
// 24 hours in MS
export const TTL_24H = 24 * 60 * 60 * 1000;
