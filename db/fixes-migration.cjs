/**
 * Migración de correcciones de seguridad e integridad - La Cascada
 * Ejecutar: node db/fixes-migration.cjs
 */
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

(async () => {
  console.log('Iniciando migración...');

  // 1) Columna costo_envio en pedidos (antes se abusaba de la columna descuento)
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS costo_envio INTEGER NOT NULL DEFAULT 0`;
  console.log('✓ columna costo_envio creada');

  // Migrar datos históricos: delivery/retiro/reserva usaban descuento para el envío
  await sql`UPDATE pedidos SET costo_envio = descuento WHERE tipo_pedido IN ('delivery', 'retiro', 'reserva') AND descuento > 0`;
  await sql`UPDATE pedidos SET descuento = 0 WHERE tipo_pedido IN ('delivery', 'retiro', 'reserva') AND descuento > 0`;
  console.log('✓ datos históricos de envío migrados');

  // 2) Columna cliente_credito_id en pedidos (para pagos a crédito)
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_credito_id INTEGER REFERENCES clientes_credito(id)`;
  console.log('✓ columna cliente_credito_id creada');

  // 3) Eliminar trigger de stock: ahora el stock se descuenta atómicamente en la app
  await sql`DROP TRIGGER IF EXISTS tg_restar_stock ON detalle_pedidos`;
  console.log('✓ trigger tg_restar_stock eliminado (stock atómico en app)');

  // 4) Clamp de stock negativo + constraint
  await sql`UPDATE productos SET stock_actual = 0 WHERE stock_actual < 0`;
  try {
    await sql`ALTER TABLE productos ADD CONSTRAINT stock_no_negativo CHECK (stock_actual >= 0)`;
    console.log('✓ constraint stock_no_negativo creada');
  } catch (e) {
    if (e.message.includes('already exists')) console.log('✓ constraint stock_no_negativo ya existía');
    else throw e;
  }

  // 5) Índices para las consultas frecuentes
  await sql`CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_estado ON pedidos(mesa_id, estado)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_hora)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_detalle_pedido ON detalle_pedidos(pedido_id)`;
  console.log('✓ índices creados');

  // 6) caja_id en pedidos para atribución correcta de pagos a cajas
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS caja_id INTEGER REFERENCES cajas(id)`;
  console.log('✓ columna caja_id creada');

  // 7) Solo UNA caja abierta a la vez (constraint a nivel BD, evita race conditions)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_caja_abierta ON cajas(estado) WHERE estado = 'abierta'`;
  console.log('✓ índice único de caja abierta creado');

  // 8) Snapshot de efectivo esperado al cerrar caja
  await sql`ALTER TABLE cajas ADD COLUMN IF NOT EXISTS efectivo_esperado INTEGER`;
  console.log('✓ columna efectivo_esperado en cajas');

  console.log('\nMigración completada con éxito.');
  process.exit(0);
})().catch((e) => {
  console.error('Error en migración:', e);
  process.exit(1);
});
