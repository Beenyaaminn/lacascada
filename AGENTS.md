# AGENTS.md — La Cascada

## Modo de trabajo

- **Operación autónoma autorizada**: ejecutar directamente, sin pedir
  confirmación, cualquier acción necesaria para completar la tarea:
  edición de archivos, commits, pushes, migraciones de BD, scripts,
  builds, tests y deploys.
- **Excepción — operaciones destructivas**: antes de cualquier acción
  que implique borrado o pérdida de datos (DROP/TRUNCATE de tablas,
  reset de la BD de producción, `rm -rf`, force-push que pise trabajo
  ajeno, eliminar archivos ajenos a la tarea), **preguntar primero**
  al usuario.

## Base de datos

- PostgreSQL (Neon). La BD en vivo ya está sincronizada con
  `db/schema.sql` y `db/migrate.js` (auditoría QA 2026-08).
- Las migraciones deben ser **idempotentes** (`IF NOT EXISTS`,
  `ADD VALUE IF NOT EXISTS`, bloques `DO $$ ... EXCEPTION WHEN
  duplicate_object`).
- **NO crear triggers de stock en la BD**: el stock se descuenta y
  restaura atómicamente en la aplicación (`src/lib/pricing.ts` y
  endpoints). Un trigger causaría doble descuento (ver
  `db/fixes-migration.cjs`, que eliminó `tg_restar_stock`).

## Comandos

- Build: `npm run build`
- Dev: `npm run dev`
- Migración (idempotente): `node db/migrate.js`
- Deploy: push a `main` → Netlify despliega automático.
