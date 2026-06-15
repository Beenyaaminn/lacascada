import pg from 'pg';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const { Pool } = pg;
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
      ('Colaciones', 1),
      ('Extras', 2),
      ('Completos', 3),
      ('Sandwichs', 4),
      ('Bebidas', 5),
      ('T\u00e9', 6),
      ('Caf\u00e9s', 7),
      ('Alcoholes', 8)
    RETURNING id, nombre, orden
  `;
  for (const c of cats) console.log(`  [${c.orden}] ${c.nombre} (id=${c.id})`);
  const catIds = {};
  for (const c of cats) catIds[c.nombre] = c.id;

  console.log('\nInsertando acompanamientos (si no existen)...');
  const existingAcomp = await sql`SELECT COUNT(*) as cnt FROM acompanamientos`;
  if (Number(existingAcomp[0].cnt) === 0) {
    await sql`INSERT INTO acompanamientos (nombre, es_extra, recargo) VALUES
      ('Pure', FALSE, 0), ('Tallarines', FALSE, 0), ('Charquican', FALSE, 0),
      ('Cazuela', FALSE, 0), ('Arroz', FALSE, 0),
      ('Papas Fritas', TRUE, 1500), ('Papas Mayo', TRUE, 1800), ('Ensalada Chilena', TRUE, 1000)`;
    console.log('  Acompanamientos insertados.');
  } else {
    console.log('  Acompanamientos ya existen.');
  }

  console.log('\nInsertando productos...');

  const productos = [
    // Colaciones
    { cat: 'Colaciones', nombre: 'Pollo al Jugo', desc: 'Pechuga de pollo al jugo con acompañamiento a elección', precio: 6500, ingredientes: 'Pollo, cebolla, zanahoria, papas, caldo de ave', stock: false },
    { cat: 'Colaciones', nombre: 'Carne al Jugo', desc: 'Carne de vacuno al jugo con acompañamiento a elección', precio: 7000, ingredientes: 'Carne de vacuno, cebolla, zanahoria, papas, caldo', stock: false },
    { cat: 'Colaciones', nombre: 'Costillar al Jugo', desc: 'Costillar de cerdo al jugo con acompañamiento a elección', precio: 7500, ingredientes: 'Costillar de cerdo, cebolla, ajo, especias', stock: false },
    { cat: 'Colaciones', nombre: 'Bistec a lo Pobre', desc: 'Bistec de vacuno con huevo frito, cebolla caramelizada y papas', precio: 8500, ingredientes: 'Bistec vacuno, huevo, cebolla, papas fritas', stock: false },
    // Extras
    { cat: 'Extras', nombre: 'Papas Fritas Grandes', desc: 'Porción grande de papas fritas caseras', precio: 2500, ingredientes: null, stock: true },
    { cat: 'Extras', nombre: 'Papas Mayo Grandes', desc: 'Papas fritas grandes con salsa de mayo casera', precio: 3000, ingredientes: null, stock: true },
    { cat: 'Extras', nombre: 'Ensalada Chilena Grande', desc: 'Ensalada de tomate, cebolla, cilantro y aliño', precio: 2000, ingredientes: 'Tomate, cebolla, cilantro, limón, aceite de oliva', stock: true },
    { cat: 'Extras', nombre: 'Sopaipillas (3 unidades)', desc: 'Tres sopaipillas caseras con pebre', precio: 1500, ingredientes: 'Zapallo, harina, manteca', stock: true },
    // Completos
    { cat: 'Completos', nombre: 'Completo Italiano', desc: 'Vienesa, palta, tomate y mayonesa', precio: 2800, ingredientes: 'Pan, vienesa, palta, tomate, mayonesa', stock: false },
    { cat: 'Completos', nombre: 'Completo Americano', desc: 'Vienesa, tomate, pepinillo, chucrut y mayonesa', precio: 3000, ingredientes: 'Pan, vienesa, tomate, pepinillo, chucrut, mayonesa', stock: false },
    { cat: 'Completos', nombre: 'Completo Chacarero', desc: 'Vienesa, porotos verdes, ají verde y mayonesa', precio: 3200, ingredientes: 'Pan, vienesa, porotos verdes, ají verde, mayonesa', stock: false },
    { cat: 'Completos', nombre: 'Completo Dinámico', desc: 'Vienesa, palta, tomate, americana, salsa verde', precio: 3500, ingredientes: 'Pan, vienesa, palta, tomate, americana, salsa verde', stock: false },
    // Sandwichs
    { cat: 'Sandwichs', nombre: 'Churrasco Italiano', desc: 'Churrasco con palta, tomate y mayonesa', precio: 4500, ingredientes: 'Pan, churrasco, palta, tomate, mayonesa', stock: false },
    { cat: 'Sandwichs', nombre: 'Churrasco Americano', desc: 'Churrasco con tomate, pepinillo, chucrut y mayonesa', precio: 5000, ingredientes: 'Pan, churrasco, tomate, pepinillo, chucrut, mayonesa', stock: false },
    { cat: 'Sandwichs', nombre: 'Barros Luco', desc: 'Sandwich de carne con queso fundido', precio: 4000, ingredientes: 'Pan, carne, queso', stock: false },
    { cat: 'Sandwichs', nombre: 'Chacarero', desc: 'Sandwich de carne con porotos verdes y ají', precio: 4500, ingredientes: 'Pan, carne, porotos verdes, ají verde, mayonesa', stock: false },
    // Bebidas
    { cat: 'Bebidas', nombre: 'Coca-Cola 350cc', desc: 'Bebida Coca-Cola 350cc en lata', precio: 1500, ingredientes: null, stock: true },
    { cat: 'Bebidas', nombre: 'Pepsi 350cc', desc: 'Bebida Pepsi 350cc en lata', precio: 1500, ingredientes: null, stock: true },
    { cat: 'Bebidas', nombre: 'Sprite 350cc', desc: 'Bebida Sprite 350cc en lata', precio: 1500, ingredientes: null, stock: true },
    { cat: 'Bebidas', nombre: 'Fanta 350cc', desc: 'Bebida Fanta 350cc en lata', precio: 1500, ingredientes: null, stock: true },
    { cat: 'Bebidas', nombre: 'Agua Mineral 500cc', desc: 'Agua mineral sin gas 500cc', precio: 1000, ingredientes: null, stock: true },
    // Té
    { cat: 'Té', nombre: 'Té Caliente', desc: 'Té negro caliente servido en taza', precio: 800, ingredientes: null, stock: false },
    { cat: 'Té', nombre: 'Té Helado', desc: 'Té negro helado con limón', precio: 1200, ingredientes: null, stock: false },
    { cat: 'Té', nombre: 'Té de Menta', desc: 'Infusión de menta fresca caliente', precio: 1000, ingredientes: null, stock: false },
    { cat: 'Té', nombre: 'Té de Manzanilla', desc: 'Infusión de manzanilla caliente con miel', precio: 1000, ingredientes: null, stock: false },
    // Cafés
    { cat: 'Cafés', nombre: 'Café Expresso', desc: 'Café expresso corto y concentrado', precio: 1200, ingredientes: null, stock: false },
    { cat: 'Cafés', nombre: 'Café Americano', desc: 'Café americano largo', precio: 1500, ingredientes: null, stock: false },
    { cat: 'Cafés', nombre: 'Café Capuchino', desc: 'Café capuchino con leche cremosa y canela', precio: 2000, ingredientes: null, stock: false },
    { cat: 'Cafés', nombre: 'Café Mocha', desc: 'Café mocha con chocolate y crema batida', precio: 2500, ingredientes: null, stock: false },
    // Alcoholes
    { cat: 'Alcoholes', nombre: 'Cerveza Cristal Litro', desc: 'Cerveza Cristal botella 1 litro', precio: 3500, ingredientes: null, stock: true },
    { cat: 'Alcoholes', nombre: 'Cerveza Escudo Litro', desc: 'Cerveza Escudo botella 1 litro', precio: 3500, ingredientes: null, stock: true },
    { cat: 'Alcoholes', nombre: 'Cerveza Stella Artois', desc: 'Cerveza Stella Artois botella 330cc', precio: 4500, ingredientes: null, stock: true },
    { cat: 'Alcoholes', nombre: 'Pisco Sour', desc: 'Pisco sour preparado con limón de pica y azúcar flor', precio: 5000, ingredientes: 'Pisco, limón, azúcar flor, hielo, amargo de angostura', stock: false },
    { cat: 'Alcoholes', nombre: 'Vino Tinto Copa', desc: 'Copa de vino tinto Cabernet Sauvignon', precio: 2500, ingredientes: null, stock: false },
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
