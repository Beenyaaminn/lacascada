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
  for (let i = 0; i < values.length; i++) {
    params.push(values[i]);
    text += `$${i + 1}` + strings[i + 1];
  }
  const result = await pool.query(text, params);
  return result.rows;
}

console.log('🧹 Limpiando base de datos...\n');

// 1. Cajas (antes de turnos por FK sin CASCADE)
await sql`DELETE FROM cajas`;
console.log('✓ Cajas eliminadas');

// 2. Turnos
await sql`DELETE FROM turnos`;
console.log('✓ Turnos eliminados');

// 3. Pedidos (CASCADE a detalle_pedidos)
await sql`DELETE FROM pedidos`;
console.log('✓ Pedidos eliminados');

// 4. Reservas
await sql`DELETE FROM reservas_platos`;
console.log('✓ Reservas eliminadas');

// 5. Productos + relaciones
await sql`DELETE FROM productos_acompanamientos`;
console.log('✓ Relaciones producto-acompañamiento eliminadas');

await sql`DELETE FROM productos`;
console.log('✓ Productos eliminados');

// 6. Acompañamientos
await sql`DELETE FROM acompanamientos`;
console.log('✓ Acompañamientos eliminados');

// 7. Categorías
await sql`DELETE FROM categorias`;
console.log('✓ Categorías eliminadas');

// 8. Clientes crédito (CASCADE a abonos)
await sql`DELETE FROM clientes_credito`;
console.log('✓ Clientes crédito eliminados');

// 9. Logs
await sql`DELETE FROM auditoria`;
console.log('✓ Auditoría limpiada');

await sql`DELETE FROM login_attempts`;
console.log('✓ Intentos de login limpiados');

// 10. Bloqueos de mesa
await sql`DELETE FROM mesa_bloqueos`;
console.log('✓ Bloqueos de mesa limpiados');

// 11. Reset mesas
await sql`UPDATE mesas SET estado = 'libre', tomada_por = NULL, tomada_desde = NULL`;
console.log('✓ Mesas reiniciadas a libre');

// 12. Resetear secuencias a 1
console.log('\n🔄 Reiniciando contadores a #1...');
const seqResult = await pool.query(`
  SELECT table_name, column_name 
  FROM information_schema.columns 
  WHERE column_default LIKE 'nextval%'
    AND table_schema = 'public'
    AND table_name NOT IN ('usuarios')
  ORDER BY table_name
`);

for (const row of seqResult.rows) {
  const seqName = `${row.table_name}_id_seq`;
  try {
    await pool.query(`ALTER SEQUENCE ${seqName} RESTART WITH 1`);
    console.log(`  ✓ ${seqName}`);
  } catch {
    // sequence might not exist for this table
    console.log(`  ⚠ ${seqName} (no encontrada, omitiendo)`);
  }
}

console.log('\n✅ Base de datos limpia. Usuarios y mesas conservados.');
console.log('   Pedidos, reservas y deliveries empezarán desde #1.');
pool.end();
