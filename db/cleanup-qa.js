// Limpieza puntual de datos de prueba QA (2026-08-10).
// Borra SOLO filas marcadas como "TEST QA (borrar)". Uso: node db/cleanup-qa.js
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const client = await pool.connect();

const QA_TAG = 'TEST QA (borrar)';
const PEDIDO_IDS = [];
const CAJA_IDS = [7];
const USUARIO_IDS = [5];

try {
  await client.query('BEGIN');

  // Guard: verificar que los pedidos son los de prueba
  const pedidos = await client.query(
    `SELECT id FROM pedidos WHERE id = ANY($1) AND nombre_cliente = $2`,
    [PEDIDO_IDS, QA_TAG]
  );
  if (pedidos.rows.length !== PEDIDO_IDS.length) {
    throw new Error(`Guard: se esperaban ${PEDIDO_IDS.length} pedidos QA, se encontraron ${pedidos.rows.length}. Abortando.`);
  }

  const det = await client.query(`DELETE FROM detalle_pedidos WHERE pedido_id = ANY($1)`, [PEDIDO_IDS]);
  const ped = await client.query(`DELETE FROM pedidos WHERE id = ANY($1) AND nombre_cliente = $2`, [PEDIDO_IDS, QA_TAG]);

  // Cajas: solo cerradas y marcadas como QA
  const cajas = await client.query(
    `DELETE FROM cajas WHERE id = ANY($1) AND estado = 'cerrada' AND comentarios = $2`,
    [CAJA_IDS, QA_TAG]
  );
  if (cajas.rowCount !== CAJA_IDS.length) {
    throw new Error(`Guard: se esperaban ${CAJA_IDS.length} cajas QA, se encontraron ${cajas.rowCount}. Abortando.`);
  }

  // Usuarios: solo el garzón de prueba
  const usuarios = await client.query(
    `DELETE FROM usuarios WHERE id = ANY($1) AND nombre = $2 AND rol = 'garzon'`,
    [USUARIO_IDS, QA_TAG]
  );
  if (usuarios.rowCount !== USUARIO_IDS.length) {
    throw new Error(`Guard: se esperaban ${USUARIO_IDS.length} usuarios QA, se encontraron ${usuarios.rowCount}. Abortando.`);
  }

  await client.query('COMMIT');
  console.log(`OK: ${det.rowCount} detalles, ${ped.rowCount} pedidos (${PEDIDO_IDS.join(', ')}), ${cajas.rowCount} cajas (${CAJA_IDS.join(', ')}), ${usuarios.rowCount} usuarios (${USUARIO_IDS.join(', ')}) eliminados.`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('Abortado, sin cambios:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
