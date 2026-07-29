export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';
import { logError } from '../../../lib/logger';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { piso, mesa_numero } = await request.json();

    if (!Number.isInteger(piso) || !Number.isInteger(mesa_numero)) {
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

    const session = getSessionFromCookie(request.headers.get('cookie'));
    const esStaff = session && (session.rol === 'admin' || session.rol === 'garzon');
    const esAutoservicio = mesa[0].tomada_por === null;

    // Sin sesión de staff solo se puede liberar una mesa de autoservicio
    // Y SOLO si no tiene pedidos activos (evita cancelaciones encadenadas de pedidos ajenos)
    if (!esStaff) {
      if (!esAutoservicio) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      const activos = await sql`
        SELECT COUNT(*)::int as cnt FROM pedidos
        WHERE mesa_id = ${mesa[0].id} AND estado NOT IN ('pagado', 'cancelado')
      `;
      if (activos[0].cnt > 0) {
        return new Response(JSON.stringify({ error: 'La mesa tiene pedidos activos. Pide al garzón que la libere.' }), {
          status: 409, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const result = await sql`
      UPDATE mesas
      SET estado = 'libre', tomada_por = NULL, tomada_desde = NULL
      WHERE id = ${mesa[0].id} AND estado = 'ocupada'
      RETURNING id
    `;

    return new Response(JSON.stringify({ liberada: result.length > 0 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError('Liberando mesa', error);
    return new Response(JSON.stringify({ error: 'Error al liberar mesa' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
