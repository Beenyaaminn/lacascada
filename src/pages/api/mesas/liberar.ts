export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { piso, mesa_numero } = await request.json();

    if (!piso || !mesa_numero) {
      return new Response(JSON.stringify({ error: 'Piso y número de mesa requeridos' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const mesa = await sql`
      SELECT id, tomada_por FROM mesas
      WHERE piso = ${piso} AND numero_mesa = ${mesa_numero} AND estado = 'ocupada'
      LIMIT 1
    `;

    if (mesa.length === 0) {
      return new Response(JSON.stringify({ liberada: false }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const esAutoservicio = mesa[0].tomada_por === null;
    const session = getSessionFromCookie(request.headers.get('cookie'));
    const esStaff = session && (session.rol === 'admin' || session.rol === 'garzon');

    if (!esAutoservicio && !esStaff) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      UPDATE mesas
      SET estado = 'libre', tomada_por = NULL, tomada_desde = NULL
      WHERE id = ${mesa[0].id}
      RETURNING id
    `;

    return new Response(JSON.stringify({ liberada: result.length > 0 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error liberando mesa:', error);
    return new Response(JSON.stringify({ error: 'Error al liberar mesa' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
