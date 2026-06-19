import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

async function sql(strings, ...values) {
  let text = strings[0];
  const params = [];
  for (let i = 0; i < values.length; i++) { params.push(values[i]); text += '$' + (i+1) + strings[i+1]; }
  const result = await pool.query(text, params);
  return result.rows;
}

await sql`UPDATE pedidos SET estado = 'cancelado' WHERE id = 20`;
const p = await sql`SELECT id, estado, mesa_id, total, fecha_hora FROM pedidos WHERE id = 20`;
console.log('Pedido #20:', JSON.stringify(p[0]));
console.log('Cancelado.');

const pendientes = await sql`SELECT id, estado, mesa_id FROM pedidos WHERE mesa_id IS NOT NULL AND estado = 'pendiente' ORDER BY id`;
console.log('Pedidos pendientes con mesa:', JSON.stringify(pendientes));

process.exit(0);
