-- ============================================================
-- DATOS SEMILLA - RESTAURANTE LA CASCADA
-- ============================================================

-- Usuario admin por defecto (contraseña: admin123 - cambiar en producción)
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES ('Administrador', 'admin@lacascada.cl', '$2b$10$ImkoI26qD7EQFqf6L/mvG.VgBzREi9ky0JQlZqLHl6vXYwZgcHZ4S', 'admin'),
       ('Garzón Principal', 'garzon@lacascada.cl', '$2b$10$XRdoE5Pr0QUz4yOwYtabnO/qfL9LXPFnipisMPD6T0I51M9vLMawm', 'garzon');

-- Mesas: Piso 1 (7 mesas) + Piso 2 (10 mesas) + PUB/piso 3 (9 sillas)
INSERT INTO mesas (numero_mesa, piso, estado) VALUES
  (1, 1, 'libre'), (2, 1, 'libre'), (3, 1, 'libre'), (4, 1, 'libre'),
  (5, 1, 'libre'), (6, 1, 'libre'), (7, 1, 'libre'),
  (1, 2, 'libre'), (2, 2, 'libre'), (3, 2, 'libre'), (4, 2, 'libre'),
  (5, 2, 'libre'), (6, 2, 'libre'), (7, 2, 'libre'), (8, 2, 'libre'),
  (9, 2, 'libre'), (10, 2, 'libre'),
  (1, 3, 'libre'), (2, 3, 'libre'), (3, 3, 'libre'), (4, 3, 'libre'),
  (5, 3, 'libre'), (6, 3, 'libre'), (7, 3, 'libre'), (8, 3, 'libre'),
  (9, 3, 'libre');

-- Categorías principales de la carta
INSERT INTO categorias (nombre, orden) VALUES
  ('Completos y Ases', 1),
  ('Sándwiches de la Casa', 2),
  ('Plant-Based (Vegano)', 3),
  ('Para Compartir', 4),
  ('Promociones', 5);

-- Acompañamientos (base para colaciones y extras configurables desde el admin)
INSERT INTO acompanamientos (nombre, es_extra, recargo) VALUES
  ('Arroz', FALSE, 0),
  ('Puré', FALSE, 0),
  ('Papas Mayo', FALSE, 0),
  ('Tallarines', FALSE, 0),
  ('Papas Salteadas', FALSE, 0),
  ('Arroz Primavera', FALSE, 0),
  ('Papas Fritas', FALSE, 2000);

-- Productos: Completos y Ases
INSERT INTO productos (categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, disponible_dia) VALUES
  (1, 'Italiano', 'Vienesa, palta, tomate y mayonesa casera', 4650, 'Pan, vienesa, palta, tomate, mayonesa', FALSE, TRUE),
  (1, 'As a la Chilena', 'Carne asada con tomate, palta y mayonesa', 5490, 'Pan, carne asada, tomate, palta, mayonesa', FALSE, TRUE);

-- Productos: Sándwiches de la Casa
INSERT INTO productos (categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, disponible_dia) VALUES
  (2, 'Chacarero', 'Carne con porotos verdes, ají verde y mayonesa', 4650, 'Pan, carne, porotos verdes, ají verde, mayonesa', FALSE, TRUE),
  (2, 'Luco', 'Carne con queso fundido', 4650, 'Pan, carne, queso', FALSE, TRUE),
  (2, 'Smash Burger Clásica', 'Hamburguesa smash con queso cheddar, pepinillos y salsa de la casa', 7490, 'Pan, hamburguesa smash, queso cheddar, pepinillos, salsa de la casa', FALSE, TRUE);

-- Productos: Plant-Based (Vegano)
INSERT INTO productos (categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, disponible_dia) VALUES
  (3, 'Veggie de la Casa', 'Hamburguesa de legumbres con palta, tomate y mayo vegana', 5990, 'Pan, hamburguesa de legumbres, palta, tomate, mayo vegana', FALSE, TRUE),
  (3, 'Italiano Vegano', 'Vienesa vegana con palta, tomate y mayo vegana', 4990, 'Pan, vienesa vegana, palta, tomate, mayo vegana', FALSE, TRUE);

-- Productos: Para Compartir
INSERT INTO productos (categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, disponible_dia) VALUES
  (4, 'Tabla La Cascada', 'Papas rústicas, churrascos, pollo crocante y salsas de la casa', 12990, 'Papas rústicas, churrasco, pollo crocante, salsas de la casa', FALSE, TRUE),
  (4, 'Papas de la Casa', 'Papas rústicas con mayo casera y pebre', 4990, 'Papas, mayo casera, pebre', FALSE, TRUE);

-- Productos: Promociones
INSERT INTO productos (categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, disponible_dia) VALUES
  (5, 'Promo Veggie Doble', '2 sandwiches Veggie de la Casa + 2 bebidas', 14590, '2 Veggie de la Casa, 2 bebidas', FALSE, TRUE),
  (5, 'Promo Smash + Papas', 'Smash Burger Clásica + Papas de la Casa', 9990, 'Smash Burger Clásica, Papas de la Casa', FALSE, TRUE);
