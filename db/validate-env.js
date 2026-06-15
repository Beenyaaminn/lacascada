import pg from 'pg';

const { Pool } = pg;

async function validate() {
  const errors = [];
  const warnings = [];

  console.log('═══════════════════════════════════════');
  console.log('  La Cascada - Validacion de Entorno');
  console.log('═══════════════════════════════════════\n');

  const DATABASE_URL = process.env.DATABASE_URL;
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!DATABASE_URL) {
    errors.push('DATABASE_URL no esta configurada');
  } else {
    console.log('[ENV] DATABASE_URL: configurada');
  }

  if (!JWT_SECRET) {
    errors.push('JWT_SECRET no esta configurada');
  } else if (JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET tiene menos de 32 caracteres. Se recomienda usar uno mas largo.');
    console.log('[ENV] JWT_SECRET: configurada (corta)');
  } else {
    console.log('[ENV] JWT_SECRET: configurada (segura)');
  }

  if (errors.length > 0) {
    console.log('\nERRORES CRITICOS:');
    errors.forEach(e => console.log(`  - ${e}`));
    console.log('\nLa aplicacion no puede iniciar. Corrige los errores en .env\n');
    process.exit(1);
  }

  console.log('\n[DB] Verificando conexion a PostgreSQL...');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  try {
    const result = await pool.query('SELECT current_database() as db, version() as v');
    console.log(`[DB] Conectado a: ${result.rows[0].db}`);
    console.log(`[DB] PostgreSQL: ${result.rows[0].v.split(',')[0]}`);

    const requiredTables = [
      'usuarios', 'mesas', 'categorias', 'productos', 'acompanamientos',
      'productos_acompanamientos', 'pedidos', 'detalle_pedidos',
      'clientes_credito', 'abonos', 'reservas_platos',
      'turnos', 'cajas', 'auditoria', 'login_attempts',
      'mesa_bloqueos', 'proveedores',
    ];

    const { rows: existing } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const existingNames = existing.map((r) => r.table_name);
    const missing = requiredTables.filter(t => !existingNames.includes(t));

    if (missing.length > 0) {
      console.log('\n[DB] Tablas faltantes:');
      missing.forEach(t => console.log(`  - ${t}`));
      console.log('\nEjecuta la migracion: node db/migrate.js\n');
    } else {
      console.log(`[DB] ${requiredTables.length} tablas verificadas`);
    }

    const adminCheck = await pool.query(
      `SELECT id, email FROM usuarios WHERE rol = 'admin' LIMIT 1`
    );
    if (adminCheck.rows.length > 0) {
      console.log(`[DB] Admin encontrado: ${adminCheck.rows[0].email}`);
    } else {
      warnings.push('No se encontro usuario admin en la BD');
      console.log('[DB] ADMIN NO ENCONTRADO - ejecuta la migracion');
    }

  } catch (e) {
    console.error(`[DB] ERROR DE CONEXION: ${e.message}`);
    errors.push(`No se pudo conectar a la base de datos: ${e.message}`);
  } finally {
    await pool.end().catch(() => {});
  }

  if (errors.length > 0) {
    console.log('\nERRORES:');
    errors.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('\nADVERTENCIAS:');
    warnings.forEach(w => console.log(`  - ${w}`));
  }

  console.log('\nValidacion completada. Iniciando servidor...\n');
}

validate();
