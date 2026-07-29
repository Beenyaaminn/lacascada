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

  try {
    const reservas = await sql`
      SELECT r.*, m.numero_mesa, m.piso
      FROM reservas_platos r
      LEFT JOIN mesas m ON r.mesa_id = m.id
      ORDER BY r.fecha DESC, r.hora ASC NULLS LAST
    `;

    const result = reservas.map(r => ({
      ...r,
      mesa_info: r.numero_mesa ? `P${r.piso} M${r.numero_mesa}` : null,
    }));

    return new Response(JSON.stringify({ reservas: result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error GET reservas:', error);
    return new Response(JSON.stringify({ error: 'Error al cargar reservas' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { nombre_cliente, comensales, fecha, hora } = await request.json();

    if (!nombre_cliente) {
      return new Response(JSON.stringify({ error: 'El nombre del cliente es requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const cant = typeof comensales === 'number' && comensales >= 1 ? comensales : 1;

    const result = await sql`
      INSERT INTO reservas_platos (nombre_cliente, producto_id, cantidad, fecha, hora, estado)
      VALUES (${nombre_cliente}, NULL, ${cant}, ${fecha || new Date().toISOString().split('T')[0]}, ${hora || null}::time, 'pendiente')
      RETURNING *
    `;

    return new Response(JSON.stringify({ reserva: result[0] }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al crear reserva' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { id, estado, mesa_id } = await request.json();
    const reservaId = Number(id);
    const validStates = ['pendiente', 'confirmada', 'cancelada'];
    if (!Number.isInteger(reservaId) || reservaId <= 0 || !validStates.includes(estado)) {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    let result;
    if (mesa_id) {
      const mesaId = Number(mesa_id);
      if (!Number.isInteger(mesaId) || mesaId <= 0) {
        return new Response(JSON.stringify({ error: 'Mesa inválida' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      result = await sql`
        UPDATE reservas_platos SET estado = ${estado}::estado_reserva, mesa_id = ${mesaId} WHERE id = ${reservaId} RETURNING *
      `;
      if (result.length > 0) {
        const nombre = result[0].nombre_cliente;
        const fechaReserva = result[0].fecha;
        // Vincular solo pedidos de reserva del mismo día, sin mesa asignada y no finalizados.
        // Evita mezclar clientes distintos que comparten nombre.
        await sql`
          UPDATE pedidos SET mesa_id = ${mesaId}
          WHERE id IN (
            SELECT p.id FROM pedidos p
            WHERE p.tipo_pedido = 'reserva'
              AND p.nombre_cliente = ${nombre}
              AND p.mesa_id IS NULL
              AND p.estado NOT IN ('pagado', 'cancelado')
              AND p.fecha_hora::date = ${fechaReserva}::date
          )
        `;
      }
    } else {
      result = await sql`
        UPDATE reservas_platos SET estado = ${estado}::estado_reserva WHERE id = ${reservaId} RETURNING *
      `;
    }
    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Reserva no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ reserva: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al actualizar' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
