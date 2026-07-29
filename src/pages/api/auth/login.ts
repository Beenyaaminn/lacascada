export const prerender = false;

import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import { sql } from '../../../lib/db';
import { signToken } from '../../../lib/auth';
import { registrarAuditoria } from '../../../lib/audit';
import { logError } from '../../../lib/logger';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  try {
    const data = await request.text();
    let login: string, password: string;
    try {
      const json = JSON.parse(data);
      login = json.email || json.login || '';
      password = json.password;
    } catch {
      const params = new URLSearchParams(data);
      login = params.get('email') || params.get('login') || '';
      password = params.get('password') || '';
    }
    const ip = clientAddress || request.headers.get('x-forwarded-for') || '0.0.0.0';

    if (!login || !password) {
      return new Response(JSON.stringify({ error: 'Usuario/correo y contraseña son requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const recientes = await sql`
      SELECT COUNT(*)::int as cnt FROM login_attempts
      WHERE email = ${login} AND exito = FALSE AND created_at > NOW() - INTERVAL '5 minutes'
    `;
    if (recientes[0].cnt >= 3) {
      return new Response(JSON.stringify({ error: 'Demasiados intentos. Espere 5 minutos.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const users = await sql`SELECT * FROM usuarios WHERE email = ${login} OR nombre = ${login} LIMIT 1`;

    // Comparación dummy para igualar tiempos de respuesta (evita enumerar usuarios por timing)
    const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    const user = users[0] || null;
    const validPassword = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user) {
      await sql`INSERT INTO login_attempts (email, ip, exito) VALUES (${login}, ${ip}, FALSE)`;
      await registrarAuditoria('LOGIN_FALLIDO', 'usuarios', null, login, `Usuario no encontrado: ${login}`, ip);
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!validPassword) {
      await sql`INSERT INTO login_attempts (email, ip, exito) VALUES (${login}, ${ip}, FALSE)`;
      await registrarAuditoria('LOGIN_FALLIDO', 'usuarios', user.id, user.nombre, `Contraseña incorrecta`, ip);
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await sql`INSERT INTO login_attempts (email, ip, exito) VALUES (${login}, ${ip}, TRUE)`;
    await registrarAuditoria('LOGIN_EXITOSO', 'usuarios', user.id, user.nombre, `Rol: ${user.rol}`, ip);

    const token = signToken(user);
    cookies.set('lacascada_token', token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
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
    logError('Login', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
