const resolvedMaps = new Map<string, Promise<string | null>>();

export function mapEmbedUrl(link: string): Promise<string | null> {
  if (!link) return Promise.resolve(null);
  const cached = resolvedMaps.get(link);
  if (cached) return cached;
  const result = resolveMap(link).catch(() => {
    resolvedMaps.delete(link);
    return null;
  });
  resolvedMaps.set(link, result);
  return result;
}

async function resolveMap(link: string): Promise<string | null> {
  let url = new URL(link);
  if (url.protocol !== 'https:') return null;
  if (url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl') {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Map link could not be resolved');
    url = new URL(response.url);
    await response.body?.cancel();
  }
  if (!['google.com', 'www.google.com', 'maps.google.com', 'google.de', 'www.google.de'].includes(url.hostname)) return null;
  if (url.pathname.startsWith('/maps/embed')) return url.href;
  const coordinates = url.href.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/);
  const query = coordinates ? `${coordinates[1]},${coordinates[2]}`
    : url.searchParams.get('q') || url.searchParams.get('query')
      || decodeURIComponent(url.pathname.match(/\/place\/([^/]+)/)?.[1] || '').replace(/\+/g, ' ');
  if (!query) return null;
  return `https://www.google.com/maps/embed?origin=mfe&pb=${encodeURIComponent(`!1m2!2m1!1s${query}`)}`;
}
