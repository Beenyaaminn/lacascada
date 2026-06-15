# La Cascada - Sistema de Punto de Venta

Sistema de gestion integral para restaurante con menu digital QR, toma de pedidos, control de mesas, caja diaria, manejo de turnos, stock y reportes.

## Stack

| Capa | Tecnologia |
|---|---|
| Framework | Astro 5 + SSR |
| Frontend | Svelte 5 + Tailwind CSS |
| Base de datos | PostgreSQL 16 |
| Runtime | Node.js 22 |
| Deploy | Docker + Dokploy (VPS) |

## Inicio rapido

```bash
npm install
cp .env.example .env  # Configura DATABASE_URL y JWT_SECRET
node db/migrate.js     # Crea tablas y datos semilla
npm run dev            # http://localhost:4321
```

**Credenciales por defecto:**
- Admin: `admin@lacascada.cl` / `admin123`
- Garzon: `garzon@lacascada.cl` / `garzon123`

## Despliegue

Ver [DEPLOY.md](./DEPLOY.md) para la guia completa de despliegue en VPS con Dokploy.

## Estructura

```
src/
  components/    Componentes Svelte (MenuApp, TomaPedidoModal, MesasAdmin...)
  layouts/       Layouts Astro (AdminLayout, Layout)
  lib/           Utilidades (db, auth, audit, types, constants)
  pages/         Rutas y APIs (Astro endpoints)
db/
  schema.sql     Esquema completo PostgreSQL
  migrate.js     Migracion automatica
  seed.sql       Datos de prueba
  backup.js      Backup automatico pg_dump
  validate-env.js Validacion de entorno pre-inicio
```

## Comandos

| Comando | Accion |
|---|---|
| `npm run dev` | Servidor desarrollo |
| `npm run build` | Build produccion |
| `node db/migrate.js` | Crear/migrar BD |
| `node db/backup.js` | Backup manual |
| `npm start` | Iniciar en produccion |

