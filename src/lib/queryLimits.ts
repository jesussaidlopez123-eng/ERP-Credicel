/** Tope de la escucha en vivo: el historial viejo se pide con “cargar más”. */
export const LIVE_LIMIT = {
  sales: 180,
  expenses: 180,
  cortes: 120,
  movements: 120,
  repairsHistory: 120
} as const;

export const HISTORY_PAGE = 200;
