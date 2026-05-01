export async function loadLeaflet() {
  const mod = await import('leaflet');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = (mod as any).default ?? mod;
  return (L && typeof L.map === 'function') ? L : mod;
}
