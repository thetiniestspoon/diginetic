// Query-param share routing. parseShareParams is pure; backend routing added later.
export function parseShareParams(search) {
  const p = new URLSearchParams(search || '');
  if (p.get('w')) return { mode: 'world', slug: p.get('w') };
  if (p.get('genome')) return { mode: 'genome', slug: p.get('genome') };
  return { mode: null, slug: null };
}
