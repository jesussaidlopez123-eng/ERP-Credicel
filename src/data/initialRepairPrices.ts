import { RepairPriceItem } from '../types';

export const INITIAL_REPAIR_PRICES: RepairPriceItem[] = [
  // PANTALLAS
  {
    id: 'rep-price-1',
    brand: 'Apple',
    model: 'iPhone 11',
    serviceName: 'Cambio de Pantalla LCD/OLED',
    category: 'Pantalla',
    price: 850,
    estimatedTime: '45 mins',
    notes: 'Incluye cristal templado de regalo'
  },
  {
    id: 'rep-price-3',
    brand: 'Apple',
    model: 'iPhone 12 / 12 Pro',
    serviceName: 'Cambio de Pantalla OLED High Quality',
    category: 'Pantalla',
    price: 1350,
    estimatedTime: '1 hora',
    notes: 'Programación TrueTone'
  },
  {
    id: 'rep-price-5',
    brand: 'Apple',
    model: 'iPhone 13',
    serviceName: 'Cambio de Pantalla OLED Premium',
    category: 'Pantalla',
    price: 1850,
    estimatedTime: '1 hora'
  },
  {
    id: 'rep-price-7',
    brand: 'Samsung',
    model: 'Galaxy A54 5G',
    serviceName: 'Cambio de Display AMOLED',
    category: 'Pantalla',
    price: 1450,
    estimatedTime: '1 hora'
  },
  {
    id: 'rep-price-9',
    brand: 'Samsung',
    model: 'Galaxy S22 Ultra',
    serviceName: 'Pantalla Completa Curved AMOLED',
    category: 'Pantalla',
    price: 3800,
    estimatedTime: '2 horas',
    notes: 'Pieza original con marco'
  },
  {
    id: 'rep-price-10',
    brand: 'Samsung',
    model: 'Galaxy A14 / A04',
    serviceName: 'Cambio de Pantalla LCD',
    category: 'Pantalla',
    price: 750,
    estimatedTime: '45 mins'
  },
  {
    id: 'rep-price-11',
    brand: 'Motorola',
    model: 'Moto G60 / G60s',
    serviceName: 'Cambio de Pantalla IPS FHD+',
    category: 'Pantalla',
    price: 800,
    estimatedTime: '45 mins'
  },
  {
    id: 'rep-price-13',
    brand: 'Motorola',
    model: 'Moto Edge 30 Neo',
    serviceName: 'Cambio de Pantalla pOLED',
    category: 'Pantalla',
    price: 1650,
    estimatedTime: '1 hora'
  },
  {
    id: 'rep-price-14',
    brand: 'Xiaomi',
    model: 'Redmi Note 11 / 11S',
    serviceName: 'Cambio de Display AMOLED',
    category: 'Pantalla',
    price: 950,
    estimatedTime: '45 mins'
  },

  // BATERÍAS
  {
    id: 'rep-price-2',
    brand: 'Apple',
    model: 'iPhone 11',
    serviceName: 'Cambio de Batería (Salud 100%)',
    category: 'Batería',
    price: 550,
    estimatedTime: '30 mins'
  },
  {
    id: 'rep-price-16',
    brand: 'Xiaomi',
    model: 'Redmi Note 12 / 12 Pro',
    serviceName: 'Cambio de Batería 5000mAh',
    category: 'Batería',
    price: 480,
    estimatedTime: '30 mins'
  },
  {
    id: 'rep-price-19',
    brand: 'Samsung',
    model: 'Galaxy A52 / A53',
    serviceName: 'Cambio de Batería Original',
    category: 'Batería',
    price: 520,
    estimatedTime: '35 mins'
  },

  // CENTROS DE CARGA
  {
    id: 'rep-price-4',
    brand: 'Apple',
    model: 'iPhone 12 / 12 Pro',
    serviceName: 'Centro de Carga Flex Lightning',
    category: 'Centro de Carga',
    price: 650,
    estimatedTime: '45 mins'
  },
  {
    id: 'rep-price-8',
    brand: 'Samsung',
    model: 'Galaxy A54 5G',
    serviceName: 'Centro de Carga Tipo C',
    category: 'Centro de Carga',
    price: 400,
    estimatedTime: '30 mins'
  },
  {
    id: 'rep-price-12',
    brand: 'Motorola',
    model: 'Moto G60 / G60s',
    serviceName: 'Centro de Carga Lógica Flex',
    category: 'Centro de Carga',
    price: 350,
    estimatedTime: '30 mins'
  },

  // DESBLOQUEOS
  {
    id: 'rep-price-18',
    brand: 'Multimarca',
    model: 'Cualquier Modelo Android',
    serviceName: 'Desbloqueo de Cuenta Google / FRP',
    category: 'Desbloqueo',
    price: 450,
    estimatedTime: '1 hora'
  },
  {
    id: 'rep-price-20',
    brand: 'Apple',
    model: 'iPhone (Varios)',
    serviceName: 'Bypass / Desbloqueo de Red Operador',
    category: 'Desbloqueo',
    price: 600,
    estimatedTime: '1-2 horas'
  },

  // OTROS
  {
    id: 'rep-price-6',
    brand: 'Apple',
    model: 'iPhone 13',
    serviceName: 'Tapa Trasera Láser',
    category: 'Otro',
    price: 900,
    estimatedTime: '2 horas'
  },
  {
    id: 'rep-price-15',
    brand: 'Xiaomi',
    model: 'Poco X3 Pro / NFC',
    serviceName: 'Rebaling Lógica / Encendido',
    category: 'Otro',
    price: 850,
    estimatedTime: 'Mismo día'
  },
  {
    id: 'rep-price-17',
    brand: 'Multimarca',
    model: 'Cualquier Modelo',
    serviceName: 'Mantenimiento / Limpieza por humedad',
    category: 'Otro',
    price: 350,
    estimatedTime: '2 horas',
    notes: 'Desarmado ultrasónico e isopropílico'
  }
];
