// Migración idempotente: productos de Dominó (getjusto) -> La Cascada
// Categorías destino: 'Completos y Ases' y 'Sándwiches de la Casa'.
// Los sándwiches de Dominó tienen precio según proteína elegida;
// como La Cascada no maneja modificadores, se crea un producto por
// variante de proteína con su precio exacto.
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL);

const COMPLETOS = [
  { nombre: 'Completo Chacarero', desc: 'Poroto verde, ají verde, tomate y mayo Dominó', precio: 4650, ingredientes: 'Pan, vienesa, poroto verde, ají verde, tomate, mayo Dominó' },
  { nombre: 'Completo Alemán', desc: 'Tomate, chucrut y mayo Dominó', precio: 4550, ingredientes: 'Pan, vienesa, tomate, chucrut, mayo Dominó' },
  { nombre: 'Completo Antiguo', desc: 'Palta, americana y mayo Dominó', precio: 4650, ingredientes: 'Pan, vienesa, palta, americana, mayo Dominó' },
  { nombre: 'Completo Dominó', desc: 'Americana, salsa verde, tomate y mayo Dominó', precio: 4550, ingredientes: 'Pan, vienesa, americana, salsa verde, tomate, mayo Dominó' },
  { nombre: 'Completo Luco', desc: 'Queso', precio: 4650, ingredientes: 'Pan, vienesa, queso' },
  { nombre: 'Completo Italiano', desc: 'Palta, tomate y mayo Dominó', precio: 4650, ingredientes: 'Pan, vienesa, palta, tomate, mayo Dominó' },
  { nombre: 'Completo Dinámico', desc: 'Palta, americana, salsa verde, tomate y mayo Dominó', precio: 4950, ingredientes: 'Pan, vienesa, palta, americana, salsa verde, tomate, mayo Dominó' },
  { nombre: 'Completo Brasileño', desc: 'Queso y palta', precio: 5350, ingredientes: 'Pan, vienesa, queso, palta' },
  { nombre: 'Completo Rodeo Spicy', desc: 'Queso a la plancha y tocino con salsa BBQ spicy', precio: 5750, ingredientes: 'Pan, vienesa, queso a la plancha, tocino, salsa BBQ spicy' },
];

// Proteínas con precio por tipo de sándwich (según Domino)
const PROTEINAS = ['Pollo', 'Churrasco', 'Champiñones Salteados', 'Mechada'];

const SANDWICHES = [
  {
    base: 'Sándwich Alemán', desc: 'Tomate, chucrut y mayo Dominó',
    precios: { Pollo: 7850, Churrasco: 8850, 'Champiñones Salteados': 8850, Mechada: 9650 },
    toppings: 'tomate, chucrut, mayo Dominó',
  },
  {
    base: 'Sándwich Dominó', desc: 'Americana, salsa verde, tomate y mayo Dominó',
    precios: { Pollo: 7850, Churrasco: 8850, 'Champiñones Salteados': 8850, Mechada: 9650 },
    toppings: 'americana, salsa verde, tomate, mayo Dominó',
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

  const cats = await sql`SELECT id, nombre FROM categorias`;
  const catIds = {};
  for (const c of cats) catIds[c.nombre] = c.id;

  const catCompletos = catIds['Completos y Ases'];
  const catSandwiches = catIds['Sándwiches de la Casa'];
  if (!catCompletos || !catSandwiches) {
    throw new Error('No se encontraron las categorías destino en la BD');
  }

  console.log('[Completos y Ases]');
  const r1 = await insertarProductos(catCompletos, COMPLETOS);

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

  console.log(`\nListo: ${r1.insertados + r2.insertados} insertados, ${r1.omitidos + r2.omitidos} ya existían.`);
  process.exit(0);
}

migrate().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
