export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

const checkAdmin = (request: Request) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return null;
  }
  return session;
};

export const GET: APIRoute = async ({ request }) => {
  const session = checkAdmin(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const categorias = await sql`
      SELECT c.*, COUNT(p.id)::int AS total_productos
      FROM categorias c
      LEFT JOIN productos p ON p.categoria_id = c.id
      GROUP BY c.id
      ORDER BY c.orden ASC, c.nombre ASC
    `;

    return new Response(JSON.stringify({ categorias }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al cargar categorías' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const session = checkAdmin(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { nombre, orden } = await request.json();

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return new Response(JSON.stringify({ error: 'El nombre es requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let ordenFinal = typeof orden === 'number' && orden > 0 ? orden : null;
    if (ordenFinal === null) {
      const max = await sql`SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM categorias`;
      ordenFinal = max[0].siguiente;
    }

    const result = await sql`
      INSERT INTO categorias (nombre, orden)
      VALUES (${nombre.trim()}, ${ordenFinal})
      RETURNING *
    `;

    return new Response(JSON.stringify({ categoria: result[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    if (error?.code === '23505') {
      return new Response(JSON.stringify({ error: 'Ya existe una categoría con ese nombre' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Error al crear categoría' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const session = checkAdmin(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Protección: no eliminar categorías con productos asociados
    const count = await sql`SELECT COUNT(*)::int AS total FROM productos WHERE categoria_id = ${parsedId}`;
    if (count[0].total > 0) {
      return new Response(
        JSON.stringify({ error: `No se puede eliminar: la categoría tiene ${count[0].total} producto(s). Elimina o reasigna los productos primero.` }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await sql`DELETE FROM categorias WHERE id = ${parsedId} RETURNING id`;
    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Categoría no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al eliminar categoría' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
