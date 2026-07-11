// Query-param share routing. parseShareParams is pure; backend routing added later.
export function parseShareParams(search) {
  const p = new URLSearchParams(search || '');
  if (p.get('w')) return { mode: 'world', slug: p.get('w') };
  if (p.get('genome')) return { mode: 'genome', slug: p.get('genome') };
  return { mode: null, slug: null };
}

export async function routeShare(search, { invokeAction, currentWorldId }) {
  const { mode, slug } = parseShareParams(search);
  if (mode === 'world' && slug) {
    const result = await invokeAction('clone_world_from_slug', { slug });
    return { action: 'clone', result };
  }
  if (mode === 'genome' && slug && currentWorldId) {
    const result = await invokeAction('import_genome_from_slug', { world_id: currentWorldId, slug });
    return { action: 'import', result };
  }
  return null;
}
