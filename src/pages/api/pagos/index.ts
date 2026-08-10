export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';
import { registrarAuditoria } from '../../../lib/audit';
import { checkRateLimit } from '../../../lib/ratelimit';
import { logError } from '../../../lib/logger';

class PagoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const ip = clientAddress || request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || '';

  const rl = checkRateLimit(`pagos:${ip}`, 60, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Demasiados intentos. Intente de nuevo.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { pedido_id, metodo_pago, descuento, efectivo_con_cuanto, cliente_credito_id } = await request.json();
    const validMethods = ['efectivo', 'debito', 'credito', 'a_credito'];

    const pedidoId = Number(pedido_id);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0 || !validMethods.includes(metodo_pago)) {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const desc = Number(descuento) || 0;
    if (desc < 0) {
      return new Response(JSON.stringify({ error: 'El descuento no puede ser negativo' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const pedidoBefore = await sql`SELECT * FROM pedidos WHERE id = ${pedidoId} LIMIT 1`;
    if (pedidoBefore.length === 0) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const pedido = pedidoBefore[0];
    if (pedido.estado === 'pagado') {
      return new Response(JSON.stringify({ error: 'Este pedido ya fue pagado' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    // El descuento no puede superar el total del pedido
    if (desc > pedido.total) {
      return new Response(JSON.stringify({ error: `El descuento ($${desc}) no puede ser mayor al total ($${pedido.total})` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const totalAPagar = pedido.total - desc;

    // VALIDACIÓN CRÍTICA: el efectivo recibido debe cubrir el total
    if (metodo_pago === 'efectivo') {
      const ef = Number(efectivo_con_cuanto);
      if (!Number.isFinite(ef) || ef <= 0) {
        return new Response(JSON.stringify({ error: 'Debe ingresar con cuánto paga el cliente' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (ef < totalAPagar) {
        return new Response(JSON.stringify({ error: `El efectivo recibido ($${ef}) es menor al total a cobrar ($${totalAPagar})` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Crédito: el cliente es obligatorio
    let clienteCreditoId: number | null = null;
    if (metodo_pago === 'a_credito') {
      clienteCreditoId = Number(cliente_credito_id);
      if (!Number.isInteger(clienteCreditoId) || clienteCreditoId <= 0) {
        return new Response(JSON.stringify({ error: 'Debe seleccionar un cliente para pago a crédito' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const efFinal = metodo_pago === 'efectivo' ? Number(efectivo_con_cuanto) : 0;

    // Debe haber una caja abierta: todo cobro queda atribuido a un turno
    // (sin esto el pago quedaba con caja_id NULL y no aparecía en cierres/reportes de caja)
    const cajaAbierta = await sql`SELECT id FROM cajas WHERE estado = 'abierta' ORDER BY abierta_desde DESC LIMIT 1`;
    if (cajaAbierta.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay caja abierta. Abra un turno de caja antes de cobrar.' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    const cajaId = cajaAbierta[0].id;

    // 1) Crédito: incremento atómico del saldo con guard de límite
    if (metodo_pago === 'a_credito' && clienteCreditoId) {
      const credito = await sql`
        UPDATE clientes_credito
        SET saldo_deudor = saldo_deudor + ${totalAPagar}
        WHERE id = ${clienteCreditoId}
          AND activo = TRUE
          AND saldo_deudor + ${totalAPagar} <= limite_credito
        RETURNING id, saldo_deudor
      `;
      if (credito.length === 0) {
        return new Response(JSON.stringify({ error: 'El cliente no existe, está inactivo o excede su límite de crédito' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 2) Marcar pedido como pagado (guard anti doble-pago) y atribuir a la caja abierta
    const updated = await sql`
      UPDATE pedidos SET
        metodo_pago = ${metodo_pago}::metodo_pago,
        estado = 'pagado'::estado_pedido,
        descuento = ${desc},
        efectivo_con_cuanto = ${efFinal},
        cliente_credito_id = ${clienteCreditoId},
        caja_id = ${cajaId}
      WHERE id = ${pedidoId} AND estado != 'pagado'
      RETURNING *
    `;

    if (updated.length === 0) {
      // Revertir el cargo de crédito si el pago no se aplicó
      if (metodo_pago === 'a_credito' && clienteCreditoId) {
        await sql`UPDATE clientes_credito SET saldo_deudor = GREATEST(saldo_deudor - ${totalAPagar}, 0) WHERE id = ${clienteCreditoId}`;
      }
      return new Response(JSON.stringify({ error: 'Este pedido ya fue pagado' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    // 3) Actualizar estado de la mesa
    if (pedido.mesa_id) {
      const tienePendientes = await sql`
        SELECT COUNT(*)::int as cnt FROM pedidos
        WHERE mesa_id = ${pedido.mesa_id} AND estado != 'pagado' AND estado != 'cancelado'
      `;
      if (tienePendientes[0].cnt === 0) {
        await sql`UPDATE mesas SET estado = 'libre', tomada_por = NULL, tomada_desde = NULL WHERE id = ${pedido.mesa_id}`;
      } else {
        await sql`UPDATE mesas SET estado = 'esperando_pago' WHERE id = ${pedido.mesa_id}`;
      }
    }

    const mesaInfo = pedido.mesa_id ? `Mesa #${pedido.mesa_id}` : 'sin mesa';
    await registrarAuditoria('PAGO_PROCESADO', 'pedidos', pedidoId, session.nombre,
      `Método: ${metodo_pago} | Total: $${pedido.total}${desc > 0 ? ' | Descuento: $' + desc : ''} | Cobrado: $${totalAPagar} | ${mesaInfo}`, ip);

    let voucherData = null;
    try {
      voucherData = await generarVoucher(pedidoId, metodo_pago);
    } catch (e) {
      console.error('Error generando voucher:', e);
    }
    return new Response(JSON.stringify({ pedido: updated[0], voucher: voucherData }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof PagoError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.status, headers: { 'Content-Type': 'application/json' } });
    }
    logError('Procesando pago', error);
    return new Response(JSON.stringify({ error: 'Error al procesar el pago' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

async function generarVoucher(pedidoId: number, metodoPago: string) {
  const pedido = await sql`
    SELECT p.*, m.numero_mesa, m.piso
    FROM pedidos p LEFT JOIN mesas m ON m.id = p.mesa_id
    WHERE p.id = ${pedidoId} LIMIT 1
  `;
  if (pedido.length === 0) return null;
  const detalles = await sql`
    SELECT dp.*, pr.nombre as producto_nombre, pr.precio as producto_precio
    FROM detalle_pedidos dp JOIN productos pr ON pr.id = dp.producto_id
    WHERE dp.pedido_id = ${pedidoId}
  `;
  const p = pedido[0];
  let mesaInfo;
  if (p.tipo_pedido === 'delivery') {
    mesaInfo = `🛵 Delivery - ${p.nombre_cliente || 'Cliente'}`;
  } else if (p.numero_mesa) {
    mesaInfo = `Piso ${p.piso} - Mesa ${p.numero_mesa}`;
  } else {
    mesaInfo = p.tipo_pedido;
  }
  const totalFinal = p.total - (p.descuento || 0);
  const efConCuanto = p.efectivo_con_cuanto || 0;
  const vuelto = metodoPago === 'efectivo' && efConCuanto > totalFinal ? efConCuanto - totalFinal : 0;
  return {
    pedido_id: p.id, fecha_hora: p.fecha_hora, mesa_info: mesaInfo,
    detalles: detalles.map((d: any) => ({ nombre: d.producto_nombre, acompanamiento: d.acompanamiento, cantidad: d.cantidad, subtotal: d.subtotal })),
    subtotal: totalFinal, metodo_pago: metodoPago, total: totalFinal,
    descuento: p.descuento || 0, costo_envio: p.costo_envio || 0,
    vuelto, nombre_cliente: p.nombre_cliente, direccion: p.direccion, telefono: p.telefono,
    efectivo_con_cuanto: efConCuanto,
  };
}
