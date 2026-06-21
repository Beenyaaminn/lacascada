export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';
import { registrarAuditoria } from '../../../lib/audit';

class PagoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const ip = request.headers.get('x-forwarded-for') || '';

  try {
    const { pedido_id, metodo_pago, propina, descuento, efectivo_con_cuanto } = await request.json();
    const validMethods = ['efectivo', 'debito', 'credito', 'a_credito'];

    if (!pedido_id || !validMethods.includes(metodo_pago)) {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if ((propina !== undefined && propina < 0) || (descuento !== undefined && descuento < 0)) {
      return new Response(JSON.stringify({ error: 'Propina y descuento no pueden ser negativos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const pedidoBefore = await sql`SELECT * FROM pedidos WHERE id = ${pedido_id} LIMIT 1`;
    if (pedidoBefore.length === 0) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (pedidoBefore[0].estado === 'pagado') {
      return new Response(JSON.stringify({ error: 'Este pedido ya fue pagado' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const pedido = pedidoBefore[0];

    const result = await sql.begin(async (tx) => {
      if (metodo_pago === 'a_credito' && pedido.usuario_id) {
        const cliente = await tx`SELECT * FROM clientes_credito WHERE id = ${pedido.usuario_id} LIMIT 1`;
        if (cliente.length > 0) {
          const nuevoSaldo = cliente[0].saldo_deudor + pedido.total;
          if (nuevoSaldo > cliente[0].limite_credito) {
            throw new PagoError('El cliente excede su límite de crédito', 400);
          }
          await tx`UPDATE clientes_credito SET saldo_deudor = ${nuevoSaldo} WHERE id = ${cliente[0].id}`;
        }
      }

      const updated = await tx`
        UPDATE pedidos SET
          metodo_pago = ${metodo_pago}::metodo_pago,
          estado = 'pagado'::estado_pedido,
          propina = ${propina || 0},
          descuento = ${descuento || 0},
          efectivo_con_cuanto = ${efectivo_con_cuanto || 0}
        WHERE id = ${pedido_id} AND estado != 'pagado'
        RETURNING *
      `;

      if (updated.length === 0) {
        throw new PagoError('Error al procesar pago', 500);
      }

      if (pedido.mesa_id) {
        const tienePendientes = await tx`
          SELECT COUNT(*) as cnt FROM pedidos
          WHERE mesa_id = ${pedido.mesa_id} AND estado != 'pagado' AND estado != 'cancelado'
        `;
        if (Number(tienePendientes[0].cnt) === 0) {
          await tx`UPDATE mesas SET estado = 'libre' WHERE id = ${pedido.mesa_id}`;
        } else {
          await tx`UPDATE mesas SET estado = 'esperando_pago' WHERE id = ${pedido.mesa_id}`;
        }
      }

      return updated[0];
    });

    const mesaInfo = pedido.mesa_id ? `Mesa #${pedido.mesa_id}` : 'sin mesa';
    await registrarAuditoria('PAGO_PROCESADO', 'pedidos', pedido_id, session.nombre,
      `Método: ${metodo_pago} | Total: $${pedido.total} | ${mesaInfo}`, ip);

    let voucherData = null;
    try {
      voucherData = await generarVoucher(pedido_id, metodo_pago);
    } catch (e) {
      console.error('Error generando voucher:', e);
    }
    return new Response(JSON.stringify({ pedido: result, voucher: voucherData }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof PagoError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.status, headers: { 'Content-Type': 'application/json' } });
    }
    console.error('Error procesando pago:', error);
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
  const efConCuanto = p.efectivo_con_cuanto || 0;
  const vuelto = metodoPago === 'efectivo' && efConCuanto > p.total ? efConCuanto - p.total : 0;
  return {
    pedido_id: p.id, fecha_hora: p.fecha_hora, mesa_info: mesaInfo,
    detalles: detalles.map((d: any) => ({ nombre: d.producto_nombre, acompanamiento: d.acompanamiento, cantidad: d.cantidad, subtotal: d.subtotal })),
    subtotal: p.total, metodo_pago: metodoPago, total: p.total,
    vuelto, nombre_cliente: p.nombre_cliente, direccion: p.direccion, telefono: p.telefono,
    efectivo_con_cuanto: efConCuanto,
  };
}
