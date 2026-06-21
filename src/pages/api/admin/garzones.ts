export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const garzones = await sql`SELECT id, nombre, email FROM usuarios WHERE rol = 'garzon' ORDER BY nombre ASC`;
    return new Response(JSON.stringify({ garzones }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error GET garzones:', error);
    return new Response(JSON.stringify({ error: 'Error al cargar garzones' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
