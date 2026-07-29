import jwt from 'jsonwebtoken';
import type { Usuario, RolUsuario } from './types';

const JWT_SECRET = import.meta.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurada en las variables de entorno');
}
const TOKEN_EXPIRY = '8h';

export interface JWTPayload {
  id: number;
  email: string;
  nombre: string;
  rol: RolUsuario;
}

export function signToken(user: Usuario): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JWTPayload;
  } catch {
    return null;
  }
}

export function getSessionFromCookie(cookieHeader: string | null): JWTPayload | null {
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  const token = cookies['lacascada_token'];
  if (!token) return null;

  return verifyToken(token);
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((pair) => {
    const [key, ...val] = pair.trim().split('=');
    if (key) {
      cookies[key] = decodeURIComponent(val.join('='));
    }
  });
  return cookies;
}

export function requireAuth(context: { cookies: { get: (name: string) => { value: string } | undefined }; redirect: (path: string) => Response }) {
  const token = context.cookies.get('lacascada_token')?.value;
  if (!token) {
    return context.redirect('/login');
  }
  const payload = verifyToken(token);
  if (!payload) {
    return context.redirect('/login');
  }
  return payload;
}

export function requireRole(payload: JWTPayload | null, roles: RolUsuario[]): boolean {
  if (!payload) return false;
  return roles.includes(payload.rol);
}
