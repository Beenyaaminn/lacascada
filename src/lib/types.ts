export type RolUsuario = 'admin' | 'garzon' | 'cliente';
export type EstadoMesa = 'libre' | 'ocupada' | 'esperando_pago';
export type TipoPedido = 'mesa' | 'delivery' | 'retiro';
export type EstadoPedido = 'pendiente' | 'en_preparacion' | 'entregado' | 'pagado' | 'cancelado';
export type MetodoPago = 'efectivo' | 'debito' | 'credito' | 'a_credito';
export type EstadoReserva = 'pendiente' | 'entregada' | 'cancelada';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  password_hash: string;
  rol: RolUsuario;
  created_at: string;
  updated_at: string;
}

export interface Mesa {
  id: number;
  numero_mesa: number;
  piso: number;
  estado: EstadoMesa;
  tomada_por: string | null;
  tomada_desde: string | null;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  orden: number;
  created_at: string;
}

export interface Producto {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  ingredientes: string | null;
  maneja_stock: boolean;
  stock_actual: number;
  disponible_dia: boolean;
  imagen_url: string | null;
  created_at: string;
  updated_at: string;
  categoria_nombre?: string;
}

export interface Acompanamiento {
  id: number;
  nombre: string;
  es_extra: boolean;
  recargo: number;
  created_at: string;
}

export interface ProductoAcompanamiento {
  id: number;
  producto_id: number;
  acompanamiento_id: number;
}

export interface Pedido {
  id: number;
  mesa_id: number | null;
  usuario_id: number | null;
  tipo_pedido: TipoPedido;
  estado: EstadoPedido;
  metodo_pago: MetodoPago | null;
  total: number;
  fecha_hora: string;
  created_at: string;
  updated_at: string;
  mesa_numero?: number;
  mesa_piso?: number;
  detalles?: DetallePedido[];
}

export interface DetallePedido {
  id: number;
  pedido_id: number;
  producto_id: number;
  acompanamiento: string | null;
  cantidad: number;
  subtotal: number;
  created_at: string;
  producto_nombre?: string;
  producto_precio?: number;
}

export interface ClienteCredito {
  id: number;
  nombre: string;
  rut_o_telefono: string;
  limite_credito: number;
  saldo_deudor: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Abono {
  id: number;
  cliente_credito_id: number;
  monto: number;
  fecha_hora: string;
  created_at: string;
}

export interface ReservaPlato {
  id: number;
  nombre_cliente: string;
  producto_id: number;
  cantidad: number;
  fecha: string;
  hora?: string | null;
  estado: EstadoReserva;
  created_at: string;
  updated_at: string;
  producto_nombre?: string;
}

export interface ReporteVentas {
  fecha: string;
  total_ventas: number;
  cantidad_pedidos: number;
  efectivo: number;
  debito: number;
  credito: number;
  a_credito: number;
}

export interface VoucherData {
  pedido_id: number;
  fecha_hora: string;
  mesa_info: string;
  detalles: Array<{
    nombre: string;
    acompanamiento: string | null;
    cantidad: number;
    subtotal: number;
  }>;
  subtotal: number;
  metodo_pago: MetodoPago;
  total: number;
}
