import { RepairPriceItem } from '../types';
import { repairPricesFromRows } from '../lib/repairPriceCatalog';
import { parseDelimitedText } from '../lib/xlsxRead';
import { PANTALLAS_VENTA_TSV } from './pantallasVentaText';

export const SCREEN_SALE_PRICES: RepairPriceItem[] = repairPricesFromRows(
  parseDelimitedText(PANTALLAS_VENTA_TSV)
);

const OTHER_SERVICES: RepairPriceItem[] = [
  {
    id: 'rep-price-bateria-iphone-11',
    brand: 'Apple',
    model: 'iPhone 11',
    serviceName: 'Cambio de Batería (Salud 100%)',
    category: 'Batería',
    price: 550,
    estimatedTime: '30 mins'
  },
  {
    id: 'rep-price-bateria-note-12',
    brand: 'Xiaomi',
    model: 'Redmi Note 12 / 12 Pro',
    serviceName: 'Cambio de Batería 5000mAh',
    category: 'Batería',
    price: 480,
    estimatedTime: '30 mins'
  },
  {
    id: 'rep-price-bateria-a52',
    brand: 'Samsung',
    model: 'Galaxy A52 / A53',
    serviceName: 'Cambio de Batería Original',
    category: 'Batería',
    price: 520,
    estimatedTime: '35 mins'
  },
  {
    id: 'rep-price-carga-iphone-12',
    brand: 'Apple',
    model: 'iPhone 12 / 12 Pro',
    serviceName: 'Centro de Carga Flex Lightning',
    category: 'Centro de Carga',
    price: 650,
    estimatedTime: '45 mins'
  },
  {
    id: 'rep-price-carga-a54',
    brand: 'Samsung',
    model: 'Galaxy A54 5G',
    serviceName: 'Centro de Carga Tipo C',
    category: 'Centro de Carga',
    price: 400,
    estimatedTime: '30 mins'
  },
  {
    id: 'rep-price-carga-g60',
    brand: 'Motorola',
    model: 'Moto G60 / G60s',
    serviceName: 'Centro de Carga Lógica Flex',
    category: 'Centro de Carga',
    price: 350,
    estimatedTime: '30 mins'
  },
  {
    id: 'rep-price-frp',
    brand: 'Multimarca',
    model: 'Cualquier Modelo Android',
    serviceName: 'Desbloqueo de Cuenta Google / FRP',
    category: 'Desbloqueo',
    price: 450,
    estimatedTime: '1 hora'
  },
  {
    id: 'rep-price-bypass-iphone',
    brand: 'Apple',
    model: 'iPhone (Varios)',
    serviceName: 'Bypass / Desbloqueo de Red Operador',
    category: 'Desbloqueo',
    price: 600,
    estimatedTime: '1-2 horas'
  },
  {
    id: 'rep-price-humedad',
    brand: 'Multimarca',
    model: 'Cualquier Modelo',
    serviceName: 'Mantenimiento / Limpieza por humedad',
    category: 'Otro',
    price: 350,
    estimatedTime: '2 horas',
    notes: 'Desarmado ultrasónico e isopropílico'
  }
];

export const INITIAL_REPAIR_PRICES: RepairPriceItem[] = [...SCREEN_SALE_PRICES, ...OTHER_SERVICES];
