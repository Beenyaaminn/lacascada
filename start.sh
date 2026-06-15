#!/bin/sh
set -e

echo "═══════════════════════════════════════"
echo "  La Cascada - Iniciando..."
echo "═══════════════════════════════════════"

if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL no configurada"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "ERROR: JWT_SECRET no configurada"
    exit 1
fi

echo "Verificando base de datos..."

node db/validate-env.js

if [ $? -ne 0 ]; then
    echo "ERROR: La validacion fallo. Ejecuta: node db/migrate.js"
    exit 1
fi

echo "Iniciando servidor en puerto ${PORT:-4321}..."
exec node dist/server/entry.mjs
