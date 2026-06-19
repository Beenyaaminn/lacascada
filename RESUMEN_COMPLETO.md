# La Cascada - Resumen Completo del Proyecto
**Fecha: 15 Junio 2026**

---

## 🏗️ Hosting y Ubicación

| Componente | Dónde está | URL |
|---|---|---|
| **Frontend + API** | Netlify (US) | https://lacascadaa.netlify.app |
| **Base de datos** | Neon (us-east-1) | `ep-autumn-mouse-atoi35nz` |
| **Código fuente** | GitHub (privado) | https://github.com/Beenyaaminn/lacascada |
| **Dominio** | Netlify subdomain | lacascadaa.netlify.app |
| **VPS anterior** | Vultr Chile ($10/mes) | ❌ PENDIENTE CANCELAR |

---

## 🔧 Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Astro (SSR) | 5.18.2 |
| Frontend | Svelte | 5.56.3 |
| CSS | Tailwind CSS | 3.4.19 |
| Base de datos | PostgreSQL (Neon) | serverless |
| Driver DB | @neondatabase/serverless | 1.1.0 |
| Auth | JWT (jsonwebtoken) + bcryptjs | - |
| Runtime | Node.js 22 | - |
| Deploy | Netlify (funciones serverless) | - |
| Adapter | @astrojs/netlify | 6.6.5 |

---

## 📁 Estructura del Proyecto

```
src/
├── components/       13 archivos Svelte 5
│   ├── MenuApp.svelte        Menú QR clientes
│   ├── Cart.svelte           Carrito de compras
│   ├── ProductCard.svelte    Tarjeta de producto
│   ├── TomaPedidoModal.svelte Modal de pedidos (admin)
│   ├── MesasAdmin.svelte     Gestión de mesas
│   ├── CajaAdmin.svelte      Control de caja
│   ├── PedidosAdmin.svelte   Historial de pedidos
│   ├── ProductosAdmin.svelte Gestión de productos
│   ├── StockControl.svelte   Control de stock
│   ├── ClientesAdmin.svelte  Créditos clientes
│   ├── ReportesAdmin.svelte  Reportes
│   ├── ReservasAdmin.svelte  Reservas
│   └── TurnoAdmin.svelte     Control de turnos
├── layouts/          2 layouts
│   ├── Layout.astro          Layout público
│   └── AdminLayout.astro     Layout admin (sidebar)
├── lib/              5 módulos
│   ├── db.ts                 Conexión a BD (Neon)
│   ├── auth.ts               JWT + cookies
│   ├── audit.ts              Auditoría
│   ├── types.ts              Tipos TypeScript
│   └── constants.ts          Constantes
├── pages/            30+ páginas y APIs
│   ├── index.astro           Landing page
│   ├── login.astro           Login
│   ├── menu/index.astro      Menú QR (SSR)
│   ├── admin/                Panel admin (11 páginas)
│   └── api/                  20+ endpoints API
└── styles/
db/
├── migrate.js                Migración BD
├── schema.sql                Esquema completo
├── seed.sql                  Datos semilla
└── backup.js                 Backup manual
```

---

## 🗄️ Base de Datos (Neon PostgreSQL)

### Tamaño actual
- **17 tablas** con datos semilla (~50-100 registros totales)
- Tamaño estimado: < 1 MB
- Tier gratuito Neon: 0.5 GB storage, 1 proyecto, 10 branches

### Tablas
`usuarios`, `mesas`, `categorias`, `productos`, `acompanamientos`, `productos_acompanamientos`, `pedidos`, `detalle_pedidos`, `clientes_credito`, `abonos`, `reservas_platos`, `turnos`, `cajas`, `auditoria`, `login_attempts`, `mesa_bloqueos`, `proveedores`

### Conexión (DATABASE_URL)
```
postgresql://neondb_owner:npg_pzPeV0IfnL9G@ep-autumn-mouse-atoi35nz.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

## 🌐 Latencia

| Conexión | Latencia estimada |
|---|---|
| Usuario (Chile) → Netlify (US) | ~120-180ms |
| Netlify → Neon (us-east-1) | ~30-50ms |
| Total ida y vuelta | ~150-230ms |

**Nota:** Con el VPS anterior en Chile, la latencia era ~5-10ms. La diferencia (~150ms) es imperceptible para un menú QR/panel admin.

---

## ⚠️ Puntos débiles / Dónde podemos quedar cortos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Neon tier gratuito: 0.5 GB storage | Si acumulás años de pedidos, podrías exceder | Migrar a Neon paid ($19/mes por 10 GB) |
| Neon tier gratuito: límite de conexiones | ~100 conexiones simultáneas | Pasar a plan Pro |
| Netlify cold starts | 200-500ms primer request tras inactividad | No crítico para este uso |
| Netlify bandwidth (100 GB/mes) | Suficiente para miles de clientes QR | - |
| Sin VPS = sin backups propios | Neon hace snapshots pero no backups diarios configurables | Export manual periódico con `node db/backup.js` |
| sql.begin sin transacciones reales | Si un pago falla a medio camino, puede quedar estado parcial | Implementar transacciones reales con Neon |
| JWT_SECRET en texto plano en este doc | Riesgo de seguridad | Cambiar JWT_SECRET periódicamente |

---

## 🔑 Credenciales (CAMBIAR PERIÓDICAMENTE)

| Servicio | Usuario/URL | Clave |
|---|---|---|
| App Admin | admin@lacascada.cl | admin123 |
| App Garzón | garzon@lacascada.cl | garzon123 |
| Neon DB | DATABASE_URL en vars de Netlify | `npg_pzPeV0IfnL9G` |
| JWT_SECRET | (en vars de Netlify) | `6XFY8Gypb7lfw1T9r5Jxgm3dt2jh4OVAkNSUBzasnEZouMvQeRCDP0KWcLHIqi` |
| GitHub Repo | Beenyaaminn/lacascada (privado) | - |
| Netlify Panel | https://app.netlify.com | Login con GitHub |

---

## 💰 Costos Mensuales

| Servicio | Costo |
|---|---|
| Netlify | $0 (tier gratuito) |
| Neon | $0 (tier gratuito) |
| GitHub | $0 |
| Vultr VPS | ❌ $10/mes — **PENDIENTE CANCELAR** |
| **TOTAL** | **$0/mes** |

---

## 📋 Deploy Automático

Cada `git push` a la rama `main` dispara automáticamente un build en Netlify:
1. Netlify clona el repo
2. Ejecuta `npm run build` (astro build)
3. Publica la carpeta `dist/`
4. Las funciones serverless se despliegan automáticamente

---

## 🛠️ Comandos Útiles

```bash
# Desarrollo local
npm install
node db/migrate.js    # Migrar BD (configurar DATABASE_URL antes)
npm run dev            # http://localhost:4321

# Build producción
npm run build

# Deploy manual a Netlify
npx netlify deploy --prod --dir=dist

# Backup manual de BD
node db/backup.js
```

---

## 🚀 Próximos Pasos Recomendados

1. ❌ **Cancelar VPS de Vultr** ($10/mes) - ya no se usa
2. 🔐 **Revocar tokens de GitHub** en https://github.com/settings/tokens
3. 🔑 **Cambiar contraseñas** (admin123, garzon123) desde el panel admin
4. 🔑 **Cambiar JWT_SECRET** en Netlify env vars
5. 🌐 **Configurar dominio propio** (lacascada.cl) en Netlify
6. 📊 **Monitorear uso de Neon** para no exceder tier gratuito
7. 💾 **Configurar backup periódico** exportando de Neon
