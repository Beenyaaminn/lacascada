export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';
import { registrarAuditoria } from '../../../lib/audit';
import { logError } from '../../../lib/logger';

const checkAuth = (request: Request) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) return null;
  return session;
};

// Abrir y cerrar caja es exclusivo del admin (los garzones solo consultan)
const checkAdmin = (request: Request) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || session.rol !== 'admin') return null;
  return session;
};

export const GET: APIRoute = async ({ request }) => {
  const session = checkAuth(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const url = new URL(request.url);
  const activa = url.searchParams.get('activa');

  let cajas;
  try {
    if (activa === '1') {
      // Una sola query con JOIN: efectivo esperado = inicial + pagos en efectivo atribuidos a esta caja
      cajas = await sql`
        SELECT c.*,
          (c.efectivo_inicial + COALESCE(SUM(p.total) FILTER (WHERE p.id IS NOT NULL), 0))::int as efectivo_esperado
        FROM cajas c
        LEFT JOIN pedidos p ON p.caja_id = c.id AND p.estado = 'pagado' AND p.metodo_pago = 'efectivo'
        WHERE c.estado = 'abierta'
        GROUP BY c.id
        ORDER BY c.abierta_desde DESC
      `;
    } else {
      cajas = await sql`
        SELECT c.*
        FROM cajas c
        ORDER BY c.abierta_desde DESC
        LIMIT 20
      `;
    }
  } catch (error) {
    logError('GET cajas', error);
    return new Response(JSON.stringify({ error: 'Error al cargar cajas' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ cajas }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const session = checkAdmin(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Solo el administrador puede abrir caja' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { efectivo_inicial, comentarios } = await request.json();

    const inicial = Number(efectivo_inicial);
    if (!Number.isFinite(inicial) || inicial < 0) {
      return new Response(JSON.stringify({ error: 'El efectivo inicial debe ser un número mayor o igual a 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    try {
      // turno_id es NULL (la tabla turnos no se usa); el índice único parcial
      // uq_caja_abierta garantiza una sola caja abierta incluso con requests concurrentes
      const result = await sql`
        INSERT INTO cajas (turno_id, nombre, usuario, efectivo_inicial, comentarios)
        VALUES (NULL, 'Caja Principal', ${session.nombre}, ${inicial}, ${typeof comentarios === 'string' ? comentarios.slice(0, 500) : null})
        RETURNING *
      `;

      await registrarAuditoria('CAJA_ABIERTA', 'cajas', result[0].id, session.nombre,
        `Efectivo inicial: $${inicial}`);

      return new Response(JSON.stringify({ caja: result[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
      // Violación del índice único: ya hay una caja abierta
      if (e?.code === '23505') {
        const abierta = await sql`SELECT id FROM cajas WHERE estado = 'abierta' LIMIT 1`;
        return new Response(JSON.stringify({ error: `Ya hay una caja abierta (#${abierta[0]?.id || '?'}). Ciérrela primero.` }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
      throw e;
    }
  } catch (error) {
    logError('POST cajas', error);
    return new Response(JSON.stringify({ error: 'Error al abrir caja' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const session = checkAdmin(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Solo el administrador puede cerrar caja' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { id, estado, efectivo_final } = await request.json();
    const cajaId = Number(id);
    const final = Number(efectivo_final);

    if (!Number.isInteger(cajaId) || cajaId <= 0 || estado !== 'cerrada') {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!Number.isFinite(final) || final < 0) {
      return new Response(JSON.stringify({ error: 'El efectivo final debe ser un número mayor o igual a 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Cerrar y guardar snapshot del efectivo esperado (inicial + pagos efectivo de esta caja)
    const result = await sql`
      UPDATE cajas SET
        estado = 'cerrada',
        cerrada_desde = NOW(),
        efectivo_final = ${final},
        efectivo_esperado = (
          SELECT c.efectivo_inicial + COALESCE(SUM(p.total), 0)
          FROM cajas c
          LEFT JOIN pedidos p ON p.caja_id = c.id AND p.estado = 'pagado' AND p.metodo_pago = 'efectivo'
          WHERE c.id = ${cajaId}
          GROUP BY c.id
        )
      WHERE id = ${cajaId} AND estado = 'abierta'
      RETURNING *
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Caja no encontrada o ya está cerrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    await registrarAuditoria('CAJA_CERRADA', 'cajas', cajaId, session.nombre,
      `Efectivo final: $${final} | Esperado: $${result[0].efectivo_esperado ?? 0}`);

    return new Response(JSON.stringify({ caja: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    logError('PUT cajas', error);
    return new Response(JSON.stringify({ error: 'Error al cerrar caja' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
