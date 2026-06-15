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

  const mesas = await sql`SELECT * FROM mesas ORDER BY piso ASC, numero_mesa ASC`;
  return new Response(JSON.stringify({ mesas, server_time: new Date().toISOString() }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const PUT: APIRoute = async ({ request }) => {
  const session = checkAuth(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { id, estado, tomada_por } = await request.json();
    const validStates = ['libre', 'ocupada', 'esperando_pago'];

    if (!id || !validStates.includes(estado)) {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const garzonNombre = tomada_por || session.nombre;

    let result;
    if (estado === 'ocupada') {
      result = await sql`
        UPDATE mesas
        SET estado = ${estado}::estado_mesa,
            tomada_por = ${garzonNombre},
            tomada_desde = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      result = await sql`
        UPDATE mesas
        SET estado = ${estado}::estado_mesa,
            tomada_por = NULL,
            tomada_desde = NULL
        WHERE id = ${id}
        RETURNING *
      `;
    }

    return new Response(JSON.stringify({ mesa: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error PUT mesas:', error);
    return new Response(JSON.stringify({ error: 'Error al actualizar mesa' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
