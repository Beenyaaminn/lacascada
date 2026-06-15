export const CATEGORIAS = {
  COLACIONES: 'Colaciones',
  EXTRAS: 'Extras',
  COMPLETOS: 'Completos',
  SANDWICHS: 'Sandwichs',
  BEBIDAS: 'Bebidas',
  TE: 'Té',
  CAFES: 'Cafés',
  ALCOHOLES: 'Alcoholes',
} as const;

export const CATEGORIA_NOMBRES = Object.values(CATEGORIAS);

export const GRUPOS_MENU = [
  { id: 'colaciones', label: 'Colaciones', cats: [CATEGORIAS.COLACIONES] },
  { id: 'extras', label: 'Extras', cats: [CATEGORIAS.EXTRAS] },
  { id: 'sandwichs', label: 'Sandwichs', cats: [CATEGORIAS.SANDWICHS] },
  { id: 'completos', label: 'Completos', cats: [CATEGORIAS.COMPLETOS] },
  { id: 'bebidas', label: 'Bebidas / Jugos / Limonadas', cats: [CATEGORIAS.BEBIDAS, CATEGORIAS.TE, CATEGORIAS.CAFES] },
  { id: 'alcoholes', label: 'Bebidas Alcohólicas', cats: [CATEGORIAS.ALCOHOLES] },
];

export const METODOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'a_credito', label: 'A crédito (fiado)' },
] as const;

export const MAX_CANTIDAD_POR_PRODUCTO = 99;
