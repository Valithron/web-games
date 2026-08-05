export function createEscapeeStorage(slug) {
  const prefix = `escapee:${slug}:`;
  return {
    get(key, fallback = null) {
      try {
        const value = localStorage.getItem(prefix + key);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(prefix + key); } catch {}
    }
  };
}
