/** Kort uniek id; gebruikt crypto.randomUUID waar beschikbaar. */
export function newId(prefix: string): string {
  const c = globalThis.crypto;
  const raw =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return `${prefix}_${raw}`;
}
