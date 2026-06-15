export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async () => {
  try {
    const categorias = await sql`
      SELECT * FROM categorias ORDER BY orden ASC
    `;

    const productos = await sql`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
      WHERE p.disponible_dia = TRUE
        AND (p.maneja_stock = FALSE OR p.stock_actual > 0)
      ORDER BY c.orden ASC, p.nombre ASC
    `;

    const acompanamientos = await sql`
      SELECT * FROM acompanamientos ORDER BY es_extra ASC, nombre ASC
    `;

    const productos_acompanamientos = await sql`
      SELECT * FROM productos_acompanamientos
    `;

    return new Response(
      JSON.stringify({
        categorias,
        productos,
        acompanamientos,
        productos_acompanamientos,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Menu API Error:', error);
    return new Response(JSON.stringify({ error: 'Error al cargar el menú', detail: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
