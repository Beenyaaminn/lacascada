import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL);

async function updateMenu() {
  console.log('Actualizando menu de La Cascada...\n');

  console.log('Limpiando datos existentes...');
  await sql`DELETE FROM productos_acompanamientos`;
  await sql`DELETE FROM productos`;
  await sql`DELETE FROM categorias`;
  console.log('  Datos limpiados.\n');

  console.log('Insertando categorias...');
  const cats = await sql`
    INSERT INTO categorias (nombre, orden) VALUES
      ('Completos y Ases', 1),
      ('Sándwiches de la Casa', 2),
      ('Plant-Based (Vegano)', 3),
      ('Para Compartir', 4),
      ('Promociones', 5)
    RETURNING id, nombre, orden
  `;
  for (const c of cats) console.log(`  [${c.orden}] ${c.nombre} (id=${c.id})`);
  const catIds = {};
  for (const c of cats) catIds[c.nombre] = c.id;

  console.log('\nInsertando acompanamientos (si no existen)...');
  const existingAcomp = await sql`SELECT COUNT(*) as cnt FROM acompanamientos`;
  if (Number(existingAcomp[0].cnt) === 0) {
    await sql`INSERT INTO acompanamientos (nombre, es_extra, recargo) VALUES
      ('Arroz', FALSE, 0), ('Pure', FALSE, 0), ('Papas Mayo', FALSE, 0),
      ('Tallarines', FALSE, 0), ('Papas Salteadas', FALSE, 0), ('Arroz Primavera', FALSE, 0),
      ('Papas Fritas', FALSE, 2000)`;
    console.log('  Acompanamientos insertados.');
  } else {
    console.log('  Acompanamientos ya existen.');
  }

  console.log('\nInsertando productos...');

  const productos = [
    // Completos y Ases
    { cat: 'Completos y Ases', nombre: 'Italiano', desc: 'Vienesa, palta, tomate y mayonesa casera', precio: 4650, ingredientes: 'Pan, vienesa, palta, tomate, mayonesa', stock: false },
    { cat: 'Completos y Ases', nombre: 'As a la Chilena', desc: 'Carne asada con tomate, palta y mayonesa', precio: 5490, ingredientes: 'Pan, carne asada, tomate, palta, mayonesa', stock: false },
    // Sándwiches de la Casa
    { cat: 'Sándwiches de la Casa', nombre: 'Chacarero', desc: 'Carne con porotos verdes, ají verde y mayonesa', precio: 4650, ingredientes: 'Pan, carne, porotos verdes, ají verde, mayonesa', stock: false },
    { cat: 'Sándwiches de la Casa', nombre: 'Luco', desc: 'Carne con queso fundido', precio: 4650, ingredientes: 'Pan, carne, queso', stock: false },
    { cat: 'Sándwiches de la Casa', nombre: 'Smash Burger Clásica', desc: 'Hamburguesa smash con queso cheddar, pepinillos y salsa de la casa', precio: 7490, ingredientes: 'Pan, hamburguesa smash, queso cheddar, pepinillos, salsa de la casa', stock: false },
    // Plant-Based (Vegano)
    { cat: 'Plant-Based (Vegano)', nombre: 'Veggie de la Casa', desc: 'Hamburguesa de legumbres con palta, tomate y mayo vegana', precio: 5990, ingredientes: 'Pan, hamburguesa de legumbres, palta, tomate, mayo vegana', stock: false },
    { cat: 'Plant-Based (Vegano)', nombre: 'Italiano Vegano', desc: 'Vienesa vegana con palta, tomate y mayo vegana', precio: 4990, ingredientes: 'Pan, vienesa vegana, palta, tomate, mayo vegana', stock: false },
    // Para Compartir
    { cat: 'Para Compartir', nombre: 'Tabla La Cascada', desc: 'Papas rústicas, churrascos, pollo crocante y salsas de la casa', precio: 12990, ingredientes: 'Papas rústicas, churrasco, pollo crocante, salsas de la casa', stock: false },
    { cat: 'Para Compartir', nombre: 'Papas de la Casa', desc: 'Papas rústicas con mayo casera y pebre', precio: 4990, ingredientes: 'Papas, mayo casera, pebre', stock: false },
    // Promociones
    { cat: 'Promociones', nombre: 'Promo Veggie Doble', desc: '2 sandwiches Veggie de la Casa + 2 bebidas', precio: 14590, ingredientes: '2 Veggie de la Casa, 2 bebidas', stock: false },
    { cat: 'Promociones', nombre: 'Promo Smash + Papas', desc: 'Smash Burger Clásica + Papas de la Casa', precio: 9990, ingredientes: 'Smash Burger Clásica, Papas de la Casa', stock: false },
  ];

  for (const p of productos) {
    const catId = catIds[p.cat];
    if (!catId) { console.log(`  ERROR: categoria "${p.cat}" no encontrada`); continue; }
    await sql`
      INSERT INTO productos (categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, stock_actual, disponible_dia)
      VALUES (${catId}, ${p.nombre}, ${p.desc}, ${p.precio}, ${p.ingredientes}, ${p.stock}, ${p.stock ? 50 : 0}, TRUE)
    `;
    console.log(`  [${p.cat}] ${p.nombre} - $${p.precio.toLocaleString('es-CL')}`);
  }

  console.log('\nProductos insertados correctamente.');

  process.exit(0);
}

updateMenu().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
