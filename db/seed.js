import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

await pool.query(`
-- Categorías
INSERT INTO categorias (nombre, orden) VALUES
  ('Entradas', 1),
  ('Sandwichs', 2),
  ('Completos', 3),
  ('Colaciones', 4),
  ('Bebidas', 5),
  ('Jugos Naturales', 6),
  ('Cervezas', 7),
  ('Té', 8),
  ('Café', 9),
  ('Postres', 10);
`);

await pool.query(`
-- Acompañamientos
INSERT INTO acompanamientos (nombre, es_extra, recargo) VALUES
  ('Papas Fritas', false, 0),
  ('Papas Rústicas', false, 0),
  ('Ensalada Chilena', false, 0),
  ('Arroz', false, 0),
  ('Puré', false, 0),
  ('Queso', true, 500),
  ('Palta', true, 800),
  ('Churrasco', true, 2000),
  ('Huevo', true, 400),
  ('Tocino', true, 600),
  ('Cheddar', true, 500),
  ('Chucrut', true, 300);
`);

await pool.query(`
-- ===== ENTRADAS (15) =====
INSERT INTO productos (categoria_id, nombre, precio, ingredientes, disponible_dia) VALUES
  (1, 'Empanada de Pino', 2500, 'Masa de horno, pino de carne, cebolla, huevo duro, aceituna', true),
  (1, 'Empanada de Queso', 2200, 'Masa de horno, queso mantecoso derretido', true),
  (1, 'Papas Fritas Grandes', 3500, 'Papas corte bastón, sal de mar, merkén opcional', true),
  (1, 'Papas Rústicas', 3800, 'Papas con piel, romero, ajo, sal gruesa', true),
  (1, 'Sopaipillas (5 un.)', 2000, 'Masa de zapallo frita, pebre o mostaza', true),
  (1, 'Aros de Cebolla', 3200, 'Cebolla empanizada, salsa BBQ', true),
  (1, 'Palitos de Queso (6 un.)', 3500, 'Queso mantecoso empanizado, salsa tártara', true),
  (1, 'Ceviche Clásico', 5500, 'Reineta fresca, limón, cebolla morada, cilantro, ají', true),
  (1, 'Machas a la Parmesana', 6500, 'Machas frescas, queso parmesano gratinado, mantequilla, limón', true),
  (1, 'Tabla de Quesos', 7500, 'Queso mantecoso, queso de cabra, gouda, frutos secos, mermelada', true),
  (1, 'Alitas BBQ (8 un.)', 4800, 'Alitas de pollo, salsa BBQ casera, apio', true),
  (1, 'Palta Reina', 5200, 'Palta hass, pollo desmenuzado, mayonesa, limón', true),
  (1, 'Camarones al Pil Pil', 6800, 'Camarones ecuatorianos, ají, ajo, aceite de oliva', true),
  (1, 'Choritos a la Chalaca', 4500, 'Choritos frescos, tomate, cebolla, cilantro, limón', true),
  (1, 'Bruschettas Caprese', 4200, 'Pan rústico, tomate cherry, albahaca fresca, mozzarella, aceto', true);
`);

await pool.query(`
-- ===== SANDWICHS (15) =====
INSERT INTO productos (categoria_id, nombre, precio, ingredientes, disponible_dia) VALUES
  (2, 'Churrasco Italiano', 6500, 'Churrasco de vacuno, palta, tomate, mayonesa casera, pan frica', true),
  (2, 'Churrasco a lo Pobre', 7000, 'Churrasco de vacuno, huevo frito, cebolla caramelizada, papas fritas, pan', true),
  (2, 'Lomito de Cerdo', 5800, 'Lomo de cerdo a la plancha, palta, tomate, pebre, pan amasado', true),
  (2, 'Barros Luco', 5500, 'Churrasco de vacuno, queso mantecoso derretido, pan frica', true),
  (2, 'Barros Jarpa', 5500, 'Churrasco de vacuno, queso y jamón derretido, pan frica', true),
  (2, 'Ave Palta', 4800, 'Pechuga de pollo grillé, palta, tomate, lechuga, pan molde', true),
  (2, 'Ave Mayo', 4500, 'Pechuga de pollo grillé, mayonesa, lechuga, pan molde', true),
  (2, 'Mechada Italiano', 6200, 'Carne mechada casera, palta, tomate, mayonesa, pan frica', true),
  (2, 'Sandwich de Atún', 4000, 'Atún lomitos, lechuga, tomate, mayonesa, pan molde', true),
  (2, 'Pernil Queso', 5800, 'Pernil de cerdo al horno, queso mantecoso, pebre, pan amasado', true),
  (2, 'Vegetariano Grill', 4500, 'Berenjena, zapallito, pimentón asado, hummus, pan rústico', true),
  (2, 'Pollo Crispy', 5200, 'Pollo crispy, lechuga, tomate, miel mostaza, pan brioche', true),
  (2, 'Hamburguesa Clásica', 5500, 'Carne artesanal 200g, queso cheddar, lechuga, tomate, pepinillos', true),
  (2, 'Hamburguesa BBQ', 6200, 'Carne artesanal 200g, tocino, cheddar, cebolla crispy, BBQ', true),
  (2, 'Sandwich de Salmón', 7200, 'Salmón grillé, palta, queso crema, rúcula, pan ciabatta', true);
`);

await pool.query(`
-- ===== COMPLETOS (15) =====
INSERT INTO productos (categoria_id, nombre, precio, ingredientes, disponible_dia) VALUES
  (3, 'Completo Italiano', 3500, 'Vienesa artesanal, palta, tomate, mayonesa casera, pan de completo', true),
  (3, 'Completo Clásico', 2500, 'Vienesa artesanal, tomate, chucrut, mayonesa, americana, pan', true),
  (3, 'Completo Dinámico', 3000, 'Vienesa, palta, tomate, chucrut, americana, verde', true),
  (3, 'Completo a lo Pobre', 3800, 'Vienesa artesanal, huevo frito, cebolla caramelizada, papas hilo', true),
  (3, 'As (Chilean Hot Dog)', 2200, 'Vienesa, tomate, palta, mayonesa, americana', true),
  (3, 'Completo Costanera', 2800, 'Vienesa, chucrut, tomate, mayonesa, kétchup, mostaza', true),
  (3, 'Completo de Pollo', 3200, 'Vienesa de pollo, palta, tomate, mayonesa light, pan integral', true),
  (3, 'Completo XL', 4200, 'Dos vienesas artesanales, palta, tomate, chucrut, quesillo', true),
  (3, 'Completo Bacon', 3800, 'Vienesa artesanal, tocino crujiente, cheddar, cebolla crispy', true),
  (3, 'Completo Snack', 1800, 'Vienesa pequeña, tomate, mayonesa, pan mini', true),
  (3, 'Completo Porteño', 3200, 'Vienesa, palta, choclo, tomate, cilantro, mayo de ají', true),
  (3, 'Completo Alemán', 3500, 'Salchicha alemana, chucrut, mostaza Dijon, pepinillos, pan', true),
  (3, 'Completo Veggie', 3000, 'Vienesa vegetal, palta, tomate, pepinillos, mayo vegana', true),
  (3, 'Completo Campeón', 4000, 'Vienesa, churrasco fino, palta, tomate, queso, huevo', true),
  (3, 'Completo Delivery Pack (2)', 5000, 'Dos completos italianos + papas fritas pequeñas', true);
`);

await pool.query(`
-- ===== COLACIONES (15) =====
INSERT INTO productos (categoria_id, nombre, precio, ingredientes, disponible_dia) VALUES
  (4, 'Pollo con Papas Fritas', 6500, 'Pechuga de pollo grillé, papas fritas, ensalada surtida', true),
  (4, 'Churrasco con Papas', 7000, 'Churrasco de vacuno 250g, papas rústicas, pebre', true),
  (4, 'Pescado Frito', 6200, 'Reineta fresca frita, arroz, ensalada chilena', true),
  (4, 'Salmón a la Plancha', 7800, 'Salmón del sur, puré de papas, vegetales salteados', true),
  (4, 'Lomo Salteado', 7500, 'Lomo vetado en tiras, cebolla, pimentón, arroz, papas fritas', true),
  (4, 'Pastel de Choclo', 5800, 'Pastel de choclo casero, pino de carne, pollo, aceituna, huevo', true),
  (4, 'Cazuela de Vacuno', 5500, 'Carne de vacuno, zapallo, choclo, papas, arroz, caldo', true),
  (4, 'Cazuela de Pollo', 5000, 'Pollo, zapallo, choclo, papas, arroz, caldo de ave', true),
  (4, 'Charquicán', 5200, 'Carne desmenuzada, papas, zapallo, choclo, cebolla, huevo frito', true),
  (4, 'Porotos con Rienda', 4800, 'Porotos granados, tallarines, zapallo, longaniza', true),
  (4, 'Tallarines con Salsa', 5000, 'Tallarines artesanales, salsa boloñesa o blanca, queso rallado', true),
  (4, 'Ensalada César con Pollo', 5500, 'Lechuga romana, pollo grillé, crutones, parmesano, salsa César', true),
  (4, 'Wrap de Carne', 5200, 'Tortilla wrap, carne mechada, palta, tomate, queso crema', true),
  (4, 'Wrap de Pollo', 4800, 'Tortilla wrap, pollo grillé, lechuga, tomate, mayonesa', true),
  (4, 'Menú Vegetariano', 5500, 'Quinoa, vegetales salteados, hummus, palta, ensalada fresca', true);
`);

await pool.query(`
-- ===== BEBIDAS (15) =====
INSERT INTO productos (categoria_id, nombre, precio, ingredientes, disponible_dia) VALUES
  (5, 'Coca-Cola Lata 350cc', 1500, 'Bebida gaseosa sabor cola', true),
  (5, 'Coca-Cola Zero Lata 350cc', 1500, 'Bebida gaseosa sabor cola sin azúcar', true),
  (5, 'Fanta Lata 350cc', 1500, 'Bebida gaseosa sabor naranja', true),
  (5, 'Sprite Lata 350cc', 1500, 'Bebida gaseosa sabor lima-limón', true),
  (5, 'Agua Mineral c/gas 500cc', 1200, 'Agua mineral con gas, marca Cachantún', true),
  (5, 'Agua Mineral s/gas 500cc', 1200, 'Agua mineral sin gas, marca Cachantún', true),
  (5, 'Bilz y Pap 350cc', 1500, 'Bebida gaseosa sabor frutal chilena', true),
  (5, 'Canada Dry Ginger Ale 350cc', 1800, 'Bebida gaseosa sabor jengibre', true),
  (5, 'Red Bull 250cc', 2800, 'Bebida energética sabor original', true),
  (5, 'Monster Energy 473cc', 3000, 'Bebida energética sabor original', true),
  (5, 'Limonada Clásica 500cc', 2500, 'Limón fresco, agua, azúcar, hielo, menta', true),
  (5, 'Mote con Huesillo 500cc', 2800, 'Mote de trigo, huesillos, jugo de huesillo, canela', true),
  (5, 'Batido de Frutilla 400cc', 3000, 'Leche, frutillas frescas, azúcar, hielo', true),
  (5, 'Batido de Plátano 400cc', 3000, 'Leche, plátano, miel, hielo', true),
  (5, 'Batido de Chocolate 400cc', 3200, 'Leche, chocolate en polvo, crema, hielo', true);
`);

await pool.query(`
-- ===== JUGOS NATURALES (15) =====
INSERT INTO productos (categoria_id, nombre, precio, ingredientes, disponible_dia) VALUES
  (6, 'Jugo de Naranja Natural 400cc', 2800, 'Naranjas frescas exprimidas, hielo', true),
  (6, 'Jugo de Frutilla 400cc', 3000, 'Frutillas frescas, agua, azúcar, hielo', true),
  (6, 'Jugo de Frambuesa 400cc', 3200, 'Frambuesas frescas, agua, azúcar, hielo', true),
  (6, 'Jugo de Piña 400cc', 2800, 'Piña fresca, agua, hielo', true),
  (6, 'Jugo de Melón 400cc', 2800, 'Melón calameño fresco, agua, hielo', true),
  (6, 'Jugo de Sandía 400cc', 2500, 'Sandía fresca, agua, hielo', true),
  (6, 'Jugo de Mango 400cc', 3200, 'Mango fresco, agua, hielo', true),
  (6, 'Jugo de Manzana 400cc', 2500, 'Manzana verde, agua, hielo', true),
  (6, 'Jugo de Durazno 400cc', 2800, 'Duraznos frescos, agua, azúcar, hielo', true),
  (6, 'Jugo de Kiwi 400cc', 3000, 'Kiwis frescos, agua, azúcar, hielo', true),
  (6, 'Jugo Verde Detox 400cc', 3500, 'Apio, espinaca, manzana verde, jengibre, limón', true),
  (6, 'Jugo de Zanahoria 400cc', 2800, 'Zanahoria fresca, naranja, jengibre', true),
  (6, 'Jugo de Maracuyá 400cc', 3200, 'Maracuyá fresco, agua, azúcar, hielo', true),
  (6, 'Jugo de Papaya 400cc', 3000, 'Papaya fresca, agua, hielo', true),
  (6, 'Jugo Mixto Tropical 400cc', 3500, 'Piña, mango, maracuyá, hielo', true);
`);

await pool.query(`
-- ===== CERVEZAS (15) =====
INSERT INTO productos (categoria_id, nombre, precio, ingredientes, disponible_dia) VALUES
  (7, 'Cerveza Cristal 350cc', 2000, 'Cerveza lager chilena rubia', true),
  (7, 'Cerveza Escudo 350cc', 2000, 'Cerveza lager chilena tradicional', true),
  (7, 'Cerveza Austral Calafate 330cc', 3200, 'Cerveza artesanal magallánica sabor calafate', true),
  (7, 'Cerveza Kross 330cc', 3500, 'Cerveza artesanal chilena golden ale', true),
  (7, 'Cerveza Kunstmann Torobayo 330cc', 3500, 'Cerveza artesanal valdiviana honey ale', true),
  (7, 'Cerveza Guayacán Imperial Stout 330cc', 4000, 'Cerveza artesanal stout oscura y cremosa', true),
  (7, 'Stella Artois 330cc', 3200, 'Cerveza belga premium lager', true),
  (7, 'Corona 355cc', 3000, 'Cerveza mexicana lager, limón opcional', true),
  (7, 'Heineken 330cc', 3000, 'Cerveza holandesa lager premium', true),
  (7, 'Budweiser 330cc', 2500, 'Cerveza americana lager', true),
  (7, 'Cerveza sin Alcohol 330cc', 2200, 'Cerveza lager 0% alcohol', true),
  (7, 'Schop Cristal 500cc', 3500, 'Cerveza de barril Cristal, tirada fría', true),
  (7, 'Schop Kunstmann 500cc', 4500, 'Cerveza de barril Kunstmann, tirada fría', true),
  (7, 'Chela Michelada 500cc', 4000, 'Cerveza Cristal, limón, salsa inglesa, merkén, sal', true),
  (7, 'Pack Chelas (6 Cristal)', 8000, '6 cervezas Cristal 350cc para llevar', true);
`);

await pool.query(`
-- ===== TÉ (15) =====
INSERT INTO productos (categoria_id, nombre, precio, ingredientes, disponible_dia) VALUES
  (8, 'Té Negro Clásico', 1500, 'Té negro Ceylán, agua caliente, limón opcional', true),
  (8, 'Té Verde', 1800, 'Té verde Sencha japonés, agua caliente', true),
  (8, 'Té de Manzanilla', 1500, 'Flores de manzanilla, agua caliente, miel opcional', true),
  (8, 'Té de Menta', 1500, 'Hojas de menta fresca, agua caliente', true),
  (8, 'Té de Hierbas Sur', 1800, 'Boldo, cedrón, poleo, agua caliente', true),
  (8, 'Té Chai Latte', 2800, 'Té negro, especias, leche vaporizada, canela', true),
  (8, 'Té de Jazmín', 2000, 'Té verde con flores de jazmín, agua caliente', true),
  (8, 'Té de Frutos Rojos', 2200, 'Hibisco, frutilla, frambuesa, arándano, agua caliente', true),
  (8, 'Té Earl Grey', 2000, 'Té negro con bergamota, agua caliente', true),
  (8, 'Té Blanco', 2500, 'Té blanco Bai Mu Dan, agua caliente', true),
  (8, 'Té Rooibos', 2200, 'Rooibos sudafricano sin cafeína, agua caliente', true),
  (8, 'Té de Cáscara de Naranja', 1800, 'Cáscara de naranja deshidratada, canela, clavo de olor', true),
  (8, 'Té Helado Limón 500cc', 2500, 'Té negro frío, limón, hielo, menta', true),
  (8, 'Té Helado Durazno 500cc', 2500, 'Té negro frío, durazno, hielo, menta', true),
  (8, 'Infusión Digestiva', 2000, 'Cedrón, menta, anís estrellado, jengibre, agua caliente', true);
`);

await pool.query(`
-- ===== CAFÉ (15) =====
INSERT INTO productos (categoria_id, nombre, precio, ingredientes, disponible_dia) VALUES
  (9, 'Espresso Simple', 1800, 'Café espresso molienda fina, extracción 30ml', true),
  (9, 'Espresso Doble', 2500, 'Café espresso molienda fina, extracción 60ml', true),
  (9, 'Café Americano', 2000, 'Espresso doble, agua caliente', true),
  (9, 'Café Latte', 2800, 'Espresso, leche vaporizada, microespuma', true),
  (9, 'Cappuccino', 3000, 'Espresso, leche vaporizada, espuma espesa, cacao en polvo', true),
  (9, 'Mocaccino', 3500, 'Espresso, chocolate, leche vaporizada, crema batida', true),
  (9, 'Flat White', 3000, 'Espresso doble, leche vaporizada, microespuma fina', true),
  (9, 'Café Cortado', 2200, 'Espresso, gota de leche vaporizada', true),
  (9, 'Affogato', 3800, 'Espresso, helado de vainilla artesanal', true),
  (9, 'Frappé de Vainilla', 3500, 'Café, leche, hielo, vainilla, crema batida', true),
  (9, 'Frappé de Caramelo', 3800, 'Café, leche, hielo, caramelo, crema batida', true),
  (9, 'Iced Latte', 3000, 'Espresso, leche fría, hielo', true),
  (9, 'Cold Brew 400cc', 3500, 'Café de especialidad infusión en frío 18h, hielo', true),
  (9, 'Café Irlandés', 4800, 'Café, whisky, crema batida, azúcar morena', true),
  (9, 'Descafeinado', 1800, 'Café descafeinado, opción americano o latte', true);
`);

await pool.query(`
-- ===== POSTRES (15) =====
INSERT INTO productos (categoria_id, nombre, precio, ingredientes, disponible_dia) VALUES
  (10, 'Torta Tres Leches', 3800, 'Bizcocho, leche evaporada, crema de leche, leche condensada, merengue', true),
  (10, 'Flan de Caramelo', 2500, 'Huevos, leche, azúcar, caramelo líquido', true),
  (10, 'Tiramisú', 4000, 'Mascarpone, café, bizcochos de soletilla, cacao en polvo', true),
  (10, 'Brownie con Helado', 4200, 'Brownie de chocolate amargo, helado de vainilla, salsa de chocolate', true),
  (10, 'Cheesecake de Maracuyá', 3800, 'Queso crema, galletas de mantequilla, maracuyá fresca', true),
  (10, 'Copa de Helado (2 sabores)', 3200, 'Helado artesanal a elección, barquillo, salsa', true),
  (10, 'Kuchen de Manzana', 3000, 'Masa quebrada, manzanas caramelizadas, canela, crema', true),
  (10, 'Suspiro Limeño', 3500, 'Manjar, merengue italiano, oporto, canela', true),
  (10, 'Mousse de Chocolate', 3200, 'Chocolate amargo, crema, huevos, azúcar', true),
  (10, 'Crepé de Manjar', 3000, 'Crepé francés, manjar casero, plátano, nueces', true),
  (10, 'Leche Nevada', 2800, 'Merengue flotante, crema inglesa, caramelo', true),
  (10, 'Panqueques con Dulce de Leche', 3000, 'Panqueques finos, dulce de leche casero, crema', true),
  (10, 'Tarta de Limón', 3000, 'Masa sablée, crema de limón, merengue tostado', true),
  (10, 'Helado Frito', 3500, 'Helado de vainilla apanado en coco y corn flakes, miel', true),
  (10, 'Degustación de Mini Postres', 5500, 'Brownie, cheesecake, mousse, flan en porciones pequeñas', true);
`);

await pool.query(`
-- Vincular acompañamientos base a colaciones (categoria_id=4)
INSERT INTO productos_acompanamientos (producto_id, acompanamiento_id)
SELECT p.id, a.id FROM productos p, acompanamientos a
WHERE p.categoria_id = 4 AND a.es_extra = false;

-- Vincular acompañamientos base a sandwiches (categoria_id=2)
INSERT INTO productos_acompanamientos (producto_id, acompanamiento_id)
SELECT p.id, a.id FROM productos p, acompanamientos a
WHERE p.categoria_id = 2 AND a.es_extra = false;

-- Extras disponibles para sandwiches
INSERT INTO productos_acompanamientos (producto_id, acompanamiento_id)
SELECT p.id, a.id FROM productos p, acompanamientos a
WHERE p.categoria_id = 2 AND a.es_extra = true;

-- Extras disponibles para completos
INSERT INTO productos_acompanamientos (producto_id, acompanamiento_id)
SELECT p.id, a.id FROM productos p, acompanamientos a
WHERE p.categoria_id = 3 AND a.es_extra = true;
`);

console.log('✅ Datos de prueba insertados:');
console.log('   10 categorías');
console.log('   150 productos (15 por categoría)');
console.log('   12 acompañamientos');
console.log('   Relaciones producto-acompañamiento creadas');
pool.end();
