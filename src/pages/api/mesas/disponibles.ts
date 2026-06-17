export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async () => {
  try {
    const mesas = await sql`
      SELECT id, numero_mesa, piso, estado
      FROM mesas
      ORDER BY piso ASC, numero_mesa ASC
    `;
    return new Response(JSON.stringify({ mesas }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error mesas publicas:', error);
    return new Response(JSON.stringify({ error: 'Error al cargar mesas' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
