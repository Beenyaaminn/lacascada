export const CATEGORIAS = {
  COMPLETOS_ASES: 'Completos y Ases',
  SANDWICHES_CASA: 'Sándwiches de la Casa',
  VEGANO: 'Plant-Based (Vegano)',
  PARA_COMPARTIR: 'Para Compartir',
  PROMOCIONES: 'Promociones',
} as const;

export const CATEGORIA_NOMBRES = Object.values(CATEGORIAS);

export const GRUPOS_MENU = [
  { id: 'completos_ases', label: 'Completos y Ases', cats: [CATEGORIAS.COMPLETOS_ASES] },
  { id: 'sandwiches', label: 'Sándwiches de la Casa', cats: [CATEGORIAS.SANDWICHES_CASA] },
  { id: 'vegano', label: 'Plant-Based (Vegano)', cats: [CATEGORIAS.VEGANO] },
  { id: 'compartir', label: 'Para Compartir', cats: [CATEGORIAS.PARA_COMPARTIR] },
  { id: 'promociones', label: 'Promociones', cats: [CATEGORIAS.PROMOCIONES] },
];

export const METODOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'a_credito', label: 'A crédito (fiado)' },
] as const;

export const MAX_CANTIDAD_POR_PRODUCTO = 99;
