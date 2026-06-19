-- ============================================================
-- ESQUEMA DE BASE DE DATOS - RESTAURANTE LA CASCADA
-- ============================================================

-- Tipos ENUM
CREATE TYPE rol_usuario AS ENUM ('admin', 'garzon');
CREATE TYPE estado_mesa AS ENUM ('libre', 'ocupada', 'esperando_pago');
CREATE TYPE tipo_pedido AS ENUM ('mesa', 'delivery', 'retiro');
CREATE TYPE estado_pedido AS ENUM ('pendiente', 'en_preparacion', 'entregado', 'pagado', 'cancelado');
CREATE TYPE metodo_pago AS ENUM ('efectivo', 'debito', 'credito', 'a_credito');
CREATE TYPE estado_reserva AS ENUM ('pendiente', 'entregada', 'cancelada');

-- ============================================================
-- TABLA: usuarios
-- ============================================================
CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           rol_usuario NOT NULL DEFAULT 'garzon',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: mesas
-- Piso 1: 7 mesas | Piso 2: 10 mesas
-- ============================================================
CREATE TABLE mesas (
  id          SERIAL PRIMARY KEY,
  numero_mesa INTEGER NOT NULL,
  piso        INTEGER NOT NULL CHECK (piso IN (1, 2)),
  estado      estado_mesa NOT NULL DEFAULT 'libre',
  tomada_por  VARCHAR(200),
  tomada_desde TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (numero_mesa, piso)
);

-- ============================================================
-- TABLA: categorias
-- ============================================================
CREATE TABLE categorias (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL UNIQUE,
  orden      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: productos
-- Lógica mixta de inventario:
--   - maneja_stock = FALSE => control por switch disponible_dia
--   - maneja_stock = TRUE  => control por stock_actual numérico
-- ============================================================
CREATE TABLE productos (
  id              SERIAL PRIMARY KEY,
  categoria_id    INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  nombre          VARCHAR(200) NOT NULL,
  descripcion     TEXT,
  precio          INTEGER NOT NULL CHECK (precio >= 0),
  ingredientes    TEXT,
  maneja_stock    BOOLEAN NOT NULL DEFAULT FALSE,
  stock_actual    INTEGER NOT NULL DEFAULT 0,
  disponible_dia  BOOLEAN NOT NULL DEFAULT TRUE,
  imagen_url      VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: acompanamientos (extras y base para colaciones)
-- ============================================================
CREATE TABLE acompanamientos (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(150) NOT NULL,
  es_extra    BOOLEAN NOT NULL DEFAULT FALSE,
  recargo     INTEGER NOT NULL DEFAULT 0 CHECK (recargo >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: productos_acompanamientos (relación muchos a muchos)
-- ============================================================
CREATE TABLE productos_acompanamientos (
  id                SERIAL PRIMARY KEY,
  producto_id       INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  acompanamiento_id INTEGER NOT NULL REFERENCES acompanamientos(id) ON DELETE CASCADE,
  UNIQUE (producto_id, acompanamiento_id)
);

-- ============================================================
-- TABLA: pedidos
-- ============================================================
CREATE TABLE pedidos (
  id                SERIAL PRIMARY KEY,
  mesa_id           INTEGER REFERENCES mesas(id) ON DELETE SET NULL,
  usuario_id        INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo_pedido       tipo_pedido NOT NULL DEFAULT 'mesa',
  estado            estado_pedido NOT NULL DEFAULT 'pendiente',
  metodo_pago       metodo_pago,
  total             INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  descuento         INTEGER NOT NULL DEFAULT 0,
  propina           INTEGER NOT NULL DEFAULT 0,
  nombre_cliente    VARCHAR(200),
  direccion         TEXT,
  telefono          VARCHAR(50),
  efectivo_con_cuanto INTEGER DEFAULT 0,
  fecha_hora        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: detalle_pedidos
-- ============================================================
CREATE TABLE detalle_pedidos (
  id              SERIAL PRIMARY KEY,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id     INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  acompanamiento  VARCHAR(300),
  cantidad        INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  subtotal        INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: clientes_credito
-- ============================================================
CREATE TABLE clientes_credito (
  id              SERIAL PRIMARY KEY,
  nombre          VARCHAR(200) NOT NULL,
  rut_o_telefono  VARCHAR(50) UNIQUE NOT NULL,
  limite_credito  INTEGER NOT NULL DEFAULT 0 CHECK (limite_credito >= 0),
  saldo_deudor    INTEGER NOT NULL DEFAULT 0 CHECK (saldo_deudor >= 0),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: abonos (pagos parciales a cuenta corriente)
-- ============================================================
CREATE TABLE abonos (
  id                SERIAL PRIMARY KEY,
  cliente_credito_id INTEGER NOT NULL REFERENCES clientes_credito(id) ON DELETE CASCADE,
  monto             INTEGER NOT NULL CHECK (monto > 0),
  fecha_hora        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: reservas_platos
-- ============================================================
CREATE TABLE reservas_platos (
  id              SERIAL PRIMARY KEY,
  nombre_cliente  VARCHAR(200) NOT NULL,
  producto_id     INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad        INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  hora            TIME,
  estado          estado_reserva NOT NULL DEFAULT 'pendiente',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: turnos
-- ============================================================
CREATE TABLE turnos (
  id            SERIAL PRIMARY KEY,
  tipo_turno    VARCHAR(20) NOT NULL CHECK (tipo_turno IN ('manana', 'medio_dia', 'noche')),
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  estado        VARCHAR(10) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  comentarios   TEXT,
  abierto_por   VARCHAR(200),
  abierto_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrado_desde TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: cajas
-- ============================================================
CREATE TABLE cajas (
  id               SERIAL PRIMARY KEY,
  turno_id         INTEGER REFERENCES turnos(id),
  nombre           VARCHAR(100) NOT NULL DEFAULT 'Caja Principal',
  usuario          VARCHAR(200),
  efectivo_inicial INTEGER NOT NULL DEFAULT 0,
  efectivo_final   INTEGER,
  comentarios      TEXT,
  estado           VARCHAR(10) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  abierta_desde    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrada_desde    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: auditoria
-- ============================================================
CREATE TABLE auditoria (
  id         SERIAL PRIMARY KEY,
  accion     VARCHAR(50) NOT NULL,
  entidad    VARCHAR(50),
  entidad_id INTEGER,
  usuario    VARCHAR(200),
  detalles   TEXT,
  ip         VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: login_attempts
-- ============================================================
CREATE TABLE login_attempts (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  ip         VARCHAR(50),
  exito      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: mesa_bloqueos
-- ============================================================
CREATE TABLE mesa_bloqueos (
  id              SERIAL PRIMARY KEY,
  mesa_id         INTEGER NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  usuario         VARCHAR(200),
  bloqueado_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mesa_id)
);

-- ============================================================
-- TABLA: proveedores
-- ============================================================
CREATE TABLE proveedores (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(200) NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  contacto   VARCHAR(200),
  telefono   VARCHAR(50),
  email      VARCHAR(200),
  direccion  TEXT,
  notas      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_disponible ON productos(disponible_dia, maneja_stock);
CREATE INDEX idx_pedidos_mesa ON pedidos(mesa_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha ON pedidos(fecha_hora DESC);
CREATE INDEX idx_pedidos_tipo ON pedidos(tipo_pedido);
CREATE INDEX idx_pedidos_telefono ON pedidos(telefono);
CREATE INDEX idx_detalle_pedidos_pedido ON detalle_pedidos(pedido_id);
CREATE INDEX idx_clientes_credito_rut ON clientes_credito(rut_o_telefono);
CREATE INDEX idx_abonos_cliente ON abonos(cliente_credito_id);
CREATE INDEX idx_reservas_producto ON reservas_platos(producto_id);
CREATE INDEX idx_reservas_fecha ON reservas_platos(fecha DESC);
CREATE INDEX idx_turnos_fecha ON turnos(fecha DESC);
CREATE INDEX idx_turnos_estado ON turnos(estado);
CREATE INDEX idx_cajas_estado ON cajas(estado);
CREATE INDEX idx_cajas_turno ON cajas(turno_id);
CREATE INDEX idx_auditoria_accion ON auditoria(accion);
CREATE INDEX idx_auditoria_fecha ON auditoria(created_at DESC);
CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_proveedores_activo ON proveedores(activo);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER tg_usuarios_updated_at BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tg_mesas_updated_at BEFORE UPDATE ON mesas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tg_productos_updated_at BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tg_pedidos_updated_at BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tg_clientes_credito_updated_at BEFORE UPDATE ON clientes_credito
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tg_reservas_platos_updated_at BEFORE UPDATE ON reservas_platos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tg_turnos_updated_at BEFORE UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tg_cajas_updated_at BEFORE UPDATE ON cajas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tg_proveedores_updated_at BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCIÓN: Restar stock de productos al confirmar pedido
-- ============================================================
CREATE OR REPLACE FUNCTION restar_stock_producto()
RETURNS TRIGGER AS $$
DECLARE
  v_maneja_stock BOOLEAN;
  v_cantidad INTEGER;
BEGIN
  SELECT maneja_stock INTO v_maneja_stock FROM productos WHERE id = NEW.producto_id;
  v_cantidad := NEW.cantidad;

  IF v_maneja_stock THEN
    UPDATE productos
    SET stock_actual = GREATEST(stock_actual - v_cantidad, 0)
    WHERE id = NEW.producto_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_restar_stock AFTER INSERT ON detalle_pedidos
  FOR EACH ROW EXECUTE FUNCTION restar_stock_producto();

-- ============================================================
-- FUNCIÓN: Restaurar stock al cancelar o eliminar pedido
-- ============================================================
CREATE OR REPLACE FUNCTION restaurar_stock_producto()
RETURNS TRIGGER AS $$
DECLARE
  v_maneja_stock BOOLEAN;
  v_cantidad INTEGER;
BEGIN
  SELECT maneja_stock INTO v_maneja_stock FROM productos WHERE id = OLD.producto_id;
  v_cantidad := OLD.cantidad;

  IF v_maneja_stock THEN
    UPDATE productos
    SET stock_actual = stock_actual + v_cantidad
    WHERE id = OLD.producto_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_restaurar_stock_delete AFTER DELETE ON detalle_pedidos
  FOR EACH ROW EXECUTE FUNCTION restaurar_stock_producto();

CREATE TRIGGER tg_restaurar_stock_cancel AFTER UPDATE ON pedidos
  FOR EACH ROW
  WHEN (OLD.estado != 'cancelado' AND NEW.estado = 'cancelado')
  EXECUTE FUNCTION restaurar_stock_cancelar_pedido();

-- ============================================================
-- FUNCIÓN: Restaurar stock de todo un pedido cancelado
-- ============================================================
CREATE OR REPLACE FUNCTION restaurar_stock_cancelar_pedido()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE productos
  SET stock_actual = stock_actual + dp.cantidad
  FROM detalle_pedidos dp
  WHERE dp.pedido_id = NEW.id
    AND dp.producto_id = productos.id
    AND productos.maneja_stock = TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
