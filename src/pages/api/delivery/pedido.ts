export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { registrarAuditoria } from '../../../lib/audit';
import { checkRateLimit } from '../../../lib/ratelimit';
import { logError } from '../../../lib/logger';

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get('x-forwarded-for') || '0.0.0.0';

  const rl = checkRateLimit(`delivery:${ip}`, 10, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Demasiados pedidos. Intente de nuevo.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const {
      nombre, direccion, telefono, metodo_pago,
      efectivo_con_cuanto, items, total
    } = await request.json();

    if (!nombre || !direccion || !telefono) {
      return new Response(JSON.stringify({ error: 'Nombre, dirección y teléfono son obligatorios' }), {
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

    if (metodo_pago === 'efectivo' && (efectivo_con_cuanto == null || efectivo_con_cuanto <= 0)) {
      return new Response(JSON.stringify({ error: 'Debe ingresar monto en efectivo' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    let calculatedTotal = 0;
    for (const item of items) {
      const prod = await sql`SELECT id, nombre, maneja_stock, stock_actual, precio FROM productos WHERE id = ${item.producto_id} LIMIT 1`;
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
      const precio = Number(prod[0].precio) || 0;
      calculatedTotal += precio * cantidad;
    }

    if (typeof total !== 'number' || total < 0 || Math.abs(total - calculatedTotal) > 1) {
      return new Response(JSON.stringify({ error: `Total inválido. Esperado: $${calculatedTotal}, Recibido: $${total}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (metodo_pago === 'efectivo' && efectivo_con_cuanto < total) {
      return new Response(JSON.stringify({ error: `El monto en efectivo ($${efectivo_con_cuanto || 0}) debe cubrir el total ($${total})` }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const efConCuanto = metodo_pago === 'efectivo' ? (efectivo_con_cuanto || 0) : 0;

    const result = await sql.begin(async (tx) => {
      const pedido = await tx`
        INSERT INTO pedidos (tipo_pedido, estado, total, nombre_cliente, direccion, telefono, efectivo_con_cuanto)
        VALUES ('delivery', 'pendiente', ${total}, ${nombre}, ${direccion}, ${telefono}, ${efConCuanto})
        RETURNING id, fecha_hora
      `;
      const pedidoId = pedido[0].id;

      for (const item of items) {
        await tx`
          INSERT INTO detalle_pedidos (pedido_id, producto_id, acompanamiento, cantidad, subtotal)
          VALUES (${pedidoId}, ${item.producto_id}, ${item.acompanamiento || null}, ${item.cantidad || 1}, ${item.subtotal})
        `;
      }

      return pedidoId;
    });

    const pedidoId = result;

    await registrarAuditoria('PEDIDO_DELIVERY_CREADO', 'pedidos', pedidoId, nombre,
      `Delivery | ${items.length} items | Total: $${total} | Dir: ${direccion}`, ip);

    return new Response(JSON.stringify({
      success: true,
      pedido_id: pedidoId,
      fecha_hora: new Date().toISOString(),
      vuelto: metodo_pago === 'efectivo' ? (efectivo_con_cuanto || 0) - total : 0,
    }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError('Creando pedido delivery', error);
    return new Response(JSON.stringify({ error: 'Error al crear el pedido' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
