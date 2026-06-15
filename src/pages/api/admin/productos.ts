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
    const productos = await sql`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
      ORDER BY c.orden ASC, p.nombre ASC
    `;

    return new Response(JSON.stringify({ productos }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al cargar productos' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const session = checkAdmin(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, stock_actual, disponible_dia, imagen_url } = await request.json();

    if (!categoria_id || !nombre || precio === undefined) {
      return new Response(JSON.stringify({ error: 'Categoría, nombre y precio son requeridos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      INSERT INTO productos (categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, stock_actual, disponible_dia, imagen_url)
      VALUES (${categoria_id}, ${nombre}, ${descripcion || null}, ${precio}, ${ingredientes || null}, ${maneja_stock || false}, ${stock_actual || 0}, ${disponible_dia !== false}, ${imagen_url || null})
      RETURNING *
    `;

    return new Response(JSON.stringify({ producto: result[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al crear producto' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const session = checkAdmin(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { id, categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, stock_actual, disponible_dia, imagen_url } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      UPDATE productos SET
        categoria_id = ${categoria_id},
        nombre = ${nombre},
        descripcion = ${descripcion || null},
        precio = ${precio},
        ingredientes = ${ingredientes || null},
        maneja_stock = ${maneja_stock || false},
        stock_actual = ${stock_actual || 0},
        disponible_dia = ${disponible_dia !== false},
        imagen_url = ${imagen_url || null}
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Producto no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ producto: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al actualizar producto' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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

    await sql`DELETE FROM productos WHERE id = ${parseInt(id)}`;

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al eliminar producto' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
