// Migración idempotente: productos de Dominó (getjusto) -> La Cascada
// Categorías destino: 'Completos', 'As' y 'Sándwiches de la Casa'.
// Los sándwiches de Dominó tienen precio según proteína elegida;
// como La Cascada no maneja modificadores, se crea un producto por
// variante de proteína con su precio exacto.
// Los As de Dominó tienen precio único (la proteína no cambia el precio).
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL);

const COMPLETOS = [
  { nombre: 'Completo Chacarero', desc: 'Poroto verde, ají verde, tomate y mayo', precio: 4650, ingredientes: 'Pan, vienesa, poroto verde, ají verde, tomate, mayo' },
  { nombre: 'Completo Alemán', desc: 'Tomate, chucrut y mayo', precio: 4550, ingredientes: 'Pan, vienesa, tomate, chucrut, mayo' },
  { nombre: 'Completo Antiguo', desc: 'Palta, americana y mayo', precio: 4650, ingredientes: 'Pan, vienesa, palta, americana, mayo' },
  { nombre: 'Completo Dominó', desc: 'Americana, salsa verde, tomate y mayo', precio: 4550, ingredientes: 'Pan, vienesa, americana, salsa verde, tomate, mayo' },
  { nombre: 'Completo Luco', desc: 'Queso', precio: 4650, ingredientes: 'Pan, vienesa, queso' },
  { nombre: 'Completo Italiano', desc: 'Palta, tomate y mayo', precio: 4650, ingredientes: 'Pan, vienesa, palta, tomate, mayo' },
  { nombre: 'Completo Dinámico', desc: 'Palta, americana, salsa verde, tomate y mayo', precio: 4950, ingredientes: 'Pan, vienesa, palta, americana, salsa verde, tomate, mayo' },
  { nombre: 'Completo Brasileño', desc: 'Queso y palta', precio: 5350, ingredientes: 'Pan, vienesa, queso, palta' },
  { nombre: 'Completo Rodeo Spicy', desc: 'Queso a la plancha y tocino con salsa BBQ spicy', precio: 5750, ingredientes: 'Pan, vienesa, queso a la plancha, tocino, salsa BBQ spicy' },
];

// As de Dominó: precio único (proteína base: carne picada)
const ASES = [
  { nombre: 'As Alemán', desc: 'Tomate, chucrut y mayo', precio: 5250, ingredientes: 'Pan, carne picada, tomate, chucrut, mayo' },
  { nombre: 'As Antiguo', desc: 'Palta, americana y mayo', precio: 5350, ingredientes: 'Pan, carne picada, palta, americana, mayo' },
  { nombre: 'As Dominó', desc: 'Americana, salsa verde, tomate y mayo', precio: 5250, ingredientes: 'Pan, carne picada, americana, salsa verde, tomate, mayo' },
  { nombre: 'As Luco', desc: 'Queso', precio: 5350, ingredientes: 'Pan, carne picada, queso' },
  { nombre: 'As Italiano', desc: 'Palta, tomate y mayo', precio: 5350, ingredientes: 'Pan, carne picada, palta, tomate, mayo' },
  { nombre: 'As Dinámico', desc: 'Palta, americana, salsa verde, tomate y mayo', precio: 5550, ingredientes: 'Pan, carne picada, palta, americana, salsa verde, tomate, mayo' },
  { nombre: 'As Brasileño', desc: 'Queso y palta', precio: 5850, ingredientes: 'Pan, carne picada, queso, palta' },
  { nombre: 'As Rodeo Spicy', desc: 'Queso a la plancha y tocino con salsa BBQ spicy', precio: 6450, ingredientes: 'Pan, carne picada, queso a la plancha, tocino, salsa BBQ spicy' },
];

// Proteínas con precio por tipo de sándwich (según Domino)
const PROTEINAS = ['Pollo', 'Churrasco', 'Champiñones Salteados', 'Mechada'];

const SANDWICHES = [
  {
    base: 'Sándwich Alemán', desc: 'Tomate, chucrut y mayo',
    precios: { Pollo: 7850, Churrasco: 8850, 'Champiñones Salteados': 8850, Mechada: 9650 },
    toppings: 'tomate, chucrut, mayo',
  },
  {
    base: 'Sándwich Dominó', desc: 'Americana, salsa verde, tomate y mayo',
    precios: { Pollo: 7850, Churrasco: 8850, 'Champiñones Salteados': 8850, Mechada: 9650 },
    toppings: 'americana, salsa verde, tomate, mayo',
  },
  {
    base: 'Sándwich Luco', desc: 'Queso',
    precios: { Pollo: 7950, Churrasco: 8950, 'Champiñones Salteados': 8950, Mechada: 9750 },
    toppings: 'queso',
  },
  {
    base: 'Sándwich Brasileño', desc: 'Queso y palta',
    precios: { Pollo: 8450, Churrasco: 9450, 'Champiñones Salteados': 9450, Mechada: 10250 },
    toppings: 'queso, palta',
  },
  {
    base: 'Sándwich Rodeo Spicy', desc: 'Queso a la plancha y tocino con salsa BBQ spicy',
    precios: { Pollo: 8350, Churrasco: 9450, 'Champiñones Salteados': 9450, Mechada: 10150 },
    toppings: 'queso a la plancha, tocino, salsa BBQ spicy',
  },
];

function ingredientesSandwich(proteina, toppings) {
  return `Pan, ${proteina.toLowerCase()}, ${toppings}`;
}

async function insertarProductos(catId, lista) {
  let insertados = 0;
  let omitidos = 0;
  for (const p of lista) {
    const existe = await sql`
      SELECT id FROM productos WHERE categoria_id = ${catId} AND nombre = ${p.nombre}
    `;
    if (existe.length > 0) {
      console.log(`  (ya existe) ${p.nombre}`);
      omitidos++;
      continue;
    }
    await sql`
      INSERT INTO productos (categoria_id, nombre, descripcion, precio, ingredientes, maneja_stock, stock_actual, disponible_dia)
      VALUES (${catId}, ${p.nombre}, ${p.desc}, ${p.precio}, ${p.ingredientes}, FALSE, 0, TRUE)
    `;
    console.log(`  + ${p.nombre} - $${p.precio.toLocaleString('es-CL')}`);
    insertados++;
  }
  return { insertados, omitidos };
}

async function migrate() {
  console.log('Migrando productos Dominó -> La Cascada...\n');

  // 1. Separar categorías: 'Completos y Ases' pasa a llamarse 'Completos'
  const renombrada = await sql`
    UPDATE categorias SET nombre = 'Completos'
    WHERE nombre = 'Completos y Ases'
    RETURNING id
  `;
  if (renombrada.length > 0) {
    console.log("Categoría 'Completos y Ases' renombrada a 'Completos'.\n");
  }

  // 2. Crear categoría 'As' si no existe, ubicándola después de 'Completos'
  let catAs = await sql`SELECT id FROM categorias WHERE nombre = 'As'`;
  if (catAs.length === 0) {
    await sql`UPDATE categorias SET orden = orden + 1 WHERE orden >= 2`;
    catAs = await sql`
      INSERT INTO categorias (nombre, orden) VALUES ('As', 2)
      RETURNING id
    `;
    console.log("Categoría 'As' creada (orden 2).\n");
  }
  const catAsId = catAs[0].id;

  const cats = await sql`SELECT id, nombre FROM categorias`;
  const catIds = {};
  for (const c of cats) catIds[c.nombre] = c.id;

  const catCompletos = catIds['Completos'];
  const catSandwiches = catIds['Sándwiches de la Casa'];
  if (!catCompletos || !catSandwiches) {
    throw new Error('No se encontraron las categorías destino en la BD');
  }

  // 3. Mover el producto seed 'As a la Chilena' a la categoría 'As'
  const movido = await sql`
    UPDATE productos SET categoria_id = ${catAsId}
    WHERE nombre = 'As a la Chilena' AND categoria_id = ${catCompletos}
    RETURNING id
  `;
  if (movido.length > 0) {
    console.log("Producto 'As a la Chilena' movido a la categoría 'As'.\n");
  }

  console.log('[Completos]');
  const r1 = await insertarProductos(catCompletos, COMPLETOS);

  console.log('\n[As]');
  const rAs = await insertarProductos(catAsId, ASES);

  console.log('\n[Sándwiches de la Casa]');
  const listaSandwiches = [];
  for (const s of SANDWICHES) {
    for (const prot of PROTEINAS) {
      listaSandwiches.push({
        nombre: `${s.base} ${prot}`,
        desc: s.desc,
        precio: s.precios[prot],
        ingredientes: ingredientesSandwich(prot, s.toppings),
      });
    }
  }
  const r2 = await insertarProductos(catSandwiches, listaSandwiches);

  console.log(`\nListo: ${r1.insertados + rAs.insertados + r2.insertados} insertados, ${r1.omitidos + rAs.omitidos + r2.omitidos} ya existían.`);
  process.exit(0);
}

migrate().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
