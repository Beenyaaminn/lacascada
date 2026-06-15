export const prerender = false;

import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { sql } from '../../../lib/db';
import { signToken } from '../../../lib/auth';
import { registrarAuditoria } from '../../../lib/audit';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  try {
    const data = await request.text();
    let email: string, password: string;
    try {
      const json = JSON.parse(data);
      email = json.email;
      password = json.password;
    } catch {
      const params = new URLSearchParams(data);
      email = params.get('email') || '';
      password = params.get('password') || '';
    }
    const ip = clientAddress || request.headers.get('x-forwarded-for') || '0.0.0.0';

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email y contraseña son requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const recientes = await sql`
      SELECT COUNT(*)::int as cnt FROM login_attempts
      WHERE email = ${email} AND exito = FALSE AND created_at > NOW() - INTERVAL '5 minutes'
    `;
    if (recientes[0].cnt >= 3) {
      return new Response(JSON.stringify({ error: 'Demasiados intentos. Espere 5 minutos.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const users = await sql`SELECT * FROM usuarios WHERE email = ${email} LIMIT 1`;

    if (users.length === 0) {
      await sql`INSERT INTO login_attempts (email, ip, exito) VALUES (${email}, ${ip}, FALSE)`;
      await registrarAuditoria('LOGIN_FALLIDO', 'usuarios', null, email, `Correo no encontrado: ${email}`, ip);
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await sql`INSERT INTO login_attempts (email, ip, exito) VALUES (${email}, ${ip}, FALSE)`;
      await registrarAuditoria('LOGIN_FALLIDO', 'usuarios', user.id, user.nombre, `Contraseña incorrecta`, ip);
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await sql`INSERT INTO login_attempts (email, ip, exito) VALUES (${email}, ${ip}, TRUE)`;
    await registrarAuditoria('LOGIN_EXITOSO', 'usuarios', user.id, user.nombre, `Rol: ${user.rol}`, ip);

    const token = signToken(user);
    cookies.set('lacascada_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    return new Response(
      JSON.stringify({
        user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
        redirect: user.rol === 'admin' || user.rol === 'garzon' ? '/admin' : '/menu',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
