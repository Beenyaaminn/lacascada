export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { piso, mesa_numero } = await request.json();

    if (!piso || !mesa_numero) {
      return new Response(JSON.stringify({ error: 'Piso y número de mesa requeridos' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await sql.begin(async (tx) => {
      const mesa = await tx`
        SELECT id, estado FROM mesas
        WHERE piso = ${piso} AND numero_mesa = ${mesa_numero}
        LIMIT 1
      `;
      if (mesa.length === 0) return null;

      const mesaId = mesa[0].id;
      const estabaLibre = mesa[0].estado === 'libre';

      const updated = await tx`
        UPDATE mesas
        SET estado = 'ocupada', tomada_desde = COALESCE(tomada_desde, NOW())
        WHERE id = ${mesaId}
        RETURNING id, estado, tomada_desde
      `;

      if (estabaLibre) {
        await tx`
          UPDATE pedidos
          SET estado = 'cancelado'
          WHERE mesa_id = ${mesaId}
            AND estado NOT IN ('pagado', 'cancelado')
        `;
      }

      return updated[0];
    });

    if (!result) {
      return new Response(JSON.stringify({ error: 'Mesa no encontrada' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ mesa: result }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error ocupando mesa:', error);
    return new Response(JSON.stringify({ error: 'Error al ocupar mesa' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
