export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

const checkAdmin = (request: Request) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || session.rol !== 'admin') return null;
  return session;
};

export const GET: APIRoute = async ({ request }) => {
  if (!checkAdmin(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const usuarios = await sql`
      SELECT id, nombre, email, rol, created_at FROM usuarios ORDER BY nombre ASC
    `;
    return new Response(JSON.stringify({ usuarios }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error usuarios:', error);
    return new Response(JSON.stringify({ error: 'Error al cargar usuarios' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!checkAdmin(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const { nombre, email, password, rol } = await request.json();
    if (!nombre || !email || !password || !rol) {
      return new Response(JSON.stringify({ error: 'Todos los campos son obligatorios' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!['admin', 'garzon'].includes(rol)) {
      return new Response(JSON.stringify({ error: 'Rol inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Formato de email inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const existente = await sql`SELECT id FROM usuarios WHERE email = ${email} LIMIT 1`;
    if (existente.length > 0) {
      return new Response(JSON.stringify({ error: 'Ya existe un usuario con ese email' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (${nombre}, ${email}, ${hash}, ${rol}) RETURNING id, nombre, email, rol, created_at
    `;
    return new Response(JSON.stringify({ usuario: result[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error crear usuario:', error);
    return new Response(JSON.stringify({ error: 'Error al crear usuario' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!checkAdmin(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const { id, nombre, email, rol, password } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (rol && !['admin', 'garzon', 'cliente'].includes(rol)) {
      return new Response(JSON.stringify({ error: 'Rol inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (password) {
      if (password.length < 8) {
        return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const hash = await bcrypt.hash(password, 10);
      const result = await sql`
        UPDATE usuarios SET nombre = ${nombre}, email = ${email}, rol = ${rol}, password_hash = ${hash} WHERE id = ${id} RETURNING id, nombre, email, rol, created_at
      `;
      if (result.length === 0) {
        return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ usuario: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const result = await sql`
      UPDATE usuarios SET nombre = COALESCE(${nombre}, nombre), email = COALESCE(${email}, email), rol = COALESCE(${rol}::rol_usuario, rol) WHERE id = ${id} RETURNING id, nombre, email, rol, created_at
    `;
    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ usuario: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error actualizar usuario:', error);
    return new Response(JSON.stringify({ error: 'Error al actualizar' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
