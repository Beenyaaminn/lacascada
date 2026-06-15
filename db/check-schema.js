import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10000,
});

async function sql(strings, ...values) {
  let text = strings[0];
  const params = [];
  for (let i = 0; i < values.length; i++) {
    params.push(values[i]);
    text += `$${i + 1}` + strings[i + 1];
  }
  const r = await pool.query(text, params);
  return r.rows;
}

async function test() {
  try {
    console.log('Conectando a Neon PostgreSQL...');
    const r = await sql`SELECT current_database() as db, version() as v`;
    console.log('OK - BD:', r[0].db, '| PG:', r[0].v.slice(0, 60));

    console.log('\nTablas existentes:');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    tables.forEach(t => console.log('  -', t.table_name));
    const existing = tables.map(t => t.table_name);

    console.log('\nVerificando columnas faltantes en mesas:');
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'mesas' AND table_schema = 'public'
    `;
    console.log('  mesas tiene:', cols.map(c => c.column_name).join(', '));
    const mesaCols = cols.map(c => c.column_name);
    const missingMesaCols = ['tomada_por', 'tomada_desde'].filter(c => !mesaCols.includes(c));
    if (missingMesaCols.length > 0) console.log('  FALTAN:', missingMesaCols.join(', '));

    console.log('\nVerificando columnas en pedidos:');
    const pcols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'pedidos' AND table_schema = 'public'
    `;
    console.log('  pedidos tiene:', pcols.map(c => c.column_name).join(', '));
    const pedCols = pcols.map(c => c.column_name);
    const missingPedCols = ['descuento', 'propina'].filter(c => !pedCols.includes(c));
    if (missingPedCols.length > 0) console.log('  FALTAN:', missingPedCols.join(', '));

    console.log('\nTablas que FALTAN (requeridas por el codigo):');
    const required = ['turnos', 'cajas', 'auditoria', 'login_attempts', 'mesa_bloqueos', 'proveedores'];
    const missing = required.filter(r => !existing.includes(r));
    if (missing.length === 0) {
      console.log('  Ninguna - todas existen');
    } else {
      missing.forEach(m => console.log('  FALTA:', m));
    }

    console.log('\nVerificando login con hash real:');
    const user = await sql`SELECT password_hash FROM usuarios WHERE email = 'admin@lacascada.cl' LIMIT 1`;
    if (user.length > 0) {
      const check = bcrypt.compareSync('admin123', user[0].password_hash);
      console.log('  Admin login:', check ? 'FUNCIONA' : 'NO FUNCIONA - El hash es falso, hay que reemplazarlo');
      if (!check) {
        console.log('  Hash actual:', user[0].password_hash.slice(0, 20) + '...');
      }
    } else {
      console.log('  Admin no existe en la BD');
    }

    await pool.end();
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

test();
