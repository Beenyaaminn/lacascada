export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

const checkAuth = (request: Request) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return null;
  }
  return session;
};

export const GET: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const url = new URL(request.url);
    const estados = url.searchParams.getAll('estado');
    const desde = url.searchParams.get('desde');
    const tipoPedido = url.searchParams.get('tipo');

    let pedidos;
    if (estados.length > 0 && tipoPedido) {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.estado = ANY(${estados}::estado_pedido[])
          AND p.tipo_pedido = ${tipoPedido}
        ORDER BY p.fecha_hora DESC
      `;
    } else if (estados.length > 0) {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.estado = ANY(${estados}::estado_pedido[])
        ORDER BY p.fecha_hora DESC
      `;
    } else if (desde && tipoPedido) {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.fecha_hora >= ${desde}::date
          AND p.tipo_pedido = ${tipoPedido}
        ORDER BY p.fecha_hora DESC
      `;
    } else if (desde) {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.fecha_hora >= ${desde}::date
        ORDER BY p.fecha_hora DESC
      `;
    } else if (tipoPedido) {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.tipo_pedido = ${tipoPedido}
        ORDER BY p.fecha_hora DESC
      `;
    } else {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        ORDER BY p.fecha_hora DESC
      `;
    }

    return new Response(JSON.stringify({ pedidos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al cargar pedidos' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { id, estado } = await request.json();
    const validStates = ['pendiente', 'en_preparacion', 'entregado', 'pagado', 'cancelado'];

    if (!id || !validStates.includes(estado)) {
      return new Response(JSON.stringify({ error: 'Estado inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      UPDATE pedidos SET estado = ${estado}::estado_pedido WHERE id = ${id} RETURNING *
    `;

    return new Response(JSON.stringify({ pedido: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al actualizar pedido' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
