export const prerender = false;

import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { getSessionFromCookie } from '../../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { mesa_id } = await request.json();

    // Sin caja abierta no se puede iniciar la atención de una mesa
    // (evita recorrer todo el flujo de pedido para recién fallar al cobrar)
    const cajaAbierta = await sql`SELECT id FROM cajas WHERE estado = 'abierta' LIMIT 1`;
    if (cajaAbierta.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay caja abierta. Abra un turno de caja antes de cobrar.' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const bloqueado = await sql`SELECT * FROM mesa_bloqueos WHERE mesa_id = ${mesa_id} LIMIT 1`;
    if (bloqueado.length > 0) {
      const bloqueadoHace = Date.now() - new Date(bloqueado[0].bloqueado_desde).getTime();
      if (bloqueadoHace > 120000) {
        await sql`DELETE FROM mesa_bloqueos WHERE mesa_id = ${mesa_id}`;
      } else {
        return new Response(JSON.stringify({
          error: `Mesa bloqueada por ${bloqueado[0].usuario}. Intente en unos segundos.`,
          bloqueada: true,
          usuario: bloqueado[0].usuario,
        }), { status: 423, headers: { 'Content-Type': 'application/json' } });
      }
    }

    await sql`
      INSERT INTO mesa_bloqueos (mesa_id, usuario)
      VALUES (${mesa_id}, ${session.nombre})
      ON CONFLICT (mesa_id) DO UPDATE SET usuario = ${session.nombre}, bloqueado_desde = NOW()
    `;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al bloquear mesa' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const session = getSessionFromCookie(request.headers.get('cookie'));
  if (!session || (session.rol !== 'admin' && session.rol !== 'garzon')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const url = new URL(request.url);
    const mesa_id = url.searchParams.get('id');
    if (!mesa_id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    await sql`DELETE FROM mesa_bloqueos WHERE mesa_id = ${mesa_id}`;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al desbloquear' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
