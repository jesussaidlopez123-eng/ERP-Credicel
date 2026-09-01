/** Tope de la escucha en vivo: el historial viejo se pide con “cargar más”. */
export const LIVE_LIMIT = {
  sales: 400,
  expenses: 400,
  cortes: 120,
  movements: 400,
  repairsHistory: 300
} as const;

export const HISTORY_PAGE = 200;
