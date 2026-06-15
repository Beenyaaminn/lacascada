#!/bin/bash
# ============================================================
# La Cascada - Setup automatizado para Dokploy
# ============================================================
# Ejecutar en el VPS despues de instalar Dokploy:
#   curl -sSL https://dokploy.com/install.sh | sh
#   bash setup-dokploy.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════╗"
echo "║   La Cascada - Setup VPS + Dokploy       ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# --- Step 1: Generate secrets ---
echo -e "${YELLOW}[1/6] Generando claves seguras...${NC}"

DB_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)

echo "  DB_PASSWORD: $DB_PASSWORD"
echo "  JWT_SECRET:  $JWT_SECRET"

# --- Step 2: Create .env file ---
echo -e "\n${YELLOW}[2/6] Creando archivo .env...${NC}"

cat > .env << EOF
DATABASE_URL=postgresql://lacascada:${DB_PASSWORD}@db:5432/lacascada
JWT_SECRET=${JWT_SECRET}
PORT=4321
HOST=0.0.0.0
POSTGRES_PASSWORD=${DB_PASSWORD}
EOF

echo "  .env creado"

# --- Step 3: Create backups directory ---
echo -e "\n${YELLOW}[3/6] Creando directorio de backups...${NC}"
mkdir -p backups
echo "  backups/ creado"

# --- Step 4: Docker build ---
echo -e "\n${YELLOW}[4/6] Construyendo imagen Docker...${NC}"
docker compose build
echo "  Build completado"

# --- Step 5: Start services ---
echo -e "\n${YELLOW}[5/6] Iniciando servicios...${NC}"
docker compose up -d
echo "  Servicios iniciados"

# Wait for DB to be ready
echo "  Esperando que PostgreSQL este listo..."
for i in $(seq 1 30); do
  if docker exec lacascada-db pg_isready -U lacascada -d lacascada > /dev/null 2>&1; then
    echo "  PostgreSQL listo"
    break
  fi
  sleep 2
done

# --- Step 6: Run migration ---
echo -e "\n${YELLOW}[6/6] Ejecutando migracion de base de datos...${NC}"
docker exec lacascada-app node db/migrate.js
echo "  Migracion completada"

# --- Done ---
IP=$(hostname -I | awk '{print $1}')

echo -e "\n${GREEN}"
echo "╔══════════════════════════════════════════╗"
echo "║   Setup completado!                       ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                           ║"
echo "║   App:  http://${IP}:4321              ║"
echo "║                                           ║"
echo "║   Admin: admin@lacascada.cl               ║"
echo "║   Pass:  admin123                         ║"
echo "║                                           ║"
echo "║   CAMBIA LAS CONTRASEÑAS EN PRODUCCION    ║"
echo "║                                           ║"
echo "║   Health: http://${IP}:4321/api/health     ║"
echo "║   Backup: Automatico diario 3:00 AM       ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}Credenciales generadas (guardalas):${NC}"
echo "  DB Password: $DB_PASSWORD"
echo "  JWT Secret:  $JWT_SECRET"
echo ""
echo "Guarda estas credenciales en un lugar seguro."
