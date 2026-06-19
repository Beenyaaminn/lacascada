export const prerender = false;

import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { sql } from '../../../lib/db';
import { signToken, getSessionFromCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.rol !== 'admin') {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { nombre, email, password, rol } = await request.json();

    if (!nombre || !email || !password || !rol) {
      return new Response(JSON.stringify({ error: 'Todos los campos son requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validRoles = ['admin', 'garzon'];
    if (!validRoles.includes(rol)) {
      return new Response(JSON.stringify({ error: 'Rol inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const existing = await sql`SELECT id FROM usuarios WHERE email = ${email} LIMIT 1`;
    if (existing.length > 0) {
      return new Response(JSON.stringify({ error: 'El email ya está registrado' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO usuarios (nombre, email, password_hash, rol)
      VALUES (${nombre}, ${email}, ${password_hash}, ${rol})
      RETURNING id, nombre, email, rol, created_at
    `;

    return new Response(JSON.stringify({ user: result[0] }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
