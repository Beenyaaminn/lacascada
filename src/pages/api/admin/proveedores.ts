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

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';

  let proveedores;
  if (search) {
    proveedores = await sql`
      SELECT * FROM proveedores
      WHERE nombre ILIKE ${'%' + search + '%'}
      ORDER BY nombre ASC
    `;
  } else {
    proveedores = await sql`SELECT * FROM proveedores ORDER BY nombre ASC`;
  }

  return new Response(JSON.stringify({ proveedores }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { nombre, activo, contacto, telefono, email, direccion, notas } = await request.json();
    if (!nombre) {
      return new Response(JSON.stringify({ error: 'El nombre es requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      INSERT INTO proveedores (nombre, activo, contacto, telefono, email, direccion, notas)
      VALUES (${nombre}, ${activo ?? true}, ${contacto || null}, ${telefono || null}, ${email || null}, ${direccion || null}, ${notas || null})
      RETURNING *
    `;

    return new Response(JSON.stringify({ proveedor: result[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('POST proveedores:', error);
    return new Response(JSON.stringify({ error: 'Error al crear proveedor' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { id, nombre, activo, contacto, telefono, email, direccion, notas } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      UPDATE proveedores
      SET nombre = COALESCE(${nombre}, nombre),
          activo = COALESCE(${activo}, activo),
          contacto = ${contacto === undefined ? null : contacto},
          telefono = ${telefono === undefined ? null : telefono},
          email = ${email === undefined ? null : email},
          direccion = ${direccion === undefined ? null : direccion},
          notas = ${notas === undefined ? null : notas}
      WHERE id = ${id}
      RETURNING *
    `;

    return new Response(JSON.stringify({ proveedor: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('PUT proveedores:', error);
    return new Response(JSON.stringify({ error: 'Error al actualizar' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await sql`DELETE FROM proveedores WHERE id = ${id}`;
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al eliminar' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
