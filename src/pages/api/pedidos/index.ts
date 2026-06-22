export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { registrarAuditoria } from '../../../lib/audit';
import { checkRateLimit } from '../../../lib/ratelimit';
import { logError } from '../../../lib/logger';

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get('x-forwarded-for') || '0.0.0.0';

  const rl = checkRateLimit(`pedidos:${ip}`, 20, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Demasiados pedidos. Intente de nuevo.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const { piso, mesa: mesaNumero, items, total, nombre_cliente, comentarios } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'El pedido debe tener al menos un producto' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const mesaResult = await sql`
      SELECT id, estado FROM mesas WHERE numero_mesa = ${mesaNumero} AND piso = ${piso} LIMIT 1
    `;
    if (mesaResult.length === 0) {
      return new Response(JSON.stringify({ error: 'Mesa no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const mesaId = mesaResult[0].id;

    let calculatedTotal = 0;
    for (const item of items) {
      const prod = await sql`SELECT id, nombre, maneja_stock, stock_actual FROM productos WHERE id = ${item.producto_id} LIMIT 1`;
      if (prod.length === 0) {
        return new Response(JSON.stringify({ error: `Producto #${item.producto_id} no encontrado` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const cantidad = item.cantidad || 1;
      if (cantidad < 1 || cantidad > 99) {
        return new Response(JSON.stringify({ error: `Cantidad inválida (1-99) para ${prod[0].nombre}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (prod[0].maneja_stock && prod[0].stock_actual < cantidad) {
        return new Response(JSON.stringify({ error: `Stock insuficiente: ${prod[0].nombre} (disponible: ${prod[0].stock_actual})` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (typeof item.subtotal !== 'number' || item.subtotal < 0) {
        return new Response(JSON.stringify({ error: `Subtotal inválido para ${prod[0].nombre}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      calculatedTotal += item.subtotal;
    }

    if (typeof total !== 'number' || total < 0 || Math.abs(total - calculatedTotal) > Math.max(calculatedTotal * 0.01, 1)) {
      return new Response(JSON.stringify({ error: `Total inválido. Esperado: $${calculatedTotal}, Recibido: $${total}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await sql.begin(async (tx) => {
      const mesaInfo = await tx`SELECT estado FROM mesas WHERE id = ${mesaId} LIMIT 1`;
      const estabaVacia = mesaInfo.length > 0 && mesaInfo[0].estado === 'libre';

      const pedido = await tx`
        INSERT INTO pedidos (mesa_id, tipo_pedido, estado, total, nombre_cliente, comentarios)
        VALUES (${mesaId}, 'mesa', 'pendiente', ${total}, ${nombre_cliente || null}, ${comentarios || null})
        RETURNING id, fecha_hora
      `;
      const pedidoId = pedido[0].id;

      for (const item of items) {
        await tx`
          INSERT INTO detalle_pedidos (pedido_id, producto_id, acompanamiento, cantidad, subtotal)
          VALUES (${pedidoId}, ${item.producto_id}, ${item.acompanamiento || null}, ${item.cantidad || 1}, ${item.subtotal})
        `;
      }

      if (estabaVacia) {
        await tx`
          UPDATE pedidos SET estado = 'cancelado'
          WHERE mesa_id = ${mesaId}
            AND estado NOT IN ('pagado', 'cancelado')
            AND id != ${pedidoId}
        `;
        await tx`
          UPDATE mesas SET estado = 'ocupada', tomada_desde = NOW() WHERE id = ${mesaId}
        `;
      }

      return pedidoId;
    });

    const pedidoId = result;

    await registrarAuditoria('PEDIDO_CREADO', 'pedidos', pedidoId, 'cliente',
      `Mesa #${mesaId} | ${items.length} items | Total: $${total}`, ip);

    return new Response(JSON.stringify({ success: true, pedido_id: pedidoId, fecha_hora: new Date().toISOString() }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError('Creando pedido', error);
    return new Response(JSON.stringify({ error: 'Error al crear el pedido' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
