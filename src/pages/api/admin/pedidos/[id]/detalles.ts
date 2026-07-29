export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../../../lib/db';
import { getSessionFromCookie } from '../../../../../lib/auth';

export const GET: APIRoute = async ({ request, params }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const pedidoId = parseInt(params.id || '');
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return new Response(JSON.stringify({ error: 'ID de pedido inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const detalles = await sql`
      SELECT dp.*, pr.nombre as producto_nombre, pr.precio as producto_precio
      FROM detalle_pedidos dp
      JOIN productos pr ON pr.id = dp.producto_id
      WHERE dp.pedido_id = ${pedidoId}
    `;

    return new Response(JSON.stringify({ detalles }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al cargar detalles' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
