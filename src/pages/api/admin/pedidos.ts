export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';
import { registrarAuditoria } from '../../../lib/audit';
import { logError } from '../../../lib/logger';

const checkAuth = (request: Request) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return null;
  }
  return session;
};

// Transiciones permitidas del estado de un pedido.
// 'pagado' solo se alcanza a través de /api/pagos.
const TRANSICIONES: Record<string, string[]> = {
  pendiente: ['en_preparacion', 'cancelado'],
  en_preparacion: ['entregado', 'cancelado'],
  entregado: ['cancelado'],
  pagado: [],
  cancelado: [],
};

export const GET: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const url = new URL(request.url);
    const estados = url.searchParams.getAll('estado');
    const desde = url.searchParams.get('desde');
    const tipoPedido = url.searchParams.get('tipo');

    const validEstados = ['pendiente', 'en_preparacion', 'entregado', 'pagado', 'cancelado'];
    const estadosFiltrados = estados.filter(e => validEstados.includes(e));
    const desdeValido = desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : null;
    const tipoValido = tipoPedido && ['mesa', 'delivery', 'retiro', 'reserva'].includes(tipoPedido) ? tipoPedido : null;

    let pedidos;
    if (estadosFiltrados.length > 0 && tipoValido) {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.estado = ANY(${estadosFiltrados}::estado_pedido[])
          AND p.tipo_pedido = ${tipoValido}::tipo_pedido
        ORDER BY p.fecha_hora DESC
      `;
    } else if (estadosFiltrados.length > 0) {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.estado = ANY(${estadosFiltrados}::estado_pedido[])
        ORDER BY p.fecha_hora DESC
      `;
    } else if (desdeValido && tipoValido) {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.fecha_hora >= ${desdeValido}::date
          AND p.tipo_pedido = ${tipoValido}::tipo_pedido
        ORDER BY p.fecha_hora DESC
      `;
    } else if (desdeValido) {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.fecha_hora >= ${desdeValido}::date
        ORDER BY p.fecha_hora DESC
      `;
    } else if (tipoValido) {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.tipo_pedido = ${tipoValido}::tipo_pedido
        ORDER BY p.fecha_hora DESC
      `;
    } else {
      pedidos = await sql`
        SELECT p.*, m.numero_mesa as mesa_numero, m.piso as mesa_piso, m.tomada_por
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        ORDER BY p.fecha_hora DESC
      `;
    }

    return new Response(JSON.stringify({ pedidos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    logError('Cargando pedidos', error);
    return new Response(JSON.stringify({ error: 'Error al cargar pedidos' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request, clientAddress }) => {
  const session = checkAuth(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const ip = clientAddress || request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || '';

  try {
    const { id, estado } = await request.json();
    const pedidoId = Number(id);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0 || typeof estado !== 'string') {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const actual = await sql`SELECT id, estado, mesa_id FROM pedidos WHERE id = ${pedidoId} LIMIT 1`;
    if (actual.length === 0) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const estadoActual = actual[0].estado;
    const permitidas = TRANSICIONES[estadoActual] || [];

    if (estado === 'pagado') {
      return new Response(JSON.stringify({ error: 'El pago debe procesarse desde la caja (módulo de pagos)' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!permitidas.includes(estado)) {
      return new Response(JSON.stringify({ error: `No se puede cambiar de "${estadoActual.replace(/_/g, ' ')}" a "${estado.replace(/_/g, ' ')}"` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Guard optimista: solo cambia si el estado sigue siendo el esperado
    const result = await sql`
      UPDATE pedidos SET estado = ${estado}::estado_pedido
      WHERE id = ${pedidoId} AND estado = ${estadoActual}::estado_pedido
      RETURNING *
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'El pedido cambió de estado. Recarga la lista.' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    // Al cancelar: restaurar stock reservado
    if (estado === 'cancelado') {
      await sql`
        UPDATE productos SET stock_actual = stock_actual + dp.cantidad
        FROM detalle_pedidos dp
        WHERE dp.pedido_id = ${pedidoId}
          AND productos.id = dp.producto_id
          AND productos.maneja_stock = TRUE
      `;
    }

    // Liberar mesa si no quedan pedidos activos
    if (estado === 'cancelado' && actual[0].mesa_id) {
      const pendientes = await sql`
        SELECT COUNT(*)::int as cnt FROM pedidos
        WHERE mesa_id = ${actual[0].mesa_id} AND estado NOT IN ('pagado', 'cancelado')
      `;
      if (pendientes[0].cnt === 0) {
        await sql`UPDATE mesas SET estado = 'libre', tomada_por = NULL, tomada_desde = NULL WHERE id = ${actual[0].mesa_id}`;
      }
    }

    await registrarAuditoria('PEDIDO_ESTADO', 'pedidos', pedidoId, session.nombre,
      `${estadoActual} → ${estado}`, ip);

    return new Response(JSON.stringify({ pedido: result[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    logError('Actualizando pedido', error);
    return new Response(JSON.stringify({ error: 'Error al actualizar pedido' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
