export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { registrarAuditoria } from '../../../lib/audit';
import { checkRateLimit } from '../../../lib/ratelimit';
import { logError } from '../../../lib/logger';
import { calcularPedido, devolverStock, getCostoEnvio, COSTO_ZONAS, PricingError } from '../../../lib/pricing';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || '0.0.0.0';

  const rl = checkRateLimit(`delivery:${ip}`, 10, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Demasiados pedidos. Intente de nuevo.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const {
      nombre, direccion, telefono, metodo_pago,
      efectivo_con_cuanto, items, tipo, zona, hora_reserva
    } = await request.json();

    const esRetiro = tipo === 'retiro';
    const esReserva = tipo === 'reserva';

    if (typeof nombre !== 'string' || !nombre.trim() || typeof telefono !== 'string' || !telefono.trim()) {
      return new Response(JSON.stringify({ error: 'Nombre y teléfono son obligatorios' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!esRetiro && !esReserva && (typeof direccion !== 'string' || !direccion.trim())) {
      return new Response(JSON.stringify({ error: 'La dirección es obligatoria' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!esRetiro && !esReserva && zona && !(zona in COSTO_ZONAS)) {
      return new Response(JSON.stringify({ error: 'Zona de delivery inválida' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'El pedido debe tener al menos un producto' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!metodo_pago || !['efectivo', 'debito', 'credito'].includes(metodo_pago)) {
      return new Response(JSON.stringify({ error: 'Método de pago inválido' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Costo de envío calculado server-side (nunca confiar en el cliente)
    const envio = esRetiro || esReserva ? 0 : getCostoEnvio(zona);

    // Precios calculados 100% server-side
    let calculado;
    try {
      calculado = await calcularPedido(items);
    } catch (e) {
      if (e instanceof PricingError) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      throw e;
    }
    const total = calculado.total + envio;

    if (metodo_pago === 'efectivo') {
      const ef = Number(efectivo_con_cuanto);
      if (!Number.isFinite(ef) || ef < total) {
        return new Response(JSON.stringify({ error: `El monto en efectivo ($${Number.isFinite(ef) ? ef : 0}) debe ser igual o mayor al total ($${total})` }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const efConCuanto = metodo_pago === 'efectivo' ? Number(efectivo_con_cuanto) : 0;
    const dirFinal = esReserva
      ? (hora_reserva ? `Reserva - ${hora_reserva}` : String(direccion || 'Reserva').slice(0, 200))
      : (esRetiro ? 'Retiro en local' : (zona ? `[${zona}] ${String(direccion).slice(0, 200)}` : String(direccion).slice(0, 200)));
    const tipoPedido = esReserva ? 'reserva' : (esRetiro ? 'retiro' : 'delivery');

    try {
      const pedido = await sql`
        INSERT INTO pedidos (tipo_pedido, estado, total, nombre_cliente, direccion, telefono, efectivo_con_cuanto, costo_envio)
        VALUES (${tipoPedido}::tipo_pedido, 'pendiente', ${total}, ${nombre.trim().slice(0, 100)}, ${dirFinal}, ${telefono.trim().slice(0, 30)}, ${efConCuanto}, ${envio})
        RETURNING id, fecha_hora
      `;
      const pedidoId = pedido[0].id;

      for (const item of calculado.items) {
        await sql`
          INSERT INTO detalle_pedidos (pedido_id, producto_id, acompanamiento, cantidad, subtotal)
          VALUES (${pedidoId}, ${item.producto_id}, ${item.acompanamiento}, ${item.cantidad}, ${item.subtotal})
        `;
      }

      await registrarAuditoria('PEDIDO_DELIVERY_CREADO', 'pedidos', pedidoId, nombre.trim(),
        `${esRetiro ? 'Retiro' : esReserva ? 'Reserva' : 'Delivery'}${zona ? ' ' + zona : ''} | ${calculado.items.length} items | Total: $${total}${envio > 0 ? ' (envio: $' + envio + ')' : ''}`, ip);

      return new Response(JSON.stringify({
        success: true,
        pedido_id: pedidoId,
        fecha_hora: pedido[0].fecha_hora,
        vuelto: metodo_pago === 'efectivo' ? efConCuanto - total : 0,
      }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      await devolverStock(calculado.items);
      throw e;
    }
  } catch (error) {
    logError('Creando pedido delivery', error);
    return new Response(JSON.stringify({ error: 'Error al crear el pedido' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
