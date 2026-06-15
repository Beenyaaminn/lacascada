import { sql } from './db';

export async function registrarAuditoria(
  accion: string,
  entidad: string,
  entidadId: number | null,
  usuario: string,
  detalles: string,
  ip?: string
) {
  try {
    await sql`
      INSERT INTO auditoria (accion, entidad, entidad_id, usuario, detalles, ip)
      VALUES (${accion}, ${entidad}, ${entidadId}, ${usuario}, ${detalles}, ${ip || null})
    `;
  } catch (e) {
    console.error('Error registrando auditoría:', e);
  }
}
