export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { registrarAuditoria } from '../../../lib/audit';
import { checkRateLimit } from '../../../lib/ratelimit';
import { logError } from '../../../lib/logger';
import { calcularPedido, devolverStock, PricingError } from '../../../lib/pricing';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || '0.0.0.0';

  const rl = checkRateLimit(`pedidos:${ip}`, 20, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Demasiados pedidos. Intente de nuevo.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const { piso, mesa: mesaNumero, items, nombre_cliente, comentarios } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'El pedido debe tener al menos un producto' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!Number.isInteger(piso) || !Number.isInteger(mesaNumero)) {
      return new Response(JSON.stringify({ error: 'Mesa inválida' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const mesaResult = await sql`
      SELECT id, estado FROM mesas WHERE numero_mesa = ${mesaNumero} AND piso = ${piso} LIMIT 1
    `;
    if (mesaResult.length === 0) {
      return new Response(JSON.stringify({ error: 'Mesa no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const mesaId = mesaResult[0].id;

    // Guard de respaldo: sin caja abierta no se crean pedidos de mesa
    // (el bloqueo principal está en /api/admin/mesas/bloquear, al abrir la mesa)
    const cajaAbierta = await sql`SELECT id FROM cajas WHERE estado = 'abierta' LIMIT 1`;
    if (cajaAbierta.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay caja abierta. Abra un turno de caja antes de cobrar.' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    // Precios calculados 100% server-side (nunca confiar en el cliente)
    let calculado;
    try {
      calculado = await calcularPedido(items);
    } catch (e) {
      if (e instanceof PricingError) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      throw e;
    }

    try {
      // Claim atómico de la mesa: solo UNA petición concurrente logra tomar una mesa libre.
      const claim = await sql`
        UPDATE mesas SET estado = 'ocupada', tomada_desde = NOW()
        WHERE id = ${mesaId} AND estado = 'libre'
        RETURNING id
      `;
      const reclamoMesa = claim.length > 0;

      if (reclamoMesa) {
        // Solo el que reclamó la mesa cancela pedidos viejos sin pagar.
        // El umbral de 2 minutos protege pedidos recién creados por otros comensales
        // de la misma mesa en peticiones concurrentes.
        await sql`
          UPDATE pedidos SET estado = 'cancelado'
          WHERE mesa_id = ${mesaId}
            AND estado NOT IN ('pagado', 'cancelado')
            AND fecha_hora < NOW() - INTERVAL '2 minutes'
        `;
      }

      const pedido = await sql`
        INSERT INTO pedidos (mesa_id, tipo_pedido, estado, total, nombre_cliente, comentarios)
        VALUES (${mesaId}, 'mesa', 'pendiente', ${calculado.total}, ${typeof nombre_cliente === 'string' ? nombre_cliente.slice(0, 100) : null}, ${typeof comentarios === 'string' ? comentarios.slice(0, 500) : null})
        RETURNING id, fecha_hora
      `;
      const pedidoId = pedido[0].id;

      for (const item of calculado.items) {
        await sql`
          INSERT INTO detalle_pedidos (pedido_id, producto_id, acompanamiento, cantidad, subtotal)
          VALUES (${pedidoId}, ${item.producto_id}, ${item.acompanamiento}, ${item.cantidad}, ${item.subtotal})
        `;
      }

      await registrarAuditoria('PEDIDO_CREADO', 'pedidos', pedidoId, 'cliente',
        `Mesa #${mesaId} | ${calculado.items.length} items | Total: $${calculado.total}`, ip);

      return new Response(JSON.stringify({ success: true, pedido_id: pedidoId, fecha_hora: pedido[0].fecha_hora }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      // Si falla a mitad de camino, devolver el stock reservado
      await devolverStock(calculado.items);
      throw e;
    }
  } catch (error) {
    logError('Creando pedido', error);
    return new Response(JSON.stringify({ error: 'Error al crear el pedido' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
