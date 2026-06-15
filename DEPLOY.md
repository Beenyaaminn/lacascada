# Guia de Despliegue - La Cascada en Dokploy

## Requisitos previos

- Un VPS con Ubuntu 22.04 o 24.04 (recomendado: Hetzner CX23, ~4 EUR/mes)
- Un dominio (opcional, puede usar la IP del VPS directamente)
- Acceso SSH al VPS (usuario root)

---

## Paso 1: Configurar el VPS

### 1.1 Conectarse por SSH

```bash
ssh root@IP-DE-TU-VPS
```

### 1.2 Actualizar el sistema

```bash
apt update && apt upgrade -y
```

### 1.3 Instalar Dokploy

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Esto tarda 3-5 minutos. Al finalizar te muestra:
- URL del panel: `http://IP-DE-TU-VPS:3000`
- Usuario y contraseña generados

### 1.4 Abrir el panel de Dokploy

Abrí en tu navegador: `http://IP-DE-TU-VPS:3000`

Iniciá sesión con las credenciales que mostró la instalación.

---

## Paso 2: Configurar el dominio (opcional)

### 2.1 En tu proveedor de dominio (Namecheap, Cloudflare, etc.)

Agregá un registro DNS tipo A:
- **Nombre**: `@` (o `admin` si querés subdominio)
- **Valor**: IP de tu VPS
- **TTL**: Automático

Ejemplo: `admin.lacascada.cl` → IP del VPS

### 2.2 Esperar propagación DNS

Puede tomar de 5 minutos a 2 horas.

---

## Paso 3: Desplegar La Cascada en Dokploy

### 3.1 Crear una nueva aplicación

1. En Dokploy, ir a **Applications** → **Create Application**
2. Nombre: `lacascada`
3. Elegir el servidor (el VPS donde instalaste Dokploy)

### 3.2 Configurar la base de datos

1. Ir a **Databases** → **Create Database**
2. Tipo: **PostgreSQL**
3. Nombre: `lacascada-db`
4. Versión: 16
5. Base de datos: `lacascada`
6. Usuario: `lacascada`
7. Password: una contraseña segura (guardala)

Dokploy crea la base de datos automáticamente.

### 3.3 Conectar la app a la BD

En la configuración de la aplicación `lacascada`, en **Environment**:

```
DATABASE_URL=postgresql://lacascada:TU-CONTRASEÑA@lacascada-db:5432/lacascada
JWT_SECRET=genera-un-secreto-largo-y-guardalo
```

Para generar un JWT_SECRET seguro:
```bash
openssl rand -hex 32
```

### 3.4 Configurar el build

En la aplicación:
- **Build Method**: Dockerfile
- **Branch**: main (o master)
- **Source**: GitHub (si tenés el código ahí) o **Upload** directo

Si usás Upload directo: comprimí el proyecto en .zip y subilo.

### 3.5 Agregar dominio (si tenés)

En **Domains** de la aplicación:
- Host: `admin.lacascada.cl` (o tu dominio)
- Puerto del contenedor: `4321`

Dokploy configura SSL automáticamente con Let's Encrypt.

---

## Paso 4: Ejecutar la migración inicial

### 4.1 Acceder al contenedor

```bash
docker exec -it lacascada-app sh
```

### 4.2 Correr la migración

```bash
cd /app
node db/migrate.js
```

Esto crea todas las tablas, índices, triggers y datos semilla.

### 4.3 Verificar

```bash
exit
```

---

## Paso 5: Probar el sistema

Abrí en el navegador: `https://admin.lacascada.cl` (o `http://IP-DEL-VPS:4321`)

**Credenciales por defecto:**
- Admin: `admin@lacascada.cl` / `admin123`
- Garzón: `garzon@lacascada.cl` / `garzon123`

**CAMBIÁ LAS CONTRASEÑAS EN PRODUCCIÓN.**

---

## Paso 6: Configurar backups automáticos

### 6.1 En Dokploy, en la base de datos `lacascada-db`

- Ir a **Backups**
- Frecuencia: **Diaria**
- Hora: 3:00 AM (hora de menor actividad)
- Retención: 7 días
- Destino: Local (o S3 si tenés)

---

## Comandos útiles

### Ver logs de la aplicación
```bash
docker logs -f lacascada-app
```

### Reiniciar la aplicación
```bash
docker restart lacascada-app
```

### Conectarse a la base de datos
```bash
docker exec -it lacascada-db psql -U lacascada -d lacascada
```

### Verificar estado de salud
```bash
curl https://admin.lacascada.cl/api/health
# Respuesta: {"status":"ok","timestamp":"...","db":"connected"}
```

---

## Solución de problemas

### La app no inicia
1. Verificar logs: `docker logs lacascada-app`
2. Verificar que `DATABASE_URL` es correcta
3. Verificar que la BD está corriendo: `docker ps | grep lacascada-db`

### Error de conexión a BD
1. Revisar que el nombre del host en `DATABASE_URL` coincida con el nombre del contenedor de la BD
2. Si usaste Dokploy para crear la BD, el host es el nombre que le pusiste a la BD

### No puedo iniciar sesión
1. Verificar que corrió `node db/migrate.js`
2. Verificar que `JWT_SECRET` está configurado en el entorno

---

## Arquitectura final

```
Internet
   │
   ├── Router Dual WAN (Fibra + 4G backup)
   │
   └── VPS (Hetzner CX23, Ubuntu 24.04)
        │
        ├── Dokploy (panel de control web)
        │     │
        │     ├── lacascada-app (Node.js + Astro SSR)
        │     │     └── Puerto 4321 → mapeado a 443 (HTTPS)
        │     │
        │     └── lacascada-db (PostgreSQL 16)
        │           └── Volumen persistente: pgdata
        │
        └── Backups diarios automáticos
```

---

¿Preguntas? Contactame o revisá la documentación de Dokploy en https://docs.dokploy.com
