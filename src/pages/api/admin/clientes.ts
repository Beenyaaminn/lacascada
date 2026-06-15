export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

const checkAdmin = (request: Request) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || session.rol !== 'admin') return null;
  return session;
};

export const GET: APIRoute = async ({ request }) => {
  if (!checkAdmin(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const clientes = await sql`SELECT * FROM clientes_credito ORDER BY nombre ASC`;
  return new Response(JSON.stringify({ clientes }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  if (!checkAdmin(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { nombre, rut_o_telefono, limite_credito } = await request.json();

    if (!nombre || !rut_o_telefono) {
      return new Response(JSON.stringify({ error: 'Nombre y RUT/teléfono requeridos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      INSERT INTO clientes_credito (nombre, rut_o_telefono, limite_credito, saldo_deudor)
      VALUES (${nombre}, ${rut_o_telefono}, ${limite_credito || 0}, 0)
      RETURNING *
    `;

    return new Response(JSON.stringify({ cliente: result[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    if (error.message?.includes('unique')) {
      return new Response(JSON.stringify({ error: 'El RUT o teléfono ya está registrado' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Error al crear cliente' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!checkAdmin(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { id, nombre, rut_o_telefono, limite_credito, activo } = await request.json();
    const result = await sql`
      UPDATE clientes_credito SET
        nombre = ${nombre},
        rut_o_telefono = ${rut_o_telefono},
        limite_credito = ${limite_credito},
        activo = ${activo !== false}
      WHERE id = ${id}
      RETURNING *
    `;
    return new Response(JSON.stringify({ cliente: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al actualizar' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
