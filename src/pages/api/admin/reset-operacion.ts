export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

// Reinicio de operación: borra TODOS los datos transaccionales (dinero)
// para empezar el negocio desde cero. Conserva: usuarios, productos,
// categorías, acompañamientos, mesas y clientes de crédito (con saldo 0).
export const POST: APIRoute = async ({ request }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || session.rol !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'REINICIAR') {
      return new Response(JSON.stringify({ error: 'Confirmación inválida' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Orden importa por las FKs
    await sql`DELETE FROM cajas`;
    await sql`DELETE FROM turnos`;
    await sql`DELETE FROM abonos`;
    await sql`DELETE FROM detalle_pedidos`;
    await sql`DELETE FROM pedidos`;
    await sql`DELETE FROM reservas_platos`;
    await sql`DELETE FROM mesa_bloqueos`;
    await sql`DELETE FROM auditoria`;

    // Clientes de crédito se conservan, pero parten con saldo en cero
    await sql`UPDATE clientes_credito SET saldo_deudor = 0`;

    // Todas las mesas vuelven a libre
    await sql`UPDATE mesas SET estado = 'libre', tomada_por = NULL, tomada_desde = NULL`;

    // Secuencias de vuelta a 1 en las tablas vaciadas
    for (const t of ['cajas', 'turnos', 'abonos', 'detalle_pedidos', 'pedidos', 'reservas_platos', 'mesa_bloqueos', 'auditoria']) {
      await sql.query(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1`);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error en reinicio de operación:', error);
    return new Response(JSON.stringify({ error: 'Error al reiniciar la operación' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
