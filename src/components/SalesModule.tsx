import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Smartphone, 
  CreditCard, 
  Zap, 
  Receipt, 
  Store, 
  Calendar, 
  Search, 
  X, 
  Check, 
  Copy, 
  ArrowUpRight, 
  DollarSign, 
  Filter, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Eye, 
  Clock, 
  User, 
  Tag, 
  Plus, 
  TrendingUp, 
  Wallet,
  FileText
} from 'lucide-react';
import { SaleTicket, Branch, CartItem, Expense } from '../types';

interface SalesModuleProps {
  salesTickets?: SaleTicket[];
  expenses?: Expense[];
  currentBranch: Branch;
  onOpenNoticeModal?: () => void;
}

// Demo Sales Tickets for initial state / fallback
const DEMO_SALES_TICKETS: SaleTicket[] = [
  {
    id: 'TK-1008',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    branchId: 'b-bodega',
    operatorName: 'Admin Principal',
    paymentMethod: 'Efectivo',
    total: 3500,
    items: [
      {
        cartItemId: 'c-1',
        product: { id: 'p-eq1', code: 'EQ-MAC-01', name: 'Samsung Galaxy A14 64GB', category: 'equipo_credito', price: 3500, stock: 4 },
        quantity: 1,
        unitPrice: 3500,
        totalPrice: 3500,
        metadata: { clientName: 'Roberto Gómez', deviceModel: 'Samsung Galaxy A14', financingPlatform: 'Macropay', downPayment: 800, imei: '358920194820192' }
      }
    ]
  },
  {
    id: 'TK-1007',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    branchId: 'b-navojoa',
    operatorName: 'Juan Pérez',
    paymentMethod: 'Efectivo',
    total: 200,
    items: [
      {
        cartItemId: 'c-2',
        product: { id: 'p-rec1', code: 'REC-TEL', name: 'Recarga Telcel $200', category: 'recarga', price: 200, stock: 999 },
        quantity: 1,
        unitPrice: 200,
        totalPrice: 200,
        metadata: { phoneNumber: '6421059922', carrier: 'Telcel', rechargeAmount: 200 }
      }
    ]
  },
  {
    id: 'TK-1006',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    branchId: 'b-huatabampo',
    operatorName: 'María García',
    paymentMethod: 'Efectivo',
    total: 450,
    items: [
      {
        cartItemId: 'c-3',
        product: { id: 'p-acc1', code: 'ACC-001', name: 'Mica Cristal Templado 9D iPhone 13', category: 'accesorio', price: 150, stock: 20 },
        quantity: 1,
        unitPrice: 150,
        totalPrice: 150
      },
      {
        cartItemId: 'c-4',
        product: { id: 'p-acc2', code: 'ACC-002', name: 'Cargador Carga Rápida 20W Tipo-C', category: 'accesorio', price: 300, stock: 15 },
        quantity: 1,
        unitPrice: 300,
        totalPrice: 300
      }
    ]
  },
  {
    id: 'TK-1005',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    branchId: 'b-bodega',
    operatorName: 'Carlos López',
    paymentMethod: 'Transferencia',
    total: 600,
    items: [
      {
        cartItemId: 'c-5',
        product: { id: 'p-ab1', code: 'ABO-REP', name: 'Abono / Liquidación Reparación #REP-1002', category: 'servicio', price: 600, stock: 1 },
        quantity: 1,
        unitPrice: 600,
        totalPrice: 600,
        metadata: { repairId: 'REP-1002', issueDescription: 'Cambio de Pantalla OLED Moto G60', advancePayment: 400, financingPlatform: 'Taller Reparación' }
      }
    ]
  },
  {
    id: 'TK-1004',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // Yesterday
    branchId: 'b-navojoa',
    operatorName: 'Juan Pérez',
    paymentMethod: 'Tarjeta',
    total: 100,
    items: [
      {
        cartItemId: 'c-6',
        product: { id: 'p-rec2', code: 'REC-ATT', name: 'Recarga AT&T $100', category: 'recarga', price: 100, stock: 999 },
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
        metadata: { phoneNumber: '6624881100', carrier: 'AT&T', rechargeAmount: 100 }
      }
    ]
  },
  {
    id: 'TK-1003',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(), // Yesterday
    branchId: 'b-bodega',
    operatorName: 'Admin Principal',
    paymentMethod: 'Efectivo',
    total: 850,
    items: [
      {
        cartItemId: 'c-7',
        product: { id: 'p-acc3', code: 'ACC-003', name: 'Audífonos Bluetooth Inalámbricos Pro', category: 'accesorio', price: 450, stock: 10 },
        quantity: 1,
        unitPrice: 450,
        totalPrice: 450
      },
      {
        cartItemId: 'c-8',
        product: { id: 'p-acc4', code: 'ACC-004', name: 'Funda de Uso Rudo Magnética', category: 'accesorio', price: 200, stock: 12 },
        quantity: 2,
        unitPrice: 200,
        totalPrice: 400
      }
    ]
  },
  {
    id: 'TK-1002',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    branchId: 'b-huatabampo',
    operatorName: 'María García',
    paymentMethod: 'Efectivo',
    total: 2800,
    items: [
      {
        cartItemId: 'c-9',
        product: { id: 'p-eq2', code: 'EQ-PJ-02', name: 'Xiaomi Redmi Note 12 128GB', category: 'equipo', price: 2800, stock: 2 },
        quantity: 1,
        unitPrice: 2800,
        totalPrice: 2800,
        metadata: { clientName: 'Ana Lucía Mendívil', deviceModel: 'Xiaomi Redmi Note 12', financingPlatform: 'PayJoy', downPayment: 600, imei: '864201948201112' }
      }
    ]
  },
  {
    id: 'TK-1001',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(), // 2 days ago
    branchId: 'b-navojoa',
    operatorName: 'Juan Pérez',
    paymentMethod: 'Efectivo',
    total: 500,
    items: [
      {
        cartItemId: 'c-10',
        product: { id: 'p-ab2', code: 'ABO-CRE', name: 'Abono Crédito Equipo - Cliente Juan R.', category: 'servicio', price: 500, stock: 1 },
        quantity: 1,
        unitPrice: 500,
        totalPrice: 500,
        metadata: { clientName: 'Juan Rodríguez', deviceModel: 'Motorola G22', financingPlatform: 'Credicell' }
      }
    ]
  }
];

// Demo Expenses
const DEMO_EXPENSES: Expense[] = [
  {
    id: 'EXP-101',
    amount: 150,
    concept: 'Compra de agua purificada y vasos',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    operatorName: 'Juan Pérez',
    branchId: 'b-navojoa'
  },
  {
    id: 'EXP-102',
    amount: 320,
    concept: 'Pago de flete recepción paquete mercancía',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    operatorName: 'Admin Principal',
    branchId: 'b-bodega'
  },
  {
    id: 'EXP-103',
    amount: 200,
    concept: 'Insumos de limpieza para sucursal',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    operatorName: 'María García',
    branchId: 'b-huatabampo'
  }
];

export default function SalesModule({
  salesTickets = [],
  expenses = [],
  currentBranch
}: SalesModuleProps) {

  // Active Category Tab state
  const [activeTab, setActiveTab] = useState<'accesorio' | 'equipo' | 'abono' | 'recarga' | 'gastos' | 'corte_x'>('corte_x');

  // Branch filter state
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all'); // 'all' or specific branchId
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Collapsible Accordion state for Corte X categories
  const [expandedCorteXCategories, setExpandedCorteXCategories] = useState<Record<string, boolean>>({
    accesorio: false,
    equipo: false,
    abono: false,
    recarga: false,
    gastos: false
  });

  // Emergent Detail Modal state
  const [emergentModalData, setEmergentModalData] = useState<{
    title: string;
    dateLabel: string;
    branchLabel: string;
    tickets: SaleTicket[];
    expenseItem?: Expense;
    corteXExpenses?: Expense[];
    corteXTotals?: {
      accesorios: number;
      equipos: number;
      abonos: number;
      recargas: number;
      totalBruto: number;
      efectivoTotal: number;
      tarjetaTotal: number;
      transferenciaTotal: number;
      totalGastos: number;
      netoCaja: number;
      efectivoNetoCaja: number;
      operatorNames: string;
      groupedArticles: Array<{
        name: string;
        categoryLabel: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
      categorizedOps: {
        accesorio: Array<{ ticketId: string; time: string; operatorName: string; paymentMethod: string; name: string; quantity: number; unitPrice: number; totalPrice: number; metadata?: any }>;
        equipo: Array<{ ticketId: string; time: string; operatorName: string; paymentMethod: string; name: string; quantity: number; unitPrice: number; totalPrice: number; metadata?: any }>;
        abono: Array<{ ticketId: string; time: string; operatorName: string; paymentMethod: string; name: string; quantity: number; unitPrice: number; totalPrice: number; metadata?: any }>;
        recarga: Array<{ ticketId: string; time: string; operatorName: string; paymentMethod: string; name: string; quantity: number; unitPrice: number; totalPrice: number; metadata?: any }>;
        gastos: Array<{ id: string; time: string; operatorName: string; concept: string; amount: number }>;
      };
    };
    categoryType: 'accesorio' | 'equipo' | 'abono' | 'recarga' | 'gastos' | 'corte_x';
  } | null>(null);

  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);

  // Consolidated Sales & Expenses List
  const combinedTickets = useMemo(() => {
    if (salesTickets && salesTickets.length > 0) {
      return [...salesTickets, ...DEMO_SALES_TICKETS];
    }
    return DEMO_SALES_TICKETS;
  }, [salesTickets]);

  const combinedExpenses = useMemo(() => {
    if (expenses && expenses.length > 0) {
      return [...expenses, ...DEMO_EXPENSES];
    }
    return DEMO_EXPENSES;
  }, [expenses]);

  // Branch Name Helper
  const getBranchName = (bId: string) => {
    if (bId === 'b-bodega') return 'Bodega Central';
    if (bId === 'b-navojoa') return 'Sucursal Navojoa';
    if (bId === 'b-huatabampo') return 'Sucursal Huatabampo';
    return 'General';
  };

  // Helper function to check category of a ticket item
  const getItemCategoryType = (item: CartItem): 'accesorio' | 'equipo' | 'abono' | 'recarga' => {
    const cat = (item.product.category || '').toLowerCase();
    const name = (item.product.name || '').toLowerCase();

    if (cat.includes('recarga') || name.includes('recarga') || item.metadata?.phoneNumber) {
      return 'recarga';
    }
    if (
      cat.includes('equipo') || 
      cat.includes('celular') || 
      item.metadata?.financingPlatform || 
      item.metadata?.imei ||
      name.includes('samsung') || name.includes('xiaomi') || name.includes('iphone') || name.includes('motorola')
    ) {
      return 'equipo';
    }
    if (
      cat.includes('servicio') || 
      cat.includes('abono') || 
      name.includes('abono') || 
      name.includes('reparación') || 
      item.metadata?.repairId
    ) {
      return 'abono';
    }
    return 'accesorio';
  };

  // 1. ACCESORIOS DATA: Grouped into Rows by (Date + Branch)
  const accessoryRows = useMemo(() => {
    const map: Record<string, {
      dateIsoKey: string;
      dateFormatted: string;
      branchId: string;
      branchName: string;
      totalAmount: number;
      itemsCount: number;
      tickets: SaleTicket[];
    }> = {};

    combinedTickets.forEach((ticket) => {
      if (selectedBranchId !== 'all' && ticket.branchId !== selectedBranchId) return;

      // Filter ticket items belonging to 'accesorio'
      const accItems = ticket.items.filter((item) => getItemCategoryType(item) === 'accesorio');
      if (accItems.length === 0) return;

      const dateObj = new Date(ticket.timestamp);
      const dateIsoKey = dateObj.toISOString().split('T')[0];
      const dateFormatted = dateObj.toLocaleDateString('es-MX', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      const key = `${dateIsoKey}_${ticket.branchId}`;

      const sumAmount = accItems.reduce((s, i) => s + i.totalPrice, 0);
      const sumQty = accItems.reduce((s, i) => s + i.quantity, 0);

      if (!map[key]) {
        map[key] = {
          dateIsoKey,
          dateFormatted,
          branchId: ticket.branchId,
          branchName: getBranchName(ticket.branchId),
          totalAmount: 0,
          itemsCount: 0,
          tickets: []
        };
      }

      map[key].totalAmount += sumAmount;
      map[key].itemsCount += sumQty;
      map[key].tickets.push(ticket);
    });

    let result = Object.values(map);

    // Search filter if typed
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.dateFormatted.toLowerCase().includes(q) ||
          r.branchName.toLowerCase().includes(q)
      );
    }

    // Sort by latest date first
    return result.sort((a, b) => b.dateIsoKey.localeCompare(a.dateIsoKey));
  }, [combinedTickets, selectedBranchId, searchQuery]);

  // 2. EQUIPOS DATA: Individual Device Sale Records
  const equipoRecords = useMemo(() => {
    const list: Array<{
      ticket: SaleTicket;
      item: CartItem;
      dateFormatted: string;
      branchName: string;
      code: string;
      deviceModel: string;
      imei: string;
      clientPhone: string;
      clientName: string;
      platform: string;
      fullPrice: number;
      downPayment: number;
      remainingBalance: number;
      price: number;
      operatorName: string;
    }> = [];

    combinedTickets.forEach((ticket) => {
      if (selectedBranchId !== 'all' && ticket.branchId !== selectedBranchId) return;

      ticket.items.forEach((item) => {
        if (getItemCategoryType(item) === 'equipo') {
          const dateObj = new Date(ticket.timestamp);
          const dateFormatted = dateObj.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const downPaymentVal = item.metadata?.downPayment || item.totalPrice;
          const fullPriceVal = item.metadata?.fullPrice || (item.product.price > downPaymentVal ? item.product.price : downPaymentVal + (item.metadata?.remainingBalance || 0));
          const remainingBalanceVal = item.metadata?.remainingBalance ?? Math.max(0, fullPriceVal - downPaymentVal);

          list.push({
            ticket,
            item,
            dateFormatted,
            branchName: getBranchName(ticket.branchId),
            code: item.product.code || ('EQ-' + item.product.id),
            deviceModel: item.metadata?.deviceModel || item.product.name,
            imei: item.metadata?.imei || '35901290481204',
            clientPhone: item.metadata?.clientPhone || item.metadata?.phone || ticket.customerPhone || 'S/N',
            clientName: item.metadata?.clientName || ticket.customerName || 'Cliente Mostrador',
            platform: item.metadata?.financingPlatform || 'Contado / Directo',
            fullPrice: fullPriceVal,
            downPayment: downPaymentVal,
            remainingBalance: remainingBalanceVal,
            price: item.totalPrice,
            operatorName: ticket.operatorName
          });
        }
      });
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          r.deviceModel.toLowerCase().includes(q) ||
          r.imei.toLowerCase().includes(q) ||
          r.clientPhone.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          r.platform.toLowerCase().includes(q) ||
          r.branchName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [combinedTickets, selectedBranchId, searchQuery]);

  // 3. ABONOS DATA: Date, Branch, Amount, Platform
  const abonoRecords = useMemo(() => {
    const list: Array<{
      ticket: SaleTicket;
      item: CartItem;
      dateFormatted: string;
      branchName: string;
      amount: number;
      platform: string;
      operatorName: string;
      clientName: string;
    }> = [];

    combinedTickets.forEach((ticket) => {
      if (selectedBranchId !== 'all' && ticket.branchId !== selectedBranchId) return;

      ticket.items.forEach((item) => {
        if (getItemCategoryType(item) === 'abono') {
          const dateObj = new Date(ticket.timestamp);
          const dateFormatted = dateObj.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          list.push({
            ticket,
            item,
            dateFormatted,
            branchName: getBranchName(ticket.branchId),
            amount: item.totalPrice,
            platform: item.metadata?.financingPlatform || 'Abono a Crédito / Taller',
            operatorName: ticket.operatorName,
            clientName: item.metadata?.clientName || 'Cliente Mostrador'
          });
        }
      });
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter(
        (r) =>
          r.platform.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          r.branchName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [combinedTickets, selectedBranchId, searchQuery]);

  // 4. RECARGAS DATA: Date, Branch, Phone/Carrier, Amount
  const recargaRecords = useMemo(() => {
    const list: Array<{
      ticket: SaleTicket;
      item: CartItem;
      dateFormatted: string;
      branchName: string;
      amount: number;
      phoneNumber: string;
      carrier: string;
      operatorName: string;
    }> = [];

    combinedTickets.forEach((ticket) => {
      if (selectedBranchId !== 'all' && ticket.branchId !== selectedBranchId) return;

      ticket.items.forEach((item) => {
        if (getItemCategoryType(item) === 'recarga') {
          const dateObj = new Date(ticket.timestamp);
          const dateFormatted = dateObj.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          list.push({
            ticket,
            item,
            dateFormatted,
            branchName: getBranchName(ticket.branchId),
            amount: item.totalPrice,
            phoneNumber: item.metadata?.phoneNumber || '6421059922',
            carrier: item.metadata?.carrier || 'Telcel',
            operatorName: ticket.operatorName
          });
        }
      });
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter(
        (r) =>
          r.phoneNumber.toLowerCase().includes(q) ||
          r.carrier.toLowerCase().includes(q) ||
          r.branchName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [combinedTickets, selectedBranchId, searchQuery]);

  // 5. GASTOS DATA: Date, Branch, Concept, Category, Amount, Registered By
  const gastoRecords = useMemo(() => {
    return combinedExpenses.filter((e) => {
      if (selectedBranchId !== 'all' && e.branchId !== selectedBranchId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.concept.toLowerCase().includes(q) ||
          e.operatorName.toLowerCase().includes(q) ||
          getBranchName(e.branchId).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [combinedExpenses, selectedBranchId, searchQuery]);

  // 6. CORTES X DATA: Grouped by (Date + Branch) summarizing all concepts, articles list, and payment method breakdown
  const corteXRows = useMemo(() => {
    const map: Record<string, {
      dateIsoKey: string;
      dateFormatted: string;
      branchId: string;
      branchName: string;
      accesoriosTotal: number;
      equiposTotal: number;
      abonosTotal: number;
      recargasTotal: number;
      totalBruto: number;
      efectivoTotal: number;
      tarjetaTotal: number;
      transferenciaTotal: number;
      gastosTotal: number;
      netoCaja: number;
      efectivoNetoCaja: number;
      operatorNamesSet: Set<string>;
      tickets: SaleTicket[];
      expenses: Expense[];
      articlesMap: Record<string, {
        name: string;
        categoryLabel: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
      categorizedOps: {
        accesorio: Array<{ ticketId: string; time: string; operatorName: string; paymentMethod: string; name: string; quantity: number; unitPrice: number; totalPrice: number; metadata?: any }>;
        equipo: Array<{ ticketId: string; time: string; operatorName: string; paymentMethod: string; name: string; quantity: number; unitPrice: number; totalPrice: number; metadata?: any }>;
        abono: Array<{ ticketId: string; time: string; operatorName: string; paymentMethod: string; name: string; quantity: number; unitPrice: number; totalPrice: number; metadata?: any }>;
        recarga: Array<{ ticketId: string; time: string; operatorName: string; paymentMethod: string; name: string; quantity: number; unitPrice: number; totalPrice: number; metadata?: any }>;
        gastos: Array<{ id: string; time: string; operatorName: string; concept: string; amount: number }>;
      };
    }> = {};

    // Aggregate Sales Tickets by Date + Branch
    combinedTickets.forEach((ticket) => {
      if (selectedBranchId !== 'all' && ticket.branchId !== selectedBranchId) return;

      const dateObj = new Date(ticket.timestamp);
      const dateIsoKey = dateObj.toISOString().split('T')[0];
      const dateFormatted = dateObj.toLocaleDateString('es-MX', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const ticketTime = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

      const key = `${dateIsoKey}_${ticket.branchId}`;

      if (!map[key]) {
        map[key] = {
          dateIsoKey,
          dateFormatted,
          branchId: ticket.branchId,
          branchName: getBranchName(ticket.branchId),
          accesoriosTotal: 0,
          equiposTotal: 0,
          abonosTotal: 0,
          recargasTotal: 0,
          totalBruto: 0,
          efectivoTotal: 0,
          tarjetaTotal: 0,
          transferenciaTotal: 0,
          gastosTotal: 0,
          netoCaja: 0,
          efectivoNetoCaja: 0,
          operatorNamesSet: new Set<string>(),
          tickets: [],
          expenses: [],
          articlesMap: {},
          categorizedOps: {
            accesorio: [],
            equipo: [],
            abono: [],
            recarga: [],
            gastos: []
          }
        };
      }

      if (ticket.operatorName) map[key].operatorNamesSet.add(ticket.operatorName);
      map[key].tickets.push(ticket);

      const payMethod = (ticket.paymentMethod || '').toLowerCase();
      let ticketTotalSum = 0;

      ticket.items.forEach((item) => {
        const catType = getItemCategoryType(item);
        const opDetail = {
          ticketId: ticket.id,
          time: ticketTime,
          operatorName: ticket.operatorName || 'Operador',
          paymentMethod: ticket.paymentMethod || 'Efectivo',
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          metadata: item.metadata
        };

        if (catType === 'accesorio') {
          map[key].accesoriosTotal += item.totalPrice;
          map[key].categorizedOps.accesorio.push(opDetail);
        } else if (catType === 'equipo') {
          map[key].equiposTotal += item.totalPrice;
          map[key].categorizedOps.equipo.push(opDetail);
        } else if (catType === 'abono') {
          map[key].abonosTotal += item.totalPrice;
          map[key].categorizedOps.abono.push(opDetail);
        } else if (catType === 'recarga') {
          map[key].recargasTotal += item.totalPrice;
          map[key].categorizedOps.recarga.push(opDetail);
        }
        
        map[key].totalBruto += item.totalPrice;
        ticketTotalSum += item.totalPrice;

        // Group Articles for List Breakdown
        const articleKey = `${item.product.name}_${item.unitPrice}`;
        if (!map[key].articlesMap[articleKey]) {
          let categoryLabel = 'Accesorio';
          if (catType === 'equipo') categoryLabel = 'Equipo Cell';
          else if (catType === 'abono') categoryLabel = 'Abono Cred';
          else if (catType === 'recarga') categoryLabel = 'Recarga Tiem. Air';

          map[key].articlesMap[articleKey] = {
            name: item.product.name,
            categoryLabel,
            quantity: 0,
            unitPrice: item.unitPrice,
            totalPrice: 0
          };
        }
        map[key].articlesMap[articleKey].quantity += item.quantity;
        map[key].articlesMap[articleKey].totalPrice += item.totalPrice;
      });

      // Split sales by payment method
      if (payMethod.includes('tarjeta') || payMethod.includes('card')) {
        map[key].tarjetaTotal += ticketTotalSum;
      } else if (payMethod.includes('transfer') || payMethod.includes('spei')) {
        map[key].transferenciaTotal += ticketTotalSum;
      } else {
        // Default to efectivo
        map[key].efectivoTotal += ticketTotalSum;
      }
    });

    // Aggregate Expenses by Date + Branch
    combinedExpenses.forEach((exp) => {
      if (selectedBranchId !== 'all' && exp.branchId !== selectedBranchId) return;

      const dateObj = new Date(exp.timestamp);
      const dateIsoKey = dateObj.toISOString().split('T')[0];
      const dateFormatted = dateObj.toLocaleDateString('es-MX', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const expTime = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

      const key = `${dateIsoKey}_${exp.branchId}`;

      if (!map[key]) {
        map[key] = {
          dateIsoKey,
          dateFormatted,
          branchId: exp.branchId,
          branchName: getBranchName(exp.branchId),
          accesoriosTotal: 0,
          equiposTotal: 0,
          abonosTotal: 0,
          recargasTotal: 0,
          totalBruto: 0,
          efectivoTotal: 0,
          tarjetaTotal: 0,
          transferenciaTotal: 0,
          gastosTotal: 0,
          netoCaja: 0,
          efectivoNetoCaja: 0,
          operatorNamesSet: new Set<string>(),
          tickets: [],
          expenses: [],
          articlesMap: {},
          categorizedOps: {
            accesorio: [],
            equipo: [],
            abono: [],
            recarga: [],
            gastos: []
          }
        };
      }

      if (exp.operatorName) map[key].operatorNamesSet.add(exp.operatorName);
      map[key].expenses.push(exp);
      map[key].gastosTotal += exp.amount;
      map[key].categorizedOps.gastos.push({
        id: exp.id,
        time: expTime,
        operatorName: exp.operatorName || 'Operador',
        concept: exp.concept,
        amount: exp.amount
      });
    });

    // Calculate Net Cash and map grouped articles list
    let result = Object.values(map).map((row) => {
      const groupedArticles = Object.values(row.articlesMap).sort((a, b) => b.totalPrice - a.totalPrice);
      const netoCaja = row.totalBruto - row.gastosTotal;
      const efectivoNetoCaja = row.efectivoTotal - row.gastosTotal;

      return {
        ...row,
        netoCaja,
        efectivoNetoCaja,
        operatorNames: Array.from(row.operatorNamesSet).join(', ') || 'Operador General',
        groupedArticles
      };
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.dateFormatted.toLowerCase().includes(q) ||
          r.branchName.toLowerCase().includes(q) ||
          r.operatorNames.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => b.dateIsoKey.localeCompare(a.dateIsoKey));
  }, [combinedTickets, combinedExpenses, selectedBranchId, searchQuery]);

  // Copy Ticket Details Handler
  const handleCopyTicket = (ticket: SaleTicket) => {
    const dateFormatted = new Date(ticket.timestamp).toLocaleString('es-MX');
    const itemsStr = ticket.items
      .map((i) => `• ${i.quantity}x ${i.product.name} - $${i.totalPrice.toFixed(2)}`)
      .join('\n');

    const text = `🧾 *TICKET VENTA #${ticket.id}*\n📅 ${dateFormatted}\n🏬 ${getBranchName(
      ticket.branchId
    )}\n👤 Vendedor: ${ticket.operatorName}\n💳 Pago: ${ticket.paymentMethod}\n\n*PRODUCTOS:*\n${itemsStr}\n\n💰 *TOTAL: $${ticket.total.toFixed(
      2
    )} MXN*`;

    navigator.clipboard.writeText(text);
    setCopiedTicketId(ticket.id);
    setTimeout(() => setCopiedTicketId(null), 2000);
  };

  return (
    <div className="space-y-5 pb-16">
      
      {/* ========================================================================= */}
      {/* REDISTRIBUTED SALES MODULE HEADER */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3.5">
        
        {/* Top Title & Filters Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          
          {/* Module Title & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xs border border-blue-400/30 shrink-0">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                  Módulo de Ventas y Reportes
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Auditoría
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Consulta y trazabilidad de operaciones por día, categoría y sucursal
              </p>
            </div>
          </div>

          {/* Branch & Search Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Branch Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300/80 px-3 py-2 rounded-xl text-xs font-black shadow-2xs focus-within:ring-2 focus-within:ring-blue-600">
              <Store className="w-4 h-4 text-blue-600 shrink-0" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-slate-900 font-extrabold text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="all">🌐 Todas las Sucursales</option>
                <option value="b-bodega">🏬 Bodega Central</option>
                <option value="b-navojoa">🏪 Sucursal Navojoa</option>
                <option value="b-huatabampo">🏪 Sucursal Huatabampo</option>
              </select>
            </div>

            {/* Search Input Box */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar fecha, sucursal, modelo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300/80 rounded-xl text-xs font-extrabold text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>

        </div>

        {/* Category Navigation Tabs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
          
          {/* ACCESORIOS */}
          <button
            onClick={() => setActiveTab('accesorio')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'accesorio'
                ? 'bg-blue-600 text-white shadow-md scale-[1.02]'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <ShoppingBag className={`w-4 h-4 ${activeTab === 'accesorio' ? 'text-white' : 'text-blue-600'}`} />
            <span>Accesorios</span>
          </button>

          {/* EQUIPOS */}
          <button
            onClick={() => setActiveTab('equipo')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'equipo'
                ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <Smartphone className={`w-4 h-4 ${activeTab === 'equipo' ? 'text-slate-950' : 'text-amber-600'}`} />
            <span>Equipos</span>
          </button>

          {/* ABONOS */}
          <button
            onClick={() => setActiveTab('abono')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'abono'
                ? 'bg-purple-600 text-white shadow-md scale-[1.02]'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <CreditCard className={`w-4 h-4 ${activeTab === 'abono' ? 'text-white' : 'text-purple-600'}`} />
            <span>Abonos</span>
          </button>

          {/* RECARGAS */}
          <button
            onClick={() => setActiveTab('recarga')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'recarga'
                ? 'bg-emerald-600 text-white shadow-md scale-[1.02]'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <Zap className={`w-4 h-4 ${activeTab === 'recarga' ? 'text-white' : 'text-emerald-600'}`} />
            <span>Recargas</span>
          </button>

          {/* GASTOS */}
          <button
            onClick={() => setActiveTab('gastos')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'gastos'
                ? 'bg-rose-600 text-white shadow-md scale-[1.02]'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <Wallet className={`w-4 h-4 ${activeTab === 'gastos' ? 'text-white' : 'text-rose-600'}`} />
            <span>Gastos</span>
          </button>

          {/* CORTES X */}
          <button
            onClick={() => setActiveTab('corte_x')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'corte_x'
                ? 'bg-slate-900 text-white shadow-md scale-[1.02] ring-2 ring-emerald-400/50'
                : 'bg-transparent text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <FileText className={`w-4 h-4 ${activeTab === 'corte_x' ? 'text-emerald-400' : 'text-slate-800'}`} />
            <span>Cortes X</span>
          </button>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* CATEGORY VIEW CONTENT PANELS */}
      {/* ========================================================================= */}

      {/* ------------------------------------------------------------------------- */}
      {/* CATEGORY 1: ACCESORIOS (RENGLONES DE DIAS CON VENTAS + VENTANA EMERGENTE) */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'accesorio' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              <h2 className="font-extrabold text-slate-900 text-sm">
                Registro por Día y Sucursal — Accesorios
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Haz clic en cualquier renglón para desplegar el desglose en ventana emergente
            </span>
          </div>

          {accessoryRows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-slate-700 text-sm">No hay registros de accesorios en este criterio</h3>
              <p className="text-xs text-slate-500">Realiza una venta de accesorios en el Módulo de POS para verla reflejada aquí.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Col. 1: Fecha</th>
                    <th className="p-3.5">Col. 2: Sucursal</th>
                    <th className="p-3.5 text-right">Col. 3: Ventas ($ / Pzs)</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {accessoryRows.map((row) => (
                    <tr
                      key={`${row.dateIsoKey}_${row.branchId}`}
                      onClick={() =>
                        setEmergentModalData({
                          title: `Desglose de Ventas Accesorios — ${row.branchName}`,
                          dateLabel: row.dateFormatted,
                          branchLabel: row.branchName,
                          tickets: row.tickets,
                          categoryType: 'accesorio'
                        })
                      }
                      className="hover:bg-blue-50/60 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="font-black text-slate-900">{row.dateFormatted}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-extrabold rounded-lg border border-slate-200">
                          {row.branchName}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono">
                        <span className="font-black text-slate-900 text-sm block">
                          ${row.totalAmount.toFixed(2)} MXN
                        </span>
                        <span className="text-[10px] text-blue-600 font-bold block">
                          {row.itemsCount} piezas vendidas
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button className="px-3 py-1.5 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white text-blue-700 border border-blue-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer shadow-2xs">
                          <Eye className="w-3.5 h-3.5" />
                          Ver Desglose ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* CATEGORY 2: EQUIPOS (MAS COLUMNAS PARA INFORMACION DEL EQUIPO VENDIDO) */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'equipo' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-amber-600" />
              <h2 className="font-extrabold text-slate-900 text-sm">
                Registro de Equipos / Celulares Vendidos y Financiamientos
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Trazabilidad de Venta a Crédito: Precio Total, Enganche en Caja y Saldo por Cobrar
            </span>
          </div>

          {/* KPI Summary Cards for Equipment & Credit Sales */}
          {equipoRecords.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                  <span>Equipos Vendidos</span>
                  <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {equipoRecords.length} <span className="text-xs font-normal text-slate-500">unid.</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                  <span>Precio Total Equipos</span>
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-lg font-black text-blue-900 mt-1 font-mono">
                  ${equipoRecords.reduce((s, r) => s + r.fullPrice, 0).toFixed(2)}
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
                <div className="text-[11px] font-bold text-emerald-800 flex items-center justify-between">
                  <span>Enganches en Caja</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-lg font-black text-emerald-700 mt-1 font-mono">
                  ${equipoRecords.reduce((s, r) => s + r.downPayment, 0).toFixed(2)}
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-indigo-200 bg-indigo-50/30 shadow-2xs">
                <div className="text-[11px] font-bold text-indigo-800 flex items-center justify-between">
                  <span>Saldo Financiado</span>
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="text-lg font-black text-indigo-900 mt-1 font-mono">
                  ${equipoRecords.reduce((s, r) => s + r.remainingBalance, 0).toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {equipoRecords.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <Smartphone className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-slate-700 text-sm">No hay equipos vendidos registrados</h3>
              <p className="text-xs text-slate-500">Las ventas de celulares (Contado o Crédito) aparecerán aquí.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Fecha / Sucursal</th>
                    <th className="p-3.5">Código</th>
                    <th className="p-3.5">Modelo</th>
                    <th className="p-3.5">IMEI</th>
                    <th className="p-3.5">Número</th>
                    <th className="p-3.5">Nombre Cliente</th>
                    <th className="p-3.5 text-right">Enganche ($)</th>
                    <th className="p-3.5 text-right">Monto Financiado ($)</th>
                    <th className="p-3.5 text-right">Precio Equipo ($)</th>
                    <th className="p-3.5">Plataforma</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {equipoRecords.map((rec, idx) => (
                    <tr
                      key={idx}
                      onClick={() =>
                        setEmergentModalData({
                          title: `Detalle Venta de Equipo — ${rec.deviceModel}`,
                          dateLabel: rec.dateFormatted,
                          branchLabel: rec.branchName,
                          tickets: [rec.ticket],
                          categoryType: 'equipo'
                        })
                      }
                      className="hover:bg-amber-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                        <div className="font-bold text-slate-800">{rec.dateFormatted}</div>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px] border border-slate-200 mt-0.5 inline-block">
                          {rec.branchName}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[11px]">
                        <span className="bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-200 font-mono font-black">
                          {rec.code}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <strong className="text-slate-900 block font-bold text-xs">{rec.deviceModel}</strong>
                        <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          Equipo Celular
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-extrabold text-slate-800 text-[11px]">
                        {rec.imei}
                      </td>
                      <td className="p-3.5 font-mono text-slate-800 font-bold text-[11px] whitespace-nowrap">
                        {rec.clientPhone !== 'S/N' ? (
                          <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                            📱 {rec.clientPhone}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">S/N</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-900 font-extrabold text-xs">
                        {rec.clientName}
                      </td>
                      <td className="p-3.5 text-right font-mono font-extrabold text-emerald-700 text-xs">
                        ${rec.downPayment.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-xs">
                        {rec.remainingBalance > 0 ? (
                          <span className="text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            ${rec.remainingBalance.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">$0.00 (Liquidado)</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-slate-900 text-xs">
                        ${rec.fullPrice.toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-950 font-black rounded-full border border-amber-300 text-[10px] uppercase whitespace-nowrap">
                          {rec.platform}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button className="px-2.5 py-1 bg-amber-100 group-hover:bg-amber-500 group-hover:text-slate-950 text-amber-900 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer">
                          <Eye className="w-3.5 h-3.5" />
                          Ticket
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* CATEGORY 3: ABONOS (FECHA, SUCURSAL, MONTO, PLATAFORMA) */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'abono' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-600" />
              <h2 className="font-extrabold text-slate-900 text-sm">
                Registro de Abonos y Pagos Recibidos
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Formato simple: Fecha | Sucursal | Monto | Plataforma
            </span>
          </div>

          {abonoRecords.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-slate-700 text-sm">No hay registros de abonos</h3>
              <p className="text-xs text-slate-500">Los cobros de cuotas o liquidaciones de servicios figurarán aquí.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Sucursal</th>
                    <th className="p-3.5 text-right">Monto ($)</th>
                    <th className="p-3.5">Plataforma / Concepto</th>
                    <th className="p-3.5">Atendió</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {abonoRecords.map((rec, idx) => (
                    <tr
                      key={idx}
                      onClick={() =>
                        setEmergentModalData({
                          title: `Comprobante de Abono — $${rec.amount.toFixed(2)}`,
                          dateLabel: rec.dateFormatted,
                          branchLabel: rec.branchName,
                          tickets: [rec.ticket],
                          categoryType: 'abono'
                        })
                      }
                      className="hover:bg-purple-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                        {rec.dateFormatted}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-extrabold rounded-lg border border-slate-200">
                          {rec.branchName}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono">
                        <span className="font-black text-purple-700 text-sm">
                          ${rec.amount.toFixed(2)} MXN
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-purple-100 text-purple-900 font-black rounded-full border border-purple-200 text-[10px] uppercase">
                          {rec.platform}
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">Cliente: {rec.clientName}</span>
                      </td>
                      <td className="p-3.5 text-slate-700 font-bold">
                        {rec.operatorName}
                      </td>
                      <td className="p-3.5 text-center">
                        <button className="px-2.5 py-1 bg-purple-100 group-hover:bg-purple-600 group-hover:text-white text-purple-800 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer">
                          <Eye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* CATEGORY 4: RECARGAS (SOLO MONTO Y FECHA + SUCURSAL) */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'recarga' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              <h2 className="font-extrabold text-slate-900 text-sm">
                Registro de Recargas de Tiempo Aire
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Visualización simplificada: Fecha, Sucursal, Teléfono y Monto
            </span>
          </div>

          {recargaRecords.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <Zap className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-slate-700 text-sm">No hay recargas registradas</h3>
              <p className="text-xs text-slate-500">Las recargas vendidas desde el Módulo 1 se verán reflejadas de inmediato.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Sucursal</th>
                    <th className="p-3.5">Compañía / Número</th>
                    <th className="p-3.5 text-right">Monto ($)</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {recargaRecords.map((rec, idx) => (
                    <tr
                      key={idx}
                      onClick={() =>
                        setEmergentModalData({
                          title: `Comprobante Recarga ${rec.carrier} — $${rec.amount}`,
                          dateLabel: rec.dateFormatted,
                          branchLabel: rec.branchName,
                          tickets: [rec.ticket],
                          categoryType: 'recarga'
                        })
                      }
                      className="hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                        {rec.dateFormatted}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-extrabold rounded-lg border border-slate-200">
                          {rec.branchName}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <strong className="text-slate-900 block">{rec.carrier}</strong>
                        <span className="font-mono text-emerald-700 font-bold text-[11px]">
                          Tel: {rec.phoneNumber}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono">
                        <span className="font-black text-emerald-700 text-sm">
                          ${rec.amount.toFixed(2)} MXN
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button className="px-2.5 py-1 bg-emerald-100 group-hover:bg-emerald-600 group-hover:text-white text-emerald-900 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer">
                          <Eye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* CATEGORY 5: GASTOS (FECHA, SUCURSAL, CONCEPTO, CATEGORIA, MONTO) */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'gastos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-rose-600" />
              <h2 className="font-extrabold text-slate-900 text-sm">
                Registro de Gastos Operativos y Salidas de Caja
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Egresos reportados en Corte de Caja y Administración
            </span>
          </div>

          {gastoRecords.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <Wallet className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-slate-700 text-sm">No hay gastos registrados</h3>
              <p className="text-xs text-slate-500">Los egresos registrados durante el turno se sincronizarán aquí.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Sucursal</th>
                    <th className="p-3.5">Concepto / Descripción</th>
                    <th className="p-3.5 text-right">Monto ($)</th>
                    <th className="p-3.5">Registrado Por</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {gastoRecords.map((eItem) => {
                    const dateFormatted = new Date(eItem.timestamp).toLocaleString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <tr
                        key={eItem.id}
                        onClick={() =>
                          setEmergentModalData({
                            title: `Comprobante de Gasto — #${eItem.id}`,
                            dateLabel: dateFormatted,
                            branchLabel: getBranchName(eItem.branchId),
                            tickets: [],
                            expenseItem: eItem,
                            categoryType: 'gastos'
                          })
                        }
                        className="hover:bg-rose-50/50 transition-colors cursor-pointer group"
                      >
                        <td className="p-3.5 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                          {dateFormatted}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-extrabold rounded-lg border border-slate-200">
                            {getBranchName(eItem.branchId)}
                          </span>
                        </td>
                        <td className="p-3.5 font-extrabold text-slate-900">
                          {eItem.concept}
                        </td>
                        <td className="p-3.5 text-right font-mono">
                          <span className="font-black text-rose-600 text-sm">
                            -${eItem.amount.toFixed(2)} MXN
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-700 font-bold">
                          {eItem.operatorName}
                        </td>
                        <td className="p-3.5 text-center">
                          <button className="px-2.5 py-1 bg-rose-100 group-hover:bg-rose-600 group-hover:text-white text-rose-800 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer">
                            <Eye className="w-3.5 h-3.5" />
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* CATEGORY 6: CORTES X (RESUMEN GENERAL DIARIO DE TODOS LOS CONCEPTOS) */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'corte_x' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h2 className="font-extrabold text-slate-900 text-sm">
                Resumen General de Cortes X (Corte Diario por Sucursal)
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Reporte consolidado de lo que los operadores entregan de corte diario
            </span>
          </div>

          {corteXRows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-slate-700 text-sm">No hay Cortes X registrados en este período</h3>
              <p className="text-xs text-slate-500">Al registrar ventas de accesorios, equipos, abonos, recargas o gastos, el Corte X diario se genera de forma automática.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Sucursal</th>
                    <th className="p-3.5">Desglose de Conceptos</th>
                    <th className="p-3.5 text-right">Venta Bruta Total</th>
                    <th className="p-3.5 text-right">Gastos / Egresos</th>
                    <th className="p-3.5 text-right">Corte Neto en Caja</th>
                    <th className="p-3.5">Atendió</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {corteXRows.map((row) => (
                    <tr
                      key={`${row.dateIsoKey}_${row.branchId}`}
                      onClick={() =>
                        setEmergentModalData({
                          title: `Resumen de Corte X — ${row.branchName}`,
                          dateLabel: row.dateFormatted,
                          branchLabel: row.branchName,
                          tickets: row.tickets,
                          corteXExpenses: row.expenses,
                          corteXTotals: {
                            accesorios: row.accesoriosTotal,
                            equipos: row.equiposTotal,
                            abonos: row.abonosTotal,
                            recargas: row.recargasTotal,
                            totalBruto: row.totalBruto,
                            efectivoTotal: row.efectivoTotal,
                            tarjetaTotal: row.tarjetaTotal,
                            transferenciaTotal: row.transferenciaTotal,
                            totalGastos: row.gastosTotal,
                            netoCaja: row.netoCaja,
                            efectivoNetoCaja: row.efectivoNetoCaja,
                            operatorNames: row.operatorNames,
                            groupedArticles: row.groupedArticles,
                            categorizedOps: row.categorizedOps
                          },
                          categoryType: 'corte_x'
                        })
                      }
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          <span className="font-black text-slate-900">{row.dateFormatted}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-extrabold rounded-lg border border-slate-200">
                          {row.branchName}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {row.accesoriosTotal > 0 && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded border border-blue-200">
                              Acc: ${row.accesoriosTotal.toFixed(0)}
                            </span>
                          )}
                          {row.equiposTotal > 0 && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded border border-amber-200">
                              Eq: ${row.equiposTotal.toFixed(0)}
                            </span>
                          )}
                          {row.abonosTotal > 0 && (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded border border-purple-200">
                              Abo: ${row.abonosTotal.toFixed(0)}
                            </span>
                          )}
                          {row.recargasTotal > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">
                              Rec: ${row.recargasTotal.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        ${row.totalBruto.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-rose-600 font-bold">
                        {row.gastosTotal > 0 ? `-$${row.gastosTotal.toFixed(2)}` : '$0.00'}
                      </td>
                      <td className="p-3.5 text-right font-mono">
                        <span className="font-black text-emerald-700 text-sm bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block">
                          ${row.netoCaja.toFixed(2)} MXN
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-700 font-bold text-[11px]">
                        {row.operatorNames}
                      </td>
                      <td className="p-3.5 text-center">
                        <button className="px-3 py-1.5 bg-slate-900 group-hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer shadow-2xs">
                          <Eye className="w-3.5 h-3.5" />
                          Ver Corte X ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VENTANA EMERGENTE (EMERGENT MODAL) FOR BREAKDOWN & TICKETS */}
      {/* ========================================================================= */}
      {emergentModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-extrabold text-base leading-none">
                    {emergentModalData.title}
                  </h3>
                  <span className="text-[11px] text-slate-300 font-medium">
                    📅 {emergentModalData.dateLabel} • 🏬 {emergentModalData.branchLabel}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEmergentModalData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* Corte X Summary View: Formato de Lista Ticket / Desglose Continuo */}
              {emergentModalData.categoryType === 'corte_x' && emergentModalData.corteXTotals && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 font-sans space-y-4 shadow-xs">
                  
                  {/* Encabezado del Ticket de Corte X */}
                  <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-3 py-0.5 rounded-full inline-block">
                      📋 CORTE DE CAJA X — RESUMEN DIARIO
                    </span>
                    <h3 className="text-sm font-black text-slate-900">{emergentModalData.branchLabel}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Fecha: <strong className="text-slate-800">{emergentModalData.dateLabel}</strong> | Atendió: <strong className="text-slate-800">{emergentModalData.corteXTotals.operatorNames}</strong>
                    </p>
                  </div>

                  {/* LISTA DESGLOSADA DESPLEGABLE POR CATEGORIAS Y CADA OPERACION */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200">
                      <span className="font-black uppercase text-[10px] text-slate-500 tracking-wider">
                        📂 Desglose Desplegable por Categorías y Operaciones
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setExpandedCorteXCategories({ accesorio: true, equipo: true, abono: true, recarga: true, gastos: true })}
                          className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer transition-colors"
                        >
                          Desplegar Todas
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedCorteXCategories({ accesorio: false, equipo: false, abono: false, recarga: false, gastos: false })}
                          className="text-[10px] font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 cursor-pointer transition-colors"
                        >
                          Plegar Todas
                        </button>
                      </div>
                    </div>

                    {/* CATEGORY ACCORDIONS LIST */}
                    <div className="space-y-2">
                      {[
                        {
                          key: 'accesorio',
                          icon: '🛍️',
                          title: 'ACCESORIOS Y ARTÍCULOS',
                          totalAmount: emergentModalData.corteXTotals.accesorios,
                          ops: emergentModalData.corteXTotals.categorizedOps.accesorio,
                          badgeBg: 'bg-blue-100 text-blue-900 border-blue-200',
                          headerBg: 'bg-blue-50/80 hover:bg-blue-100/80 border-blue-200 text-blue-950',
                          accentColor: 'text-blue-700'
                        },
                        {
                          key: 'equipo',
                          icon: '📱',
                          title: 'EQUIPOS Y CELULARES',
                          totalAmount: emergentModalData.corteXTotals.equipos,
                          ops: emergentModalData.corteXTotals.categorizedOps.equipo,
                          badgeBg: 'bg-amber-100 text-amber-900 border-amber-200',
                          headerBg: 'bg-amber-50/80 hover:bg-amber-100/80 border-amber-200 text-amber-950',
                          accentColor: 'text-amber-800'
                        },
                        {
                          key: 'abono',
                          icon: '💳',
                          title: 'ABONOS Y SERVICIOS TÉCNICOS',
                          totalAmount: emergentModalData.corteXTotals.abonos,
                          ops: emergentModalData.corteXTotals.categorizedOps.abono,
                          badgeBg: 'bg-purple-100 text-purple-900 border-purple-200',
                          headerBg: 'bg-purple-50/80 hover:bg-purple-100/80 border-purple-200 text-purple-950',
                          accentColor: 'text-purple-800'
                        },
                        {
                          key: 'recarga',
                          icon: '⚡',
                          title: 'RECARGAS TIEMPO AIRE',
                          totalAmount: emergentModalData.corteXTotals.recargas,
                          ops: emergentModalData.corteXTotals.categorizedOps.recarga,
                          badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
                          headerBg: 'bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-200 text-emerald-950',
                          accentColor: 'text-emerald-800'
                        },
                        {
                          key: 'gastos',
                          icon: '💸',
                          title: 'GASTOS Y EGRESOS DEL DÍA',
                          totalAmount: emergentModalData.corteXTotals.totalGastos,
                          ops: emergentModalData.corteXTotals.categorizedOps.gastos,
                          badgeBg: 'bg-rose-100 text-rose-900 border-rose-200',
                          headerBg: 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-200 text-rose-950',
                          accentColor: 'text-rose-700',
                          isExpense: true
                        }
                      ].map((cat) => {
                        const isExpanded = !!expandedCorteXCategories[cat.key];
                        const opsCount = cat.ops ? cat.ops.length : 0;

                        return (
                          <div key={cat.key} className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-white transition-all">
                            
                            {/* Header del Acordeón / Fila Desplegable */}
                            <button
                              type="button"
                              onClick={() => setExpandedCorteXCategories(prev => ({ ...prev, [cat.key]: !prev[cat.key] }))}
                              className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer border-b ${
                                isExpanded ? 'border-slate-200 font-bold' : 'border-transparent'
                              } ${cat.headerBg}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">{cat.icon}</span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-xs tracking-tight">{cat.title}</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${cat.badgeBg}`}>
                                      {opsCount} {opsCount === 1 ? 'operación' : 'operaciones'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-medium block">
                                    {isExpanded ? 'Haga clic para plegar esta categoría' : 'Haga clic para desplegar todas las ventas'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className={`font-mono font-black text-sm ${cat.accentColor}`}>
                                  {cat.isExpense && cat.totalAmount > 0 ? `-$${cat.totalAmount.toFixed(2)}` : `$${cat.totalAmount.toFixed(2)}`}
                                </span>
                                <div className="p-1 rounded-lg bg-white/80 border border-slate-200 text-slate-700">
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>
                            </button>

                            {/* Contenido Desplegable (Detalle de cada operación) */}
                            {isExpanded && (
                              <div className="p-3 bg-slate-50/60 space-y-2 border-t border-slate-100 animate-in fade-in duration-150">
                                {opsCount === 0 ? (
                                  <p className="text-xs text-slate-400 italic text-center py-2">
                                    Sin operaciones registradas en esta categoría para la fecha seleccionada.
                                  </p>
                                ) : cat.isExpense ? (
                                  /* Detalle de Gastos */
                                  <div className="space-y-1.5">
                                    {cat.ops.map((expOp: any, idx: number) => (
                                      <div key={idx} className="p-2.5 bg-white rounded-xl border border-rose-200 shadow-2xs hover:border-rose-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-start gap-2.5">
                                          <span className="px-2 py-0.5 bg-rose-600 text-white font-mono font-black text-[10px] rounded-md shrink-0">
                                            EGRESO
                                          </span>
                                          <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-extrabold text-slate-900 text-xs">{expOp.concept}</span>
                                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                                #{expOp.id}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3 text-slate-400" /> {expOp.time}</span>
                                              <span>•</span>
                                              <span className="flex items-center gap-0.5"><User className="w-3 h-3 text-slate-400" /> {expOp.operatorName}</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                          <span className="font-mono font-black text-rose-600 text-xs">
                                            -${expOp.amount.toFixed(2)} MXN
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  /* Detalle de Ventas */
                                  <div className="space-y-1.5">
                                    {cat.ops.map((op: any, idx: number) => (
                                      <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-start gap-2.5">
                                          <span className="px-2 py-0.5 bg-slate-900 text-white font-mono font-black text-[10px] rounded-md shrink-0">
                                            {op.quantity}x
                                          </span>
                                          <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-extrabold text-slate-900 text-xs">{op.name}</span>
                                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                                #{op.ticketId}
                                              </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1">
                                              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3 text-slate-400" /> {op.time}</span>
                                              <span>•</span>
                                              <span className="flex items-center gap-0.5"><User className="w-3 h-3 text-slate-400" /> {op.operatorName}</span>
                                              {op.metadata?.phoneNumber && (
                                                <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                                  📲 {op.metadata.phoneNumber} ({op.metadata.carrier || 'Telcel'})
                                                </span>
                                              )}
                                              {op.metadata?.imei && (
                                                <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                                  IMEI: {op.metadata.imei}
                                                </span>
                                              )}
                                              {op.metadata?.clientName && (
                                                <span className="font-bold text-purple-800 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                                                  Cliente: {op.metadata.clientName}
                                                </span>
                                              )}
                                              {op.metadata?.fullPrice !== undefined && (
                                                <span className="font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 font-mono">
                                                  Precio: ${op.metadata.fullPrice.toFixed(2)} | Enganche: ${op.totalPrice.toFixed(2)} | Saldo: ${(op.metadata.remainingBalance ?? Math.max(0, op.metadata.fullPrice - op.totalPrice)).toFixed(2)}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-0 border-slate-100">
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                                            op.paymentMethod.toLowerCase().includes('tarjeta') ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' :
                                            op.paymentMethod.toLowerCase().includes('transfer') || op.paymentMethod.toLowerCase().includes('spei') ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                            'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          }`}>
                                            {op.paymentMethod}
                                          </span>
                                          <span className="font-mono font-black text-slate-900 text-xs">
                                            ${op.totalPrice.toFixed(2)} MXN
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* LIQUIDACION Y RESTA DE GASTOS / FORMAS DE PAGO */}
                  <div className="border-t-2 border-dashed border-slate-300 pt-3 space-y-2 text-xs">
                    
                    {/* Subtotal Venta Bruta */}
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-600 font-bold">Venta Bruta Total:</span>
                      <span className="font-mono font-black text-slate-900">${emergentModalData.corteXTotals.totalBruto.toFixed(2)}</span>
                    </div>

                    {/* Resta de Gastos */}
                    <div className="flex justify-between items-center py-0.5 text-rose-600 font-bold">
                      <span>(-) Gastos / Egresos del Día:</span>
                      <span className="font-mono font-black">-${emergentModalData.corteXTotals.totalGastos.toFixed(2)}</span>
                    </div>

                    {/* Desglose por Método de Pago */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 my-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider mb-1">
                        💳 Desglose por Método de Pago:
                      </span>
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-medium">💵 Entrada en Efectivo:</span>
                        <strong className="font-mono text-emerald-700">${emergentModalData.corteXTotals.efectivoTotal.toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-medium">💳 Entrada por Tarjeta:</span>
                        <strong className="font-mono text-cyan-700">${emergentModalData.corteXTotals.tarjetaTotal.toFixed(2)}</strong>
                      </div>
                      {emergentModalData.corteXTotals.transferenciaTotal > 0 && (
                        <div className="flex justify-between items-center text-slate-700">
                          <span className="font-medium">📲 Transferencia / SPEI:</span>
                          <strong className="font-mono text-indigo-700">${emergentModalData.corteXTotals.transferenciaTotal.toFixed(2)}</strong>
                        </div>
                      )}
                    </div>

                    {/* TOTAL NETO EFECTIVO EN CAJA */}
                    <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between shadow-md">
                      <div>
                        <span className="text-[10px] uppercase text-emerald-400 font-black block tracking-wider">
                          💵 EFECTIVO FÍSICO A ENTREGAR EN CAJA
                        </span>
                        <span className="text-[10px] text-slate-300">
                          (Efectivo recibido - Gastos pagados)
                        </span>
                      </div>
                      <span className="text-xl font-mono font-black text-emerald-400">
                        ${emergentModalData.corteXTotals.efectivoNetoCaja.toFixed(2)} MXN
                      </span>
                    </div>
                  </div>

                </div>
              )}

              {/* Expense Detail View if Expenses Modal */}
              {emergentModalData.categoryType === 'gastos' && emergentModalData.expenseItem ? (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-600">
                      Folio Reg: #{emergentModalData.expenseItem.id}
                    </span>
                    <span className="text-xl font-mono font-black text-rose-600">
                      -${emergentModalData.expenseItem.amount.toFixed(2)} MXN
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-bold">Concepto de Gasto:</span>
                      <strong className="text-slate-900 font-black">{emergentModalData.expenseItem.concept}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-bold">Sucursal:</span>
                      <strong className="text-slate-900">{getBranchName(emergentModalData.expenseItem.branchId)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-bold">Registrado por:</span>
                      <strong className="text-slate-900">{emergentModalData.expenseItem.operatorName}</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-bold">Fecha / Hora:</span>
                      <strong className="text-slate-900 font-mono">{emergentModalData.dateLabel}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                /* Tickets List View */
                <div className="space-y-4">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-500">
                    Tickets y Desglose de Artículos ({emergentModalData.tickets.length} tickets encontrados)
                  </h4>

                  {emergentModalData.tickets.map((ticket) => {
                    const filteredItems = ticket.items.filter((item) => {
                      if (emergentModalData.categoryType === 'accesorio') return getItemCategoryType(item) === 'accesorio';
                      if (emergentModalData.categoryType === 'equipo') return getItemCategoryType(item) === 'equipo';
                      if (emergentModalData.categoryType === 'abono') return getItemCategoryType(item) === 'abono';
                      if (emergentModalData.categoryType === 'recarga') return getItemCategoryType(item) === 'recarga';
                      return true;
                    });

                    if (filteredItems.length === 0) return null;

                    const ticketSubtotal = filteredItems.reduce((s, i) => s + i.totalPrice, 0);

                    return (
                      <div key={ticket.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div>
                            <span className="font-mono font-black text-slate-900 text-xs">
                              Ticket #{ticket.id}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Atendió: <strong>{ticket.operatorName}</strong> • Pago: {ticket.paymentMethod}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-sm">
                              ${ticketSubtotal.toFixed(2)}
                            </span>
                            <button
                              onClick={() => handleCopyTicket(ticket)}
                              className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                              title="Copiar Ticket"
                            >
                              {copiedTicketId === ticket.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Items Table */}
                        <div className="space-y-1.5">
                          {filteredItems.map((item, iIdx) => (
                            <div
                              key={iIdx}
                              className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{item.product.name}</span>
                                {item.metadata?.clientName && (
                                  <span className="text-[10px] text-amber-700 block font-medium">
                                    Cliente: {item.metadata.clientName}
                                  </span>
                                )}
                                {item.metadata?.imei && (
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    IMEI: {item.metadata.imei}
                                  </span>
                                )}
                                {item.metadata?.phoneNumber && (
                                  <span className="text-[10px] text-emerald-700 font-mono font-bold block">
                                    Tel: {item.metadata.phoneNumber} ({item.metadata.carrier})
                                  </span>
                                )}
                              </div>

                              <div className="text-right font-mono">
                                <span className="text-slate-500 text-[11px]">{item.quantity} x ${item.unitPrice}</span>
                                <strong className="text-slate-900 block font-black">${item.totalPrice.toFixed(2)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setEmergentModalData(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
              >
                Cerrar Ventana
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
