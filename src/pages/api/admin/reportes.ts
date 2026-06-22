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
    const tipoPedido = url.searchParams.get('tipo') || '';

    if (mes && !/^\d{4}-\d{2}$/.test(mes)) {
      return new Response(JSON.stringify({ error: 'Formato de mes inválido. Use YYYY-MM' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (detalles === '1') {
      let detallePagos;
      if (mes && filtroPago) {
        detallePagos = await sql`
          SELECT p.id as pedido_id, p.fecha_hora, p.total, p.descuento, p.metodo_pago,
            p.tipo_pedido, p.nombre_cliente, p.direccion, p.telefono,
            m.numero_mesa, m.piso as mesa_piso, c.usuario as cajera
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
          SELECT p.id as pedido_id, p.fecha_hora, p.total, p.descuento, p.metodo_pago,
            p.tipo_pedido, p.nombre_cliente, p.direccion, p.telefono,
            m.numero_mesa, m.piso as mesa_piso, c.usuario as cajera
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
          SELECT p.id as pedido_id, p.fecha_hora, p.total, p.descuento, p.metodo_pago,
            p.tipo_pedido, p.nombre_cliente, p.direccion, p.telefono,
            m.numero_mesa, m.piso as mesa_piso, c.usuario as cajera
          FROM pedidos p
          LEFT JOIN mesas m ON m.id = p.mesa_id
          LEFT JOIN cajas c ON c.abierta_desde <= p.fecha_hora AND (c.cerrada_desde IS NULL OR c.cerrada_desde >= p.fecha_hora)
          WHERE p.estado = 'pagado' AND p.metodo_pago = ${filtroPago}::metodo_pago
          ORDER BY p.fecha_hora DESC
        `;
      } else {
        detallePagos = await sql`
          SELECT p.id as pedido_id, p.fecha_hora, p.total, p.descuento, p.metodo_pago,
            p.tipo_pedido, p.nombre_cliente, p.direccion, p.telefono,
            m.numero_mesa, m.piso as mesa_piso, c.usuario as cajera
          FROM pedidos p
          LEFT JOIN mesas m ON m.id = p.mesa_id
          LEFT JOIN cajas c ON c.abierta_desde <= p.fecha_hora AND (c.cerrada_desde IS NULL OR c.cerrada_desde >= p.fecha_hora)
          WHERE p.estado = 'pagado'
          ORDER BY p.fecha_hora DESC
        `;
      }
      if (tipoPedido) {
        detallePagos = detallePagos.filter((p: any) => p.tipo_pedido === tipoPedido);
      }
      return new Response(JSON.stringify({ detallePagos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    let hoy = await sql`
      SELECT
        p.fecha_hora::date::text as fecha,
        p.tipo_pedido,
        COUNT(*)::int as cantidad_pedidos,
        COALESCE(SUM(p.total), 0)::int as total_ventas,
        COALESCE(SUM(p.descuento), 0)::int as total_descuentos,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'efectivo' THEN p.total ELSE 0 END), 0)::int as efectivo,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'debito' THEN p.total ELSE 0 END), 0)::int as debito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'credito' THEN p.total ELSE 0 END), 0)::int as credito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'a_credito' THEN p.total ELSE 0 END), 0)::int as a_credito
      FROM pedidos p
      WHERE p.estado = 'pagado' AND DATE(p.fecha_hora) = CURRENT_DATE
      GROUP BY DATE(p.fecha_hora), p.tipo_pedido
    `;

    let ultimos7dias = await sql`
      SELECT
        p.fecha_hora::date::text as fecha,
        p.tipo_pedido,
        COUNT(*)::int as cantidad_pedidos,
        COALESCE(SUM(p.total), 0)::int as total_ventas,
        COALESCE(SUM(p.descuento), 0)::int as total_descuentos,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'efectivo' THEN p.total ELSE 0 END), 0)::int as efectivo,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'debito' THEN p.total ELSE 0 END), 0)::int as debito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'credito' THEN p.total ELSE 0 END), 0)::int as credito,
        COALESCE(SUM(CASE WHEN p.metodo_pago = 'a_credito' THEN p.total ELSE 0 END), 0)::int as a_credito
      FROM pedidos p
      WHERE p.estado = 'pagado' AND p.fecha_hora >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(p.fecha_hora), p.tipo_pedido
      ORDER BY fecha DESC
    `;

    if (tipoPedido) {
      hoy = hoy.filter((r: any) => r.tipo_pedido === tipoPedido);
      ultimos7dias = ultimos7dias.filter((r: any) => r.tipo_pedido === tipoPedido);
    }

    let mensual: any[] = [];
    let ventasPorCajera: any[] = [];
    if (mes) {
      mensual = await sql`
        SELECT
          p.fecha_hora::date::text as fecha,
          p.tipo_pedido,
          COUNT(*)::int as cantidad_pedidos,
          COALESCE(SUM(p.total), 0)::int as total_ventas,
          COALESCE(SUM(p.descuento), 0)::int as total_descuentos,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'efectivo' THEN p.total ELSE 0 END), 0)::int as efectivo,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'debito' THEN p.total ELSE 0 END), 0)::int as debito,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'credito' THEN p.total ELSE 0 END), 0)::int as credito,
          COALESCE(SUM(CASE WHEN p.metodo_pago = 'a_credito' THEN p.total ELSE 0 END), 0)::int as a_credito,
          STRING_AGG(DISTINCT m.tomada_por, ', ') as garzones
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.estado = 'pagado'
          AND p.fecha_hora >= ${mes + '-01'}::date
          AND p.fecha_hora < (${mes + '-01'}::date + INTERVAL '1 month')
        GROUP BY DATE(p.fecha_hora), p.tipo_pedido
        ORDER BY fecha DESC
      `;
      if (tipoPedido) {
        mensual = mensual.filter((r: any) => r.tipo_pedido === tipoPedido);
      }

      ventasPorCajera = await sql`
        SELECT
          c.usuario as cajera,
          COUNT(p.id)::int as total_pedidos,
          COALESCE(SUM(p.total), 0)::int as total_ventas
        FROM pedidos p
        JOIN cajas c ON c.abierta_desde <= p.fecha_hora AND (c.cerrada_desde IS NULL OR c.cerrada_desde >= p.fecha_hora)
        WHERE p.estado = 'pagado'
          AND p.fecha_hora >= ${mes + '-01'}::date
          AND p.fecha_hora < (${mes + '-01'}::date + INTERVAL '1 month')
        GROUP BY c.usuario
        ORDER BY total_ventas DESC
      `;
    }

    let topProductos = await sql`
      SELECT
        pr.nombre,
        p.tipo_pedido,
        SUM(dp.cantidad)::int as total_cantidad,
        SUM(dp.subtotal)::int as total_recaudado
      FROM detalle_pedidos dp
      JOIN pedidos p ON p.id = dp.pedido_id
      JOIN productos pr ON pr.id = dp.producto_id
      WHERE p.estado = 'pagado'
        AND p.fecha_hora >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY pr.nombre, p.tipo_pedido
      ORDER BY total_cantidad DESC
      LIMIT 20
    `;
    if (tipoPedido) {
      topProductos = topProductos.filter((r: any) => r.tipo_pedido === tipoPedido).slice(0, 8);
    } else {
      topProductos = topProductos.slice(0, 8);
    }

    return new Response(JSON.stringify({ hoy, ultimos7dias, mensual, ventasPorCajera, topProductos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error reportes:', error);
    return new Response(JSON.stringify({ error: 'Error al cargar reportes' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
