/**
 * fetch con timeout. Uso:
 *   const res = await fetchTimeout('/api/pedidos', { method: 'POST', ... }, 10000);
 * Lanza error 'Tiempo de espera agotado' si el servidor no responde a tiempo.
 */
export async function fetchTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado. Verifica tu conexión.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
