import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

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

async function migrate() {
  console.log('Iniciando migracion de La Cascada...\n');

  // ======== ENUM TYPES ========
  console.log('[1/5] Creando tipos ENUM...');
  await sql`DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('admin', 'garzon', 'cliente');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TYPE estado_mesa AS ENUM ('libre', 'ocupada', 'esperando_pago');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TYPE tipo_pedido AS ENUM ('mesa', 'delivery', 'retiro', 'reserva');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TYPE estado_pedido AS ENUM ('pendiente', 'en_preparacion', 'entregado', 'pagado', 'cancelado');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TYPE metodo_pago AS ENUM ('efectivo', 'debito', 'credito', 'a_credito');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TYPE estado_reserva AS ENUM ('pendiente', 'entregada', 'cancelada', 'confirmada');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  // En BD ya existentes el CREATE TYPE es no-op: agregar valores nuevos
  await sql`ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'cliente'`;
  await sql`ALTER TYPE tipo_pedido ADD VALUE IF NOT EXISTS 'reserva'`;
  await sql`ALTER TYPE estado_reserva ADD VALUE IF NOT EXISTS 'confirmada'`;
  console.log('  ENUMs listos.');

  // ======== TABLAS ========
  console.log('[2/5] Creando tablas...');

  await sql`CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol rol_usuario NOT NULL DEFAULT 'garzon',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mesas (
    id SERIAL PRIMARY KEY,
    numero_mesa INTEGER NOT NULL,
    piso INTEGER NOT NULL CHECK (piso IN (1, 2)),
    estado estado_mesa NOT NULL DEFAULT 'libre',
    tomada_por VARCHAR(200),
    tomada_desde TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (numero_mesa, piso)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    precio INTEGER NOT NULL CHECK (precio >= 0),
    ingredientes TEXT,
    maneja_stock BOOLEAN NOT NULL DEFAULT FALSE,
    stock_actual INTEGER NOT NULL DEFAULT 0,
    disponible_dia BOOLEAN NOT NULL DEFAULT TRUE,
    imagen_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS acompanamientos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    es_extra BOOLEAN NOT NULL DEFAULT FALSE,
    recargo INTEGER NOT NULL DEFAULT 0 CHECK (recargo >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS productos_acompanamientos (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    acompanamiento_id INTEGER NOT NULL REFERENCES acompanamientos(id) ON DELETE CASCADE,
    UNIQUE (producto_id, acompanamiento_id)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    mesa_id INTEGER REFERENCES mesas(id) ON DELETE SET NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo_pedido tipo_pedido NOT NULL DEFAULT 'mesa',
    estado estado_pedido NOT NULL DEFAULT 'pendiente',
    metodo_pago metodo_pago,
    total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
    descuento INTEGER NOT NULL DEFAULT 0,
    propina INTEGER NOT NULL DEFAULT 0,
    nombre_cliente VARCHAR(200),
    direccion TEXT,
    telefono VARCHAR(50),
    efectivo_con_cuanto INTEGER DEFAULT 0,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  
  // Agregar columnas de delivery si la tabla ya existía
  await sql`DO $$ BEGIN
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nombre_cliente VARCHAR(200);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS direccion TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS telefono VARCHAR(50);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS efectivo_con_cuanto INTEGER DEFAULT 0;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`;

  await sql`CREATE TABLE IF NOT EXISTS detalle_pedidos (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    acompanamiento VARCHAR(300),
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS clientes_credito (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    rut_o_telefono VARCHAR(50) UNIQUE NOT NULL,
    limite_credito INTEGER NOT NULL DEFAULT 0 CHECK (limite_credito >= 0),
    saldo_deudor INTEGER NOT NULL DEFAULT 0 CHECK (saldo_deudor >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS abonos (
    id SERIAL PRIMARY KEY,
    cliente_credito_id INTEGER NOT NULL REFERENCES clientes_credito(id) ON DELETE CASCADE,
    monto INTEGER NOT NULL CHECK (monto > 0),
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS reservas_platos (
    id SERIAL PRIMARY KEY,
    nombre_cliente VARCHAR(200) NOT NULL,
    producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    mesa_id INTEGER REFERENCES mesas(id) ON DELETE SET NULL,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME,
    estado estado_reserva NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    contacto VARCHAR(200),
    telefono VARCHAR(50),
    email VARCHAR(200),
    direccion TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS turnos (
    id SERIAL PRIMARY KEY,
    tipo_turno VARCHAR(20) NOT NULL CHECK (tipo_turno IN ('manana', 'medio_dia', 'noche')),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    estado VARCHAR(10) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
    comentarios TEXT,
    abierto_por VARCHAR(200),
    abierto_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_desde TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS cajas (
    id SERIAL PRIMARY KEY,
    turno_id INTEGER REFERENCES turnos(id),
    nombre VARCHAR(100) NOT NULL DEFAULT 'Caja Principal',
    usuario VARCHAR(200),
    efectivo_inicial INTEGER NOT NULL DEFAULT 0,
    efectivo_final INTEGER,
    comentarios TEXT,
    estado VARCHAR(10) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
    abierta_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrada_desde TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS auditoria (
    id SERIAL PRIMARY KEY,
    accion VARCHAR(50) NOT NULL,
    entidad VARCHAR(50),
    entidad_id INTEGER,
    usuario VARCHAR(200),
    detalles TEXT,
    ip VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip VARCHAR(50),
    exito BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mesa_bloqueos (
    id SERIAL PRIMARY KEY,
    mesa_id INTEGER NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
    usuario VARCHAR(200),
    bloqueado_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (mesa_id)
  )`;

  // Columnas agregadas post-lanzamiento (van aquí porque referencian
  // tablas creadas más arriba; idempotentes para BD ya existentes)
  await sql`DO $$ BEGIN
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS costo_envio INTEGER NOT NULL DEFAULT 0;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comentarios VARCHAR(300);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_credito_id INTEGER REFERENCES clientes_credito(id);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS caja_id INTEGER REFERENCES cajas(id);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE reservas_platos ADD COLUMN IF NOT EXISTS mesa_id INTEGER REFERENCES mesas(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE cajas ADD COLUMN IF NOT EXISTS efectivo_esperado INTEGER;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`;
  // Stock nunca negativo (idempotente)
  await sql`UPDATE productos SET stock_actual = 0 WHERE stock_actual < 0`;
  await sql`DO $$ BEGIN
    ALTER TABLE productos ADD CONSTRAINT stock_no_negativo CHECK (stock_actual >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  // reservas_platos.producto_id es nullable (reservas de mesa sin producto)
  await sql`ALTER TABLE reservas_platos ALTER COLUMN producto_id DROP NOT NULL`;

  console.log('  Tablas creadas.');

  // ======== INDICES ========
  console.log('[3/5] Creando indices...');
  await sql`CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_productos_disponible ON productos(disponible_dia, maneja_stock)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pedidos_mesa ON pedidos(mesa_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_hora DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pedidos_tipo ON pedidos(tipo_pedido)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pedidos_telefono ON pedidos(telefono)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_pedido ON detalle_pedidos(pedido_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_clientes_credito_rut ON clientes_credito(rut_o_telefono)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_abonos_cliente ON abonos(cliente_credito_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reservas_producto ON reservas_platos(producto_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas_platos(fecha DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_estado ON pedidos(mesa_id, estado)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_detalle_pedido ON detalle_pedidos(pedido_id)`;
  // Solo UNA caja abierta a la vez (evita race conditions)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_caja_abierta ON cajas(estado) WHERE estado = 'abierta'`;
  console.log('  Indices creados.');

  // ======== TRIGGERS ========
  console.log('[4/5] Creando triggers...');
  await sql`CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $func$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql`;

  await sql`DO $$ BEGIN
    CREATE TRIGGER tg_usuarios_updated_at BEFORE UPDATE ON usuarios
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TRIGGER tg_mesas_updated_at BEFORE UPDATE ON mesas
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TRIGGER tg_productos_updated_at BEFORE UPDATE ON productos
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TRIGGER tg_pedidos_updated_at BEFORE UPDATE ON pedidos
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TRIGGER tg_clientes_credito_updated_at BEFORE UPDATE ON clientes_credito
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TRIGGER tg_reservas_platos_updated_at BEFORE UPDATE ON reservas_platos
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TRIGGER tg_turnos_updated_at BEFORE UPDATE ON turnos
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TRIGGER tg_cajas_updated_at BEFORE UPDATE ON cajas
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`DO $$ BEGIN
    CREATE TRIGGER tg_proveedores_updated_at BEFORE UPDATE ON proveedores
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;

  // NOTA: no se crean triggers de stock. El stock se descuenta y restaura
  // atómicamente en la aplicación (src/lib/pricing.ts). Un trigger de BD
  // causaría doble descuento (ver db/fixes-migration.cjs).
  console.log('  Triggers creados.');

  // ======== SEED DATA ========
  console.log('[5/5] Insertando datos semilla...');

  const existingAdmin = await sql`SELECT id FROM usuarios WHERE email = 'admin@lacascada.cl' LIMIT 1`;
  if (existingAdmin.length === 0) {
    await sql`INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
      ('Administrador', 'admin@lacascada.cl', '$2b$10$ImkoI26qD7EQFqf6L/mvG.VgBzREi9ky0JQlZqLHl6vXYwZgcHZ4S', 'admin'),
      ('Garzon Principal', 'garzon@lacascada.cl', '$2b$10$XRdoE5Pr0QUz4yOwYtabnO/qfL9LXPFnipisMPD6T0I51M9vLMawm', 'garzon')`;
    console.log('  Usuarios admin/garzon insertados.');
  } else {
    console.log('  Usuarios ya existen, saltando.');
  }

  // Mesas
  const existingMesas = await sql`SELECT COUNT(*) as cnt FROM mesas`;
  if (existingMesas[0].cnt === '0') {
    for (let piso = 1; piso <= 2; piso++) {
      const max = piso === 1 ? 7 : 10;
      for (let num = 1; num <= max; num++) {
        await sql`INSERT INTO mesas (numero_mesa, piso, estado) VALUES (${num}, ${piso}, 'libre')`;
      }
    }
    console.log('  Mesas insertadas (Piso 1: 7, Piso 2: 10).');
  } else {
    console.log('  Mesas ya existen, saltando.');
  }

  // Categorias
  const existingCategorias = await sql`SELECT COUNT(*) as cnt FROM categorias`;
  if (existingCategorias[0].cnt === '0') {
    await sql`INSERT INTO categorias (nombre, orden) VALUES
      ('Colaciones', 1), ('Extras', 2), ('Completos', 3),
      ('Sandwichs', 4), ('Bebidas', 5), ('T\u00e9', 6),
      ('Caf\u00e9s', 7), ('Alcoholes', 8)`;
    console.log('  Categorias insertadas.');
  } else {
    console.log('  Categorias ya existen, saltando.');
  }

  // Acompanamientos
  const existingAcomp = await sql`SELECT COUNT(*) as cnt FROM acompanamientos`;
  if (existingAcomp[0].cnt === '0') {
    await sql`INSERT INTO acompanamientos (nombre, es_extra, recargo) VALUES
      ('Pure', FALSE, 0), ('Tallarines', FALSE, 0), ('Charquican', FALSE, 0),
      ('Cazuela', FALSE, 0), ('Arroz', FALSE, 0),
      ('Papas Fritas', TRUE, 1500), ('Papas Mayo', TRUE, 1800), ('Ensalada Chilena', TRUE, 1000)`;
    console.log('  Acompanamientos insertados.');
  } else {
    console.log('  Acompanamientos ya existen, saltando.');
  }

  // Productos de ejemplo
  const existingProductos = await sql`SELECT COUNT(*) as cnt FROM productos`;
  if (existingProductos[0].cnt === '0') {
    const cats = await sql`SELECT id, nombre FROM categorias ORDER BY orden`;
    const catMap = {};
    for (const c of cats) catMap[c.nombre] = c.id;

    const productos = [
      { cat: 'Colaciones', nombre: 'Pollo al Jugo', desc: 'Pechuga de pollo al jugo con acompañamiento a elección', precio: 6500, ing: 'Pollo, cebolla, zanahoria, papas, caldo de ave', stk: false },
      { cat: 'Colaciones', nombre: 'Carne al Jugo', desc: 'Carne de vacuno al jugo con acompañamiento a elección', precio: 7000, ing: 'Carne de vacuno, cebolla, zanahoria, papas, caldo', stk: false },
      { cat: 'Colaciones', nombre: 'Costillar al Jugo', desc: 'Costillar de cerdo al jugo con acompañamiento a elección', precio: 7500, ing: 'Costillar de cerdo, cebolla, ajo, especias', stk: false },
      { cat: 'Colaciones', nombre: 'Bistec a lo Pobre', desc: 'Bistec de vacuno con huevo frito, cebolla caramelizada y papas', precio: 8500, ing: 'Bistec vacuno, huevo, cebolla, papas fritas', stk: false },
      { cat: 'Extras', nombre: 'Papas Fritas Grandes', desc: 'Porción grande de papas fritas caseras', precio: 2500, ing: null, stk: true },
      { cat: 'Extras', nombre: 'Papas Mayo Grandes', desc: 'Papas fritas grandes con salsa de mayo casera', precio: 3000, ing: null, stk: true },
      { cat: 'Extras', nombre: 'Ensalada Chilena Grande', desc: 'Ensalada de tomate, cebolla, cilantro y aliño', precio: 2000, ing: 'Tomate, cebolla, cilantro, limón, aceite de oliva', stk: true },
      { cat: 'Extras', nombre: 'Sopaipillas (3 unid.)', desc: 'Tres sopaipillas caseras con pebre', precio: 1500, ing: 'Zapallo, harina, manteca', stk: true },
      { cat: 'Completos', nombre: 'Completo Italiano', desc: 'Vienesa, palta, tomate y mayonesa', precio: 2800, ing: 'Pan, vienesa, palta, tomate, mayonesa', stk: false },
      { cat: 'Completos', nombre: 'Completo Americano', desc: 'Vienesa, tomate, pepinillo, chucrut y mayonesa', precio: 3000, ing: 'Pan, vienesa, tomate, pepinillo, chucrut, mayonesa', stk: false },
      { cat: 'Completos', nombre: 'Completo Chacarero', desc: 'Vienesa, porotos verdes, ají verde y mayonesa', precio: 3200, ing: 'Pan, vienesa, porotos verdes, ají verde, mayonesa', stk: false },
      { cat: 'Completos', nombre: 'Completo Dinámico', desc: 'Vienesa, palta, tomate, americana, salsa verde', precio: 3500, ing: 'Pan, vienesa, palta, tomate, americana, salsa verde', stk: false },
      { cat: 'Sandwichs', nombre: 'Churrasco Italiano', desc: 'Churrasco con palta, tomate y mayonesa', precio: 4500, ing: 'Pan, churrasco, palta, tomate, mayonesa', stk: false },
      { cat: 'Sandwichs', nombre: 'Churrasco Americano', desc: 'Churrasco con tomate, pepinillo, chucrut y mayonesa', precio: 5000, ing: 'Pan, churrasco, tomate, pepinillo, chucrut, mayonesa', stk: false },
      { cat: 'Sandwichs', nombre: 'Barros Luco', desc: 'Sandwich de carne con queso fundido', precio: 4000, ing: 'Pan, carne, queso', stk: false },
      { cat: 'Sandwichs', nombre: 'Chacarero', desc: 'Sandwich de carne con porotos verdes y ají', precio: 4500, ing: 'Pan, carne, porotos verdes, ají verde, mayonesa', stk: false },
      { cat: 'Bebidas', nombre: 'Coca-Cola 350cc', desc: 'Bebida Coca-Cola 350cc en lata', precio: 1500, ing: null, stk: true },
      { cat: 'Bebidas', nombre: 'Pepsi 350cc', desc: 'Bebida Pepsi 350cc en lata', precio: 1500, ing: null, stk: true },
      { cat: 'Bebidas', nombre: 'Sprite 350cc', desc: 'Bebida Sprite 350cc en lata', precio: 1500, ing: null, stk: true },
      { cat: 'Bebidas', nombre: 'Fanta 350cc', desc: 'Bebida Fanta 350cc en lata', precio: 1500, ing: null, stk: true },
      { cat: 'Bebidas', nombre: 'Agua Mineral 500cc', desc: 'Agua mineral sin gas 500cc', precio: 1000, ing: null, stk: true },
      { cat: 'Té', nombre: 'Té Caliente', desc: 'Té negro caliente servido en taza', precio: 800, ing: null, stk: false },
      { cat: 'Té', nombre: 'Té Helado', desc: 'Té negro helado con limón', precio: 1200, ing: null, stk: false },
      { cat: 'Té', nombre: 'Té de Menta', desc: 'Infusión de menta fresca caliente', precio: 1000, ing: null, stk: false },
      { cat: 'Té', nombre: 'Té de Manzanilla', desc: 'Infusión de manzanilla caliente con miel', precio: 1000, ing: null, stk: false },
      { cat: 'Cafés', nombre: 'Café Expresso', desc: 'Café expresso corto y concentrado', precio: 1200, ing: null, stk: false },
      { cat: 'Cafés', nombre: 'Café Americano', desc: 'Café americano largo', precio: 1500, ing: null, stk: false },
      { cat: 'Cafés', nombre: 'Café Capuchino', desc: 'Café capuchino con leche cremosa y canela', precio: 2000, ing: null, stk: false },
      { cat: 'Cafés', nombre: 'Café Mocha', desc: 'Café mocha con chocolate y crema batida', precio: 2500, ing: null, stk: false },
      { cat: 'Alcoholes', nombre: 'Cerveza Cristal Litro', desc: 'Cerveza Cristal botella 1 litro', precio: 3500, ing: null, stk: true },
      { cat: 'Alcoholes', nombre: 'Cerveza Escudo Litro', desc: 'Cerveza Escudo botella 1 litro', precio: 3500, ing: null, stk: true },
      { cat: 'Alcoholes', nombre: 'Cerveza Stella Artois', desc: 'Cerveza Stella Artois botella 330cc', precio: 4500, ing: null, stk: true },
      { cat: 'Alcoholes', nombre: 'Pisco Sour', desc: 'Pisco sour preparado con limón de pica', precio: 5000, ing: 'Pisco, limón, azúcar flor, hielo, amargo de angostura', stk: false },
      { cat: 'Alcoholes', nombre: 'Vino Tinto Copa', desc: 'Copa de vino tinto Cabernet Sauvignon', precio: 2500, ing: null, stk: false },
    ];

    for (const p of productos) {
      const catId = catMap[p.cat];
      if (!catId) { console.log(`  WARN: categoria "${p.cat}" no encontrada`); continue; }
      await sql`INSERT INTO productos (categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, stock_actual, disponible_dia) VALUES (${catId}, ${p.nombre}, ${p.desc}, ${p.precio}, ${p.ing}, ${p.stk}, ${p.stk ? 50 : 0}, TRUE)`;
    }
    console.log('  Productos de ejemplo insertados (34 items).');
  } else {
    console.log('  Productos ya existen, saltando.');
  }

  console.log('\nMigracion completada exitosamente!');

  // Verify
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE ANY(ARRAY['usuarios','mesas','categorias','productos','acompanamientos','productos_acompanamientos','pedidos','detalle_pedidos','clientes_credito','abonos','reservas_platos']) ORDER BY table_name`;
  console.log('\nTablas de La Cascada:');
  tables.forEach(t => console.log(`  - ${t.table_name}`));

  process.exit(0);
}

migrate().catch(e => {
  console.error('Error en migracion:', e.message);
  process.exit(1);
});
