/**
 * Migración reparadora - Auditoría QA Fase 2
 *
 * Aplica en la BD en vivo lo que db/schema.sql declara pero que nunca
 * se ejecutó (schema.sql tenía un bug de orden y la BD se provisionó
 * con migrate.js + fixes-migration.cjs):
 *
 *   1) Triggers update_updated_at faltantes en turnos, cajas y proveedores.
 *   2) FK reservas_platos.producto_id -> productos(id) ON DELETE SET NULL
 *      (solo si no existen huérfanos; la columna es nullable por diseño,
 *      la app inserta reservas de mesa sin producto).
 *
 * NO recrea los triggers de stock: fueron eliminados intencionalmente por
 * db/fixes-migration.cjs porque el stock se gestiona atómicamente en la
 * aplicación (src/lib/pricing.ts). Recrearlos causaría doble descuento.
 *
 * Ejecutar: node db/repair-migration.mjs
 */
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL);

(async () => {
  console.log('Iniciando migración reparadora...\n');

  // 0) Asegurar que la función existe (ya debería)
  await sql`CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $func$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql`;
  console.log('✓ función update_updated_at_column() verificada');

  // 1) Triggers updated_at faltantes
  await sql`DO $do$ BEGIN
    CREATE TRIGGER tg_turnos_updated_at BEFORE UPDATE ON turnos
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $do$`;
  console.log('✓ trigger tg_turnos_updated_at creado (o ya existía)');

  await sql`DO $do$ BEGIN
    CREATE TRIGGER tg_cajas_updated_at BEFORE UPDATE ON cajas
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $do$`;
  console.log('✓ trigger tg_cajas_updated_at creado (o ya existía)');

  await sql`DO $do$ BEGIN
    CREATE TRIGGER tg_proveedores_updated_at BEFORE UPDATE ON proveedores
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $do$`;
  console.log('✓ trigger tg_proveedores_updated_at creado (o ya existía)');

  // 2) FK reservas_platos.producto_id (solo sin huérfanos)
  const huerfanos = await sql`SELECT COUNT(*)::int AS n FROM reservas_platos r
    WHERE r.producto_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM productos p WHERE p.id = r.producto_id)`;
  if (huerfanos[0].n === 0) {
    await sql`DO $do$ BEGIN
      ALTER TABLE reservas_platos
        ADD CONSTRAINT reservas_platos_producto_id_fkey
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $do$`;
    console.log('✓ FK reservas_platos.producto_id creada (0 huérfanos)');
  } else {
    console.log(`⚠ FK reservas_platos.producto_id NO creada: ${huerfanos[0].n} huérfanos`);
  }

  // 3) Verificación: triggers presentes
  const triggers = await sql`SELECT event_object_table AS tabla, trigger_name
    FROM information_schema.triggers
    WHERE trigger_name LIKE 'tg_%_updated_at'
    ORDER BY event_object_table`;
  console.log('\nTriggers updated_at en vivo:');
  triggers.forEach(t => console.log(`  - ${t.tabla}: ${t.trigger_name}`));

  // 4) Prueba funcional del trigger en proveedores (y limpieza)
  const ins = await sql`INSERT INTO proveedores (nombre, created_at, updated_at)
    VALUES ('QA_AUDIT_TRIG', '2020-01-01'::timestamptz, '2020-01-01'::timestamptz)
    RETURNING id`;
  const id = ins[0].id;
  await sql`UPDATE proveedores SET notas = 'trigger test' WHERE id = ${id}`;
  const chk = await sql`SELECT updated_at FROM proveedores WHERE id = ${id}`;
  const ok = new Date(chk[0].updated_at) > new Date('2020-01-02');
  await sql`DELETE FROM proveedores WHERE id = ${id}`;
  console.log(`\nPrueba funcional trigger (proveedores): ${ok ? 'OK — updated_at se actualiza' : 'FALLO'}`);
  console.log('Fila de prueba eliminada.');

  console.log('\nMigración reparadora completada.');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('Error en migración:', e.message);
  process.exit(1);
});
