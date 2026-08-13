export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { getSessionFromCookie } from '../../../../lib/auth';

// Desglose completo de un día: ventas por método de pago, aperturas y
// cierres de caja, platos vendidos y listado de pedidos del día.
export const GET: APIRoute = async ({ request }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || session.rol !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const url = new URL(request.url);
    const fecha = url.searchParams.get('fecha');
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return new Response(JSON.stringify({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const resumen = await sql`
      SELECT
        COUNT(*)::int AS cantidad_pedidos,
        COALESCE(SUM(p.total), 0)::int AS total_ventas,
        COALESCE(SUM(p.descuento), 0)::int AS total_descuentos,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'efectivo' THEN p.total ELSE 0 END), 0)::int AS efectivo,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'debito' THEN p.total ELSE 0 END), 0)::int AS debito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'credito' THEN p.total ELSE 0 END), 0)::int AS credito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'a_credito' THEN p.total ELSE 0 END), 0)::int AS a_credito
      FROM pedidos p
      WHERE p.estado = 'pagado' AND p.fecha_hora::date = ${fecha}::date
    `;

    // Cajas que estuvieron abiertas en algún momento de ese día
    const cajas = await sql`
      SELECT c.id, c.nombre, c.usuario, c.efectivo_inicial, c.efectivo_final, c.efectivo_esperado,
             c.abierta_desde, c.cerrada_desde, c.estado
      FROM cajas c
      WHERE c.abierta_desde::date = ${fecha}::date
         OR c.cerrada_desde::date = ${fecha}::date
         OR (c.abierta_desde::date < ${fecha}::date AND (c.cerrada_desde IS NULL OR c.cerrada_desde::date > ${fecha}::date))
      ORDER BY c.abierta_desde ASC
    `;

    // Platos/productos vendidos ese día
    const productosDia = await sql`
      SELECT pr.nombre, SUM(dp.cantidad)::int AS cantidad, SUM(dp.subtotal)::int AS recaudado
      FROM detalle_pedidos dp
      JOIN pedidos p ON p.id = dp.pedido_id
      JOIN productos pr ON pr.id = dp.producto_id
      WHERE p.estado = 'pagado' AND p.fecha_hora::date = ${fecha}::date
      GROUP BY pr.nombre
      ORDER BY cantidad DESC, recaudado DESC
    `;

    // Pedidos del día (pagados), con mesa o cliente
    const pedidosDia = await sql`
      SELECT p.id, p.fecha_hora, p.total, p.descuento, p.metodo_pago, p.tipo_pedido,
             p.nombre_cliente, m.numero_mesa, m.piso AS mesa_piso, m.tomada_por
      FROM pedidos p
      LEFT JOIN mesas m ON m.id = p.mesa_id
      WHERE p.estado = 'pagado' AND p.fecha_hora::date = ${fecha}::date
      ORDER BY p.fecha_hora ASC
    `;

    return new Response(JSON.stringify({
      fecha,
      resumen: resumen[0] || null,
      cajas,
      productosDia,
      pedidosDia,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error reporte diario:', error);
    return new Response(JSON.stringify({ error: 'Error al cargar el reporte del día' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
