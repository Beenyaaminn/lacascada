export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const url = new URL(request.url);
    const mes = url.searchParams.get('mes');
    const detalles = url.searchParams.get('detalles');
    const filtroPago = url.searchParams.get('metodo_pago') || '';

    if (detalles === '1') {
      let detallePagos;
      if (mes && filtroPago) {
        detallePagos = await sql`
          SELECT p.id as pedido_id, p.fecha_hora, p.total, p.descuento, p.propina, p.metodo_pago,
            m.numero_mesa, m.piso as mesa_piso, c.id as caja_id, c.nombre as caja_nombre
          FROM pedidos p
          LEFT JOIN mesas m ON m.id = p.mesa_id
          LEFT JOIN cajas c ON c.abierta_desde <= p.fecha_hora AND (c.cerrada_desde IS NULL OR c.cerrada_desde >= p.fecha_hora)
          WHERE p.estado = 'pagado'
            AND p.fecha_hora >= ${mes + '-01'}::date
            AND p.fecha_hora < (${mes + '-01'}::date + INTERVAL '1 month')
            AND p.metodo_pago = ${filtroPago}::metodo_pago
          ORDER BY p.fecha_hora DESC
        `;
      } else if (mes) {
        detallePagos = await sql`
          SELECT p.id as pedido_id, p.fecha_hora, p.total, p.descuento, p.propina, p.metodo_pago,
            m.numero_mesa, m.piso as mesa_piso, c.id as caja_id, c.nombre as caja_nombre
          FROM pedidos p
          LEFT JOIN mesas m ON m.id = p.mesa_id
          LEFT JOIN cajas c ON c.abierta_desde <= p.fecha_hora AND (c.cerrada_desde IS NULL OR c.cerrada_desde >= p.fecha_hora)
          WHERE p.estado = 'pagado'
            AND p.fecha_hora >= ${mes + '-01'}::date
            AND p.fecha_hora < (${mes + '-01'}::date + INTERVAL '1 month')
          ORDER BY p.fecha_hora DESC
        `;
      } else if (filtroPago) {
        detallePagos = await sql`
          SELECT p.id as pedido_id, p.fecha_hora, p.total, p.descuento, p.propina, p.metodo_pago,
            m.numero_mesa, m.piso as mesa_piso, c.id as caja_id, c.nombre as caja_nombre
          FROM pedidos p
          LEFT JOIN mesas m ON m.id = p.mesa_id
          LEFT JOIN cajas c ON c.abierta_desde <= p.fecha_hora AND (c.cerrada_desde IS NULL OR c.cerrada_desde >= p.fecha_hora)
          WHERE p.estado = 'pagado' AND p.metodo_pago = ${filtroPago}::metodo_pago
          ORDER BY p.fecha_hora DESC
        `;
      } else {
        detallePagos = await sql`
          SELECT p.id as pedido_id, p.fecha_hora, p.total, p.descuento, p.propina, p.metodo_pago,
            m.numero_mesa, m.piso as mesa_piso, c.id as caja_id, c.nombre as caja_nombre
          FROM pedidos p
          LEFT JOIN mesas m ON m.id = p.mesa_id
          LEFT JOIN cajas c ON c.abierta_desde <= p.fecha_hora AND (c.cerrada_desde IS NULL OR c.cerrada_desde >= p.fecha_hora)
          WHERE p.estado = 'pagado'
          ORDER BY p.fecha_hora DESC
        `;
      }
      return new Response(JSON.stringify({ detallePagos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const hoy = await sql`
      SELECT
        DATE(p.fecha_hora) as fecha,
        COUNT(*)::int as cantidad_pedidos,
        COALESCE(SUM(p.total), 0)::int as total_ventas,
        COALESCE(SUM(p.propina), 0)::int as total_propinas,
        COALESCE(SUM(p.descuento), 0)::int as total_descuentos,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'efectivo' THEN p.total ELSE 0 END), 0)::int as efectivo,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'debito' THEN p.total ELSE 0 END), 0)::int as debito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'credito' THEN p.total ELSE 0 END), 0)::int as credito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'a_credito' THEN p.total ELSE 0 END), 0)::int as a_credito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'efectivo' THEN p.propina ELSE 0 END), 0)::int as prop_efectivo,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'debito' THEN p.propina ELSE 0 END), 0)::int as prop_debito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'credito' THEN p.propina ELSE 0 END), 0)::int as prop_credito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'a_credito' THEN p.propina ELSE 0 END), 0)::int as prop_a_credito
      FROM pedidos p
      WHERE p.estado = 'pagado' AND DATE(p.fecha_hora) = CURRENT_DATE
      GROUP BY DATE(p.fecha_hora)
    `;

    const ultimos7dias = await sql`
      SELECT
        DATE(p.fecha_hora) as fecha,
        COUNT(*)::int as cantidad_pedidos,
        COALESCE(SUM(p.total), 0)::int as total_ventas,
        COALESCE(SUM(p.propina), 0)::int as total_propinas,
        COALESCE(SUM(p.descuento), 0)::int as total_descuentos,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'efectivo' THEN p.total ELSE 0 END), 0)::int as efectivo,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'debito' THEN p.total ELSE 0 END), 0)::int as debito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'credito' THEN p.total ELSE 0 END), 0)::int as credito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'a_credito' THEN p.total ELSE 0 END), 0)::int as a_credito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'efectivo' THEN p.propina ELSE 0 END), 0)::int as prop_efectivo,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'debito' THEN p.propina ELSE 0 END), 0)::int as prop_debito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'credito' THEN p.propina ELSE 0 END), 0)::int as prop_credito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'a_credito' THEN p.propina ELSE 0 END), 0)::int as prop_a_credito
      FROM pedidos p
      WHERE p.estado = 'pagado' AND p.fecha_hora >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(p.fecha_hora)
      ORDER BY fecha DESC
    `;

    let mensual: any[] = [];
    if (mes) {
      mensual = await sql`
        SELECT
          DATE(p.fecha_hora) as fecha,
          COUNT(*)::int as cantidad_pedidos,
          COALESCE(SUM(p.total), 0)::int as total_ventas,
          COALESCE(SUM(p.propina), 0)::int as total_propinas,
          COALESCE(SUM(p.descuento), 0)::int as total_descuentos,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'efectivo' THEN p.total ELSE 0 END), 0)::int as efectivo,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'debito' THEN p.total ELSE 0 END), 0)::int as debito,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'credito' THEN p.total ELSE 0 END), 0)::int as credito,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'a_credito' THEN p.total ELSE 0 END), 0)::int as a_credito,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'efectivo' THEN p.propina ELSE 0 END), 0)::int as prop_efectivo,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'debito' THEN p.propina ELSE 0 END), 0)::int as prop_debito,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'credito' THEN p.propina ELSE 0 END), 0)::int as prop_credito,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'a_credito' THEN p.propina ELSE 0 END), 0)::int as prop_a_credito,
          STRING_AGG(DISTINCT m.tomada_por, ', ') as garzones
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.estado = 'pagado'
          AND p.fecha_hora >= ${mes + '-01'}::date
          AND p.fecha_hora < (${mes + '-01'}::date + INTERVAL '1 month')
        GROUP BY DATE(p.fecha_hora)
        ORDER BY fecha DESC
      `;
    }

    const topProductos = await sql`
      SELECT
        pr.nombre,
        SUM(dp.cantidad)::int as total_cantidad,
        SUM(dp.subtotal)::int as total_recaudado
      FROM detalle_pedidos dp
      JOIN pedidos p ON p.id = dp.pedido_id
      JOIN productos pr ON pr.id = dp.producto_id
      WHERE p.estado = 'pagado'
        AND p.fecha_hora >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY pr.nombre
      ORDER BY total_cantidad DESC
      LIMIT 8
    `;

    return new Response(JSON.stringify({ hoy, ultimos7dias, mensual, topProductos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error reportes:', error);
    return new Response(JSON.stringify({ error: 'Error al cargar reportes' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
