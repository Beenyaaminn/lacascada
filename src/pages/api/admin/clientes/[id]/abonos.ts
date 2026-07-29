export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../../../lib/db';
import { getSessionFromCookie } from '../../../../../lib/auth';
import { registrarAuditoria } from '../../../../../lib/audit';
import { logError } from '../../../../../lib/logger';

export const GET: APIRoute = async ({ request, params }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || session.rol !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const clienteId = parseInt(params.id!);
  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const abonos = await sql`
    SELECT * FROM abonos WHERE cliente_credito_id = ${clienteId} ORDER BY fecha_hora DESC
  `;

  return new Response(JSON.stringify({ abonos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request, params, clientAddress }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || session.rol !== 'admin') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const ip = clientAddress || request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || '';

  try {
    const { monto } = await request.json();
    const clienteId = parseInt(params.id!);
    const montoNum = Number(monto);

    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!Number.isFinite(montoNum) || montoNum <= 0 || !Number.isInteger(montoNum)) {
      return new Response(JSON.stringify({ error: 'Monto inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // El abono no puede superar la deuda actual (evita descuadre del libro contable)
    const cliente = await sql`SELECT saldo_deudor FROM clientes_credito WHERE id = ${clienteId} LIMIT 1`;
    if (cliente.length === 0) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    if (montoNum > cliente[0].saldo_deudor) {
      return new Response(JSON.stringify({ error: `El abono ($${montoNum.toLocaleString('es-CL')}) supera la deuda actual ($${cliente[0].saldo_deudor.toLocaleString('es-CL')})` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Decremento atómico con guard: solo descuenta si el saldo alcanza (evita lost updates)
    const actualizado = await sql`
      UPDATE clientes_credito
      SET saldo_deudor = saldo_deudor - ${montoNum}
      WHERE id = ${clienteId} AND saldo_deudor >= ${montoNum}
      RETURNING saldo_deudor
    `;

    if (actualizado.length === 0) {
      return new Response(JSON.stringify({ error: 'La deuda cambió mientras se procesaba. Recarga e intenta de nuevo.' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    await sql`
      INSERT INTO abonos (cliente_credito_id, monto) VALUES (${clienteId}, ${montoNum})
    `;

    await registrarAuditoria('ABONO_REGISTRADO', 'clientes_credito', clienteId, session.nombre,
      `Abono: $${montoNum.toLocaleString('es-CL')} | Nuevo saldo: $${actualizado[0].saldo_deudor.toLocaleString('es-CL')}`, ip);

    return new Response(JSON.stringify({ success: true, nuevo_saldo: actualizado[0].saldo_deudor }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    logError('Registrando abono', error);
    return new Response(JSON.stringify({ error: 'Error al registrar abono' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
