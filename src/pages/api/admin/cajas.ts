export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';
import { registrarAuditoria } from '../../../lib/audit';

const checkAuth = (request: Request) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) return null;
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
      cajas = await sql`
        SELECT c.*
        FROM cajas c
        WHERE c.estado = 'abierta'
        ORDER BY c.abierta_desde DESC
      `;
      for (const c of cajas) {
        const pagos = await sql`
          SELECT COALESCE(SUM(total), 0)::int as total_efectivo
          FROM pedidos
          WHERE estado = 'pagado'
            AND metodo_pago = 'efectivo'
            AND fecha_hora >= ${c.abierta_desde}
        `;
        c.efectivo_esperado = (c.efectivo_inicial || 0) + (pagos[0]?.total_efectivo || 0);
      }
    } else {
      cajas = await sql`
        SELECT c.*
        FROM cajas c
        ORDER BY c.abierta_desde DESC
        LIMIT 20
      `;
    }
  } catch (error) {
    console.error('Error GET cajas:', error);
    return new Response(JSON.stringify({ error: 'Error al cargar cajas' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ cajas }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const session = checkAuth(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { efectivo_inicial, comentarios } = await request.json();

    const cajaAbierta = await sql`SELECT id FROM cajas WHERE estado = 'abierta' LIMIT 1`;
    if (cajaAbierta.length > 0) {
      return new Response(JSON.stringify({ error: `Ya hay una caja abierta (#${cajaAbierta[0].id}). Ciérrela primero.` }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      INSERT INTO cajas (turno_id, nombre, usuario, efectivo_inicial, comentarios)
      VALUES (0, 'Caja Principal', ${session.nombre}, ${efectivo_inicial || 0}, ${comentarios || null})
      RETURNING *
    `;

    await registrarAuditoria('CAJA_ABIERTA', 'cajas', result[0].id, session.nombre,
      `Efectivo inicial: $${efectivo_inicial || 0}`);

    return new Response(JSON.stringify({ caja: result[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('POST cajas:', error);
    return new Response(JSON.stringify({ error: 'Error al abrir caja' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const session = checkAuth(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { id, estado, efectivo_final } = await request.json();
    if (!id || estado !== 'cerrada') {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      UPDATE cajas SET estado = 'cerrada', cerrada_desde = NOW(), efectivo_final = ${efectivo_final || 0}
      WHERE id = ${id} AND estado = 'abierta'
      RETURNING *
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Caja no encontrada o ya está cerrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    await registrarAuditoria('CAJA_CERRADA', 'cajas', id, session.nombre,
      `Efectivo final: $${efectivo_final || 0}`);

    return new Response(JSON.stringify({ caja: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('PUT cajas:', error);
    return new Response(JSON.stringify({ error: 'Error al cerrar caja' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
