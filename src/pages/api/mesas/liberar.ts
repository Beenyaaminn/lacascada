export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { piso, mesa_numero } = await request.json();

    if (!piso || !mesa_numero) {
      return new Response(JSON.stringify({ error: 'Piso y número de mesa requeridos' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await sql`
      UPDATE mesas
      SET estado = 'libre', tomada_por = NULL, tomada_desde = NULL
      WHERE piso = ${piso} AND numero_mesa = ${mesa_numero}
        AND estado = 'ocupada'
        AND tomada_por IS NULL
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
