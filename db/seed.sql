-- ============================================================
-- DATOS SEMILLA - RESTAURANTE LA CASCADA
-- ============================================================

-- Usuario admin por defecto (contraseña: admin123 - cambiar en producción)
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES ('Administrador', 'admin@lacascada.cl', '$2b$10$ImkoI26qD7EQFqf6L/mvG.VgBzREi9ky0JQlZqLHl6vXYwZgcHZ4S', 'admin'),
       ('Garzón Principal', 'garzon@lacascada.cl', '$2b$10$XRdoE5Pr0QUz4yOwYtabnO/qfL9LXPFnipisMPD6T0I51M9vLMawm', 'garzon');

-- Mesas: Piso 1 (7 mesas) + Piso 2 (10 mesas)
INSERT INTO mesas (numero_mesa, piso, estado) VALUES
  (1, 1, 'libre'), (2, 1, 'libre'), (3, 1, 'libre'), (4, 1, 'libre'),
  (5, 1, 'libre'), (6, 1, 'libre'), (7, 1, 'libre'),
  (1, 2, 'libre'), (2, 2, 'libre'), (3, 2, 'libre'), (4, 2, 'libre'),
  (5, 2, 'libre'), (6, 2, 'libre'), (7, 2, 'libre'), (8, 2, 'libre'),
  (9, 2, 'libre'), (10, 2, 'libre');

-- Categorías
INSERT INTO categorias (nombre, orden) VALUES
  ('Colaciones', 1),
  ('Extras', 2),
  ('Completos', 3),
  ('Sandwichs', 4),
  ('Bebidas', 5),
  ('Té', 6),
  ('Cafés', 7),
  ('Alcoholes', 8);

-- Acompañamientos base para colaciones
INSERT INTO acompanamientos (nombre, es_extra, recargo) VALUES
  ('Puré', FALSE, 0),
  ('Tallarines', FALSE, 0),
  ('Charquicán', FALSE, 0),
  ('Cazuela', FALSE, 0),
  ('Arroz', FALSE, 0),
  ('Papas Fritas', TRUE, 1500),
  ('Papas Mayo', TRUE, 1800),
  ('Ensalada Chilena', TRUE, 1000);

-- Productos de ejemplo (colaciones - sin stock)
INSERT INTO productos (categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, disponible_dia) VALUES
  (1, 'Pollo al Jugo', 'Pechuga de pollo al jugo con acompañamiento a elección', 6500, 'Pollo, cebolla, zanahoria, papas, caldo de ave', FALSE, TRUE),
  (1, 'Carne al Jugo', 'Carne de vacuno al jugo con acompañamiento a elección', 7000, 'Carne de vacuno, cebolla, zanahoria, papas, caldo de carne', FALSE, TRUE),
  (1, 'Costillar al Jugo', 'Costillar de cerdo al jugo con acompañamiento a elección', 7500, 'Costillar de cerdo, cebolla, ajo, especias', FALSE, TRUE);

-- Productos de ejemplo (bebidas - con stock)
INSERT INTO productos (categoria_id, nombre, descripcion, precio, maneja_stock, stock_actual, disponible_dia) VALUES
  (5, 'Coca-Cola 350cc', 'Bebida Coca-Cola 350cc en lata', 1500, TRUE, 50, TRUE),
  (5, 'Pepsi 350cc', 'Bebida Pepsi 350cc en lata', 1500, TRUE, 40, TRUE),
  (5, 'Sprite 350cc', 'Bebida Sprite 350cc en lata', 1500, TRUE, 35, TRUE),
  (5, 'Fanta 350cc', 'Bebida Fanta 350cc en lata', 1500, TRUE, 30, TRUE);

-- Productos de ejemplo (alcohol - con stock)
INSERT INTO productos (categoria_id, nombre, descripcion, precio, maneja_stock, stock_actual, disponible_dia) VALUES
  (6, 'Cerveza Cristal Litro', 'Cerveza Cristal botella 1 litro', 3500, TRUE, 30, TRUE),
  (6, 'Cerveza Escudo Litro', 'Cerveza Escudo botella 1 litro', 3500, TRUE, 25, TRUE);
