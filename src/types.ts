export interface Branch {
  id: string;
  name: string;
}

export interface Operator {
  id: string;
  name: string;
  username: string;
  password?: string;
  branchIds: string[];
  role: 'admin' | 'cashier' | 'manager';
  isMainAdmin?: boolean;
  createdAt?: string;
}

export type ModuleId = 'pos' | 'inventory' | 'purchases' | 'sales' | 'executive' | 'settings';

export type NoticeUrgency = 'normal' | 'urgente';

export interface AppNotification {
  id: string;
  urgency: NoticeUrgency;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  authorName: string;
  branchId: string; // 'all' or specific branch id
  targetOperatorId?: string; // 'all' or specific operator id
  targetOperatorName?: string;
  type?: 'aviso' | 'pedido_stock';
  requestDetails?: {
    productName: string;
    requestedQty: number;
    currentStock: number;
    status: 'pendiente' | 'en_camino' | 'cumplido';
  };
}

export interface PurchaseDraftItem {
  id: string;
  code?: string;
  productName: string;
  quantity: number;
  wholesalePrice: number;
  supplier?: string;
  notes?: string;
}

export interface PurchaseDraft {
  id: string;
  title: string;
  supplierName: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseDraftItem[];
  totalAmount: number;
  status: 'borrador' | 'enviado_proveedor' | 'pendiente' | 'entregado' | 'cancelado' | 'recibido';
  notes?: string;
  archivedAt?: string;
  deliveredAt?: string;
}

export interface BranchStockRequest {
  id: string;
  notificationId?: string;
  branchId: string;
  branchName: string;
  operatorName: string;
  productName: string;
  code?: string;
  currentStock: number;
  requestedQty: number;
  urgency: NoticeUrgency;
  notes?: string;
  createdAt: string;
  status: 'pendiente' | 'en_camino' | 'cumplido';
}

export interface ImeiTraceRecord {
  imei: string;
  productId: string;
  productName: string;
  productCode: string;
  branchId: string;
  branchName: string;
  status: 'disponible' | 'vendido' | 'baja';
  addedAt: string;
  soldAt?: string;
  soldTicketId?: string;
  soldBranchId?: string;
  soldOperatorName?: string;
  salePrice?: number;
  clientName?: string;
  supplier?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: 'accesorio' | 'recarga' | 'equipo_credito' | 'servicio' | string;
  price: number; // Precio final
  costPrice?: number; // Precio inicial / costo de compra
  stock: number; // Stock total
  branchStock?: Record<string, number>; // Stock por sucursal e.g. { 'b-bodega': 10, 'b-navojoa': 5, 'b-huatabampo': 2 }
  branchImeiMap?: Record<string, string[]>; // IMEIs activos desglosados por sucursal e.g. { 'b-bodega': ['351234...'], 'b-navojoa': [...] }
  inventoryType?: 'accesorio' | 'equipo';
  color?: string;
  brand?: string;
  model?: string;
  imei?: string;
  imeiList?: string[];
  supplier?: string;
}

export interface CartItemMetadata {
  // For Airtime Recharges
  phoneNumber?: string;
  carrier?: string;
  rechargeAmount?: number;

  // For Equipment / Cell Phone Sales (Contado or Crédito)
  saleType?: 'contado' | 'credito';
  clientName?: string;
  clientPhone?: string;
  deviceModel?: string;
  imei?: string;
  downPayment?: number; // Enganche
  fullPrice?: number;
  remainingBalance?: number;
  financingPlatform?: string; // e.g. PayJoy, Macropay, CrediCel, DMI, etc.

  // For Repair Services
  repairId?: string;
  issueDescription?: string;
  repairType?: 'anticipo' | 'saldo_final' | 'pago_total';
  advancePayment?: number;
  totalRepairCost?: number;

  // For Phone Cases (Fundas)
  caseModel?: string; // e.g. iPhone 13 Pro Max, Samsung A54, Redmi Note 12, etc.
}


export interface RepairRecord {
  id: string; // Folio e.g. REP-1001
  clientName: string;
  clientPhone: string;
  deviceModel: string;
  passcodePattern?: string; // Pattern / PIN
  issueDescription: string;
  totalCost: number;
  advancePayment: number;
  pendingBalance: number;
  status: 'en_taller' | 'listo' | 'entregado';
  receivedAt: string;
  deliveredAt?: string;
  operatorName: string;
  branchId: string;
}

export interface RepairPriceItem {
  id: string;
  brand: string;
  model: string;
  serviceName: string;
  category?: 'Pantalla' | 'Batería' | 'Centro de Carga' | 'Desbloqueo' | 'Otro' | string;
  price: number;
  estimatedTime?: string;
  notes?: string;
}

export interface CartItem {
  cartItemId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  metadata?: CartItemMetadata;
}

export type SaleItem = CartItem;

export interface Expense {
  id: string;
  amount: number;
  concept: string;
  timestamp: string;
  date?: string;
  operatorName: string;
  branchId: string;
  corteXId?: string;
  corteXClosedAt?: string;
}

export interface SaleTicket {
  id: string;
  folio?: string;
  timestamp: string;
  branchId: string;
  operatorName: string;
  items: CartItem[];
  total: number;
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  cashReceived?: number;
  change?: number;
  corteXId?: string;
  corteXClosedAt?: string;
}


export interface CorteXRecord {
  id: string; // CTX-XXXXXX
  timestamp: string;
  dateStr: string;
  timeStr: string;
  branchId: string;
  branchName: string;
  operatorName: string;
  initialCashFund: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  totalSales: number;
  totalExpenses: number;
  netIncome: number;
  expectedCashInDrawer: number;
  ticketIds: string[];
  expenseIds: string[];
  breakdown: {
    accesoriosTotal: number;
    accesoriosCount: number;
    abonosTotal: number;
    abonosCount: number;
    enganchesTotal: number;
    enganchesCount: number;
    reparacionesTotal: number;
    reparacionesCount: number;
    recargasTotal: number;
    recargasCount: number;
  };
}

export interface AppState {
  isAuthenticated: boolean;
  currentBranch: Branch | null;
  currentOperator: Operator | null;
}



