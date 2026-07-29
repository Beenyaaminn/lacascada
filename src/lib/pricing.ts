import { sql } from './db';

export const COSTO_ZONAS: Record<string, number> = {
  'Lebu Norte': 2000,
  'Lebu Centro': 1500,
};

export interface ItemPedidoInput {
  producto_id: number;
  cantidad?: number;
  acompanamiento?: string | null;
}

export interface ItemCalculado {
  producto_id: number;
  nombre: string;
  cantidad: number;
  acompanamiento: string | null;
  subtotal: number;
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

export function parseAcompanamientos(acomp: string | null | undefined): string[] {
  if (!acomp || acomp === 'Sin acompañamiento') return [];
  return acomp.split(',').map(n => n.trim()).filter(Boolean);
}

/**
 * Calcula subtotales y total de un pedido 100% server-side.
 * Nunca confiar en precios enviados por el cliente.
 */
export async function calcularPedido(items: ItemPedidoInput[]): Promise<{ items: ItemCalculado[]; total: number }> {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new PricingError('El pedido debe tener al menos un producto');
  }

  // Batch: una sola query para todos los productos
  const ids = [...new Set(items.map(i => Number(i.producto_id)).filter(id => Number.isInteger(id) && id > 0))];
  if (ids.length !== items.length) {
    throw new PricingError('ID de producto inválido en el pedido');
  }

  const productos = await sql`
    SELECT id, nombre, precio, maneja_stock, stock_actual, disponible_dia
    FROM productos WHERE id = ANY(${ids}::int[])
  `;
  const prodMap = new Map(productos.map((p: any) => [p.id, p]));

  // Batch: todos los acompañamientos por nombre
  const nombresAcomp = [...new Set(items.flatMap(i => parseAcompanamientos(i.acompanamiento)))];
  let acompMap = new Map<string, number>();
  if (nombresAcomp.length > 0) {
    const acomps = await sql`
      SELECT nombre, recargo FROM acompanamientos WHERE nombre = ANY(${nombresAcomp}::text[])
    `;
    acompMap = new Map(acomps.map((a: any) => [a.nombre, a.recargo]));
  }

  const calculados: ItemCalculado[] = [];
  let total = 0;

  for (const item of items) {
    const prod = prodMap.get(Number(item.producto_id)) as any;
    if (!prod) {
      throw new PricingError(`Producto #${item.producto_id} no encontrado`);
    }
    if (!prod.disponible_dia) {
      throw new PricingError(`${prod.nombre} no está disponible hoy`);
    }

    const cantidad = Number(item.cantidad) || 1;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
      throw new PricingError(`Cantidad inválida (1-99) para ${prod.nombre}`);
    }

    // Reserva atómica de stock: solo descuenta si hay suficiente
    if (prod.maneja_stock) {
      const reservado = await sql`
        UPDATE productos SET stock_actual = stock_actual - ${cantidad}
        WHERE id = ${prod.id} AND maneja_stock = TRUE AND stock_actual >= ${cantidad}
        RETURNING id
      `;
      if (reservado.length === 0) {
        const actual = await sql`SELECT stock_actual FROM productos WHERE id = ${prod.id}`;
        throw new PricingError(`Stock insuficiente: ${prod.nombre} (disponible: ${actual[0]?.stock_actual ?? 0})`);
      }
    }

    let recargo = 0;
    for (const nombre of parseAcompanamientos(item.acompanamiento)) {
      recargo += acompMap.get(nombre) || 0;
    }

    const subtotal = (prod.precio + recargo) * cantidad;
    calculados.push({
      producto_id: prod.id,
      nombre: prod.nombre,
      cantidad,
      acompanamiento: item.acompanamiento || null,
      subtotal,
    });
    total += subtotal;
  }

  return { items: calculados, total };
}

/**
 * Devuelve el stock reservado de una lista de items (usado cuando un pedido falla a mitad de camino).
 */
export async function devolverStock(items: ItemCalculado[]): Promise<void> {
  for (const item of items) {
    try {
      await sql`
        UPDATE productos SET stock_actual = stock_actual + ${item.cantidad}
        WHERE id = ${item.producto_id} AND maneja_stock = TRUE
      `;
    } catch { /* best effort */ }
  }
}

export function getCostoEnvio(zona: string | null | undefined): number {
  if (!zona) return 0;
  return COSTO_ZONAS[zona] ?? 0;
}
