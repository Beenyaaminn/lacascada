export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../../../lib/db';
import { getSessionFromCookie } from '../../../../../lib/auth';

export const GET: APIRoute = async ({ request, params }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const { id } = params;

  try {
    const detalles = await sql`
      SELECT dp.*, pr.nombre as producto_nombre, pr.precio as producto_precio
      FROM detalle_pedidos dp
      JOIN productos pr ON pr.id = dp.producto_id
      WHERE dp.pedido_id = ${id}
    `;

    return new Response(JSON.stringify({ detalles }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al cargar detalles' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
