// server/app/lib/cache.js
// Tiny LRU with TTL. In-memory only.

class LRUCache {
    constructor({ max = 100, ttlMs = 1000 * 60 * 5 } = {}) {
        this.max = max;
        this.ttlMs = ttlMs;
        this.map = new Map(); // key -> { value, expiresAt }
    }

    _now() { return Date.now(); }

    get(key) {
        const entry = this.map.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt && entry.expiresAt < this._now()) {
            this.map.delete(key);
            return undefined;
        }
        // bump recency
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    set(key, value) {
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, { value, expiresAt: this.ttlMs ? this._now() + this.ttlMs : null });
        // trim
        while (this.map.size > this.max) {
            const oldestKey = this.map.keys().next().value;
            this.map.delete(oldestKey);
        }
    }

    async wrap(key, fn) {
        const hit = this.get(key);
        if (hit !== undefined) return hit;
        const value = await fn();
        this.set(key, value);
        return value;
    }
}

module.exports = { LRUCache };