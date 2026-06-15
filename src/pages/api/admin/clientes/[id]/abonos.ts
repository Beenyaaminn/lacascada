export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../../../lib/db';
import { getSessionFromCookie } from '../../../../../lib/auth';

export const GET: APIRoute = async ({ request, params }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || session.rol !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const abonos = await sql`
    SELECT * FROM abonos WHERE cliente_credito_id = ${params.id} ORDER BY fecha_hora DESC
  `;

  return new Response(JSON.stringify({ abonos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request, params }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || session.rol !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { monto } = await request.json();
    const clienteId = parseInt(params.id!);

    if (!monto || monto <= 0) {
      return new Response(JSON.stringify({ error: 'Monto inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const cliente = await sql`SELECT * FROM clientes_credito WHERE id = ${clienteId} LIMIT 1`;
    if (cliente.length === 0) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const nuevoSaldo = Math.max(0, cliente[0].saldo_deudor - monto);

    await sql`
      INSERT INTO abonos (cliente_credito_id, monto) VALUES (${clienteId}, ${monto})
    `;

    await sql`
      UPDATE clientes_credito SET saldo_deudor = ${nuevoSaldo} WHERE id = ${clienteId}
    `;

    return new Response(JSON.stringify({ success: true, nuevo_saldo: nuevoSaldo }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al registrar abono' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
