export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

const checkAuth = (request: Request) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) return null;
  return session;
};

export const GET: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const reservas = await sql`
    SELECT r.*, p.nombre as producto_nombre
    FROM reservas_platos r
    JOIN productos p ON p.id = r.producto_id
    ORDER BY r.fecha DESC, r.created_at DESC
  `;

  return new Response(JSON.stringify({ reservas }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { nombre_cliente, producto_id, cantidad, fecha, hora } = await request.json();

    if (!nombre_cliente || !producto_id || !cantidad) {
      return new Response(JSON.stringify({ error: 'Todos los campos son requeridos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      INSERT INTO reservas_platos (nombre_cliente, producto_id, cantidad, fecha, hora)
      VALUES (${nombre_cliente}, ${producto_id}, ${cantidad}, ${fecha || new Date().toISOString().split('T')[0]}, ${hora || null}::time)
      RETURNING *
    `;

    return new Response(JSON.stringify({ reserva: result[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al crear reserva' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { id, estado } = await request.json();
    const result = await sql`
      UPDATE reservas_platos SET estado = ${estado}::estado_reserva WHERE id = ${id} RETURNING *
    `;
    return new Response(JSON.stringify({ reserva: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al actualizar' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
