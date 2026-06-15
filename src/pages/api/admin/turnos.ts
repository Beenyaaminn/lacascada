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
  const fecha = url.searchParams.get('fecha') || new Date().toISOString().split('T')[0];
  const activo = url.searchParams.get('activo');

  let turnos;
  if (activo === '1') {
    turnos = await sql`
      SELECT * FROM turnos WHERE estado = 'abierto' ORDER BY abierto_desde DESC
    `;
  } else {
    turnos = await sql`
      SELECT * FROM turnos WHERE fecha = ${fecha}::date ORDER BY abierto_desde DESC
    `;
  }

  return new Response(JSON.stringify({ turnos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const session = checkAuth(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { tipo_turno, comentarios, solo_hoy } = await request.json();
    if (!tipo_turno || !['manana', 'medio_dia', 'noche'].includes(tipo_turno)) {
      return new Response(JSON.stringify({ error: 'Tipo de turno inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const hoy = new Date().toISOString().split('T')[0];

    let existente;
    if (solo_hoy) {
      existente = await sql`
        SELECT id, tipo_turno FROM turnos
        WHERE tipo_turno = ${tipo_turno} AND estado = 'abierto' AND fecha = ${hoy}::date
        LIMIT 1
      `;
    } else {
      existente = await sql`
        SELECT id, tipo_turno FROM turnos
        WHERE tipo_turno = ${tipo_turno} AND estado = 'abierto'
        LIMIT 1
      `;
    }

    if (existente.length > 0) {
      return new Response(JSON.stringify({
        error: `Ya existe un turno de ${tipoLabel(tipo_turno)} abierto (#${existente[0].id}). No se puede abrir otro.`,
        turno_existente: existente[0],
      }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      INSERT INTO turnos (tipo_turno, fecha, estado, comentarios, abierto_por)
      VALUES (${tipo_turno}, ${hoy}::date, 'abierto', ${comentarios || null}, ${session.nombre})
      RETURNING *
    `;

    await registrarAuditoria('TURNO_ABIERTO', 'turnos', result[0].id, session.nombre,
      `Tipo: ${tipoLabel(tipo_turno)} | Fecha: ${hoy}`);

    return new Response(JSON.stringify({ turno: result[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('POST turnos:', error);
    return new Response(JSON.stringify({ error: 'Error al abrir turno' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

function tipoLabel(t: string): string {
  if (t === 'manana') return 'Mañana';
  if (t === 'medio_dia') return 'Medio Día';
  if (t === 'noche') return 'Noche';
  return t;
}

export const PUT: APIRoute = async ({ request }) => {
  const session = checkAuth(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { id, estado } = await request.json();
    if (!id || estado !== 'cerrado') {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql`
      UPDATE turnos SET estado = 'cerrado', cerrado_desde = NOW()
      WHERE id = ${id} AND estado = 'abierto'
      RETURNING *
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Turno no encontrado o ya está cerrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    await registrarAuditoria('TURNO_CERRADO', 'turnos', id, session.nombre, `Turno #${id} cerrado`);

    return new Response(JSON.stringify({ turno: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('PUT turnos:', error);
    return new Response(JSON.stringify({ error: 'Error al cerrar turno' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
