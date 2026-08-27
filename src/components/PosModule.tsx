import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  DollarSign, 
  CreditCard, 
  ArrowRight, 
  Calculator, 
  TrendingDown, 
  Smartphone, 
  RefreshCw, 
  Tag, 
  X, 
  CheckCircle2, 
  Store,
  Sparkles,
  Zap,
  Filter,
  Wrench,
  Barcode,
  ScanLine,
  Volume2,
  VolumeX,
  AlertCircle,
  Printer,
  MonitorSmartphone
} from 'lucide-react';
import { Product, CartItem, CartItemMetadata, SaleTicket, Expense, Branch, Operator, RepairRecord, CorteXRecord, CreditAccount, SesionCaja } from '../types';
import RechargeModal from './RechargeModal';
import CreditDeviceModal from './CreditDeviceModal';
import ExpenseModal from './ExpenseModal';
import CorteXModal from './CorteXModal';
import TicketReceiptModal from './TicketReceiptModal';
import ReprintTicketModal from './ReprintTicketModal';
import RepairModal from './RepairModal';
import RepairPriceCatalogModal from './RepairPriceCatalogModal';
import PaymentCheckoutModal from './PaymentCheckoutModal';
import CreditPaymentModal from './CreditPaymentModal';
import CaseModelModal from './CaseModelModal';
import { RepairPriceItem } from '../types';
import { newTicketId } from '../lib/ids';
import { loadPosDraft, savePosDraft, clearPosDraft } from '../lib/posDraftStorage';
import { getBranchStockQty, isVirtualPosProduct, VIRTUAL_POS_PRODUCT_IDS, findImeiInInventory, branchDisplayShort } from '../lib/inventoryRules';

interface PosModuleProps {
  products: Product[];
  currentBranch: Branch;
  currentOperator: Operator;
  salesTickets: SaleTicket[];
  expenses: Expense[];
  onCompleteSale: (ticket: SaleTicket) => void | Promise<void>;
  onAddExpense: (expense: Expense) => void;
  isCorteXOpen?: boolean;
  setIsCorteXOpen?: (open: boolean) => void;
  isExpenseModalOpen?: boolean;
  setIsExpenseModalOpen?: (open: boolean) => void;
  isRepairModalOpen?: boolean;
  setIsRepairModalOpen?: (open: boolean) => void;
  repairPrices?: RepairPriceItem[];
  onAddRepairPrice?: (item: RepairPriceItem) => void;
  onUpdateRepairPrice?: (item: RepairPriceItem) => void;
  onDeleteRepairPrice?: (id: string) => void;
  isRepairPriceCatalogOpen?: boolean;
  setIsRepairPriceCatalogOpen?: (open: boolean) => void;
  onFinalizeCorteX?: (corteRecord: CorteXRecord) => void;
  onLogout?: () => void;
  cortesX?: CorteXRecord[];
  initialCashFund?: number;
  activeCashSession?: SesionCaja | null;
  tillLocked?: boolean;
  creditAccounts?: CreditAccount[];
  repairRecords?: RepairRecord[];
  onAddRepairRecord?: (record: RepairRecord) => void;
  onUpdateRepairRecord?: (record: RepairRecord) => void;
}


export default function PosModule({
  products,
  currentBranch,
  currentOperator,
  salesTickets,
  expenses,
  onCompleteSale,
  onAddExpense,
  isCorteXOpen: externalCorteXOpen,
  setIsCorteXOpen: externalSetIsCorteXOpen,
  isExpenseModalOpen: externalExpenseOpen,
  setIsExpenseModalOpen: externalSetIsExpenseOpen,
  isRepairModalOpen: externalRepairOpen,
  setIsRepairModalOpen: externalSetIsRepairOpen,
  repairPrices = [],
  onAddRepairPrice = () => {},
  onUpdateRepairPrice = () => {},
  onDeleteRepairPrice = () => {},
  isRepairPriceCatalogOpen = false,
  setIsRepairPriceCatalogOpen = () => {},
  onFinalizeCorteX,
  onLogout,
  cortesX = [],
  initialCashFund,
  activeCashSession = null,
  tillLocked = false,
  creditAccounts = [],
  repairRecords: repairRecordsProp,
  onAddRepairRecord,
  onUpdateRepairRecord
}: PosModuleProps) {

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const pendingTicketRef = useRef<SaleTicket | null>(null);
  
  // Barcode Scanner & Search State
  const [scannerInput, setScannerInput] = useState<string>('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBeepEnabled, setIsBeepEnabled] = useState<boolean>(true);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleSearch = () => {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else {
        setSearchQuery('');
      }
      return next;
    });
  };

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [cashReceived, setCashReceived] = useState<string>('');

  // Modals state
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [selectedRechargeProduct, setSelectedRechargeProduct] = useState<Product | null>(null);

  const [isCreditDeviceModalOpen, setIsCreditDeviceModalOpen] = useState(false);
  const [selectedCreditProduct, setSelectedCreditProduct] = useState<Product | null>(null);

  const [localRepairRecords, setLocalRepairRecords] = useState<RepairRecord[]>(() => {
    try {
      const saved = localStorage.getItem(`erp_repair_records_${currentBranch.id}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading repair records', e);
    }
    return [];
  });

  const repairRecords = repairRecordsProp ?? localRepairRecords;

  useEffect(() => {
    if (repairRecordsProp) return;
    try {
      localStorage.setItem(`erp_repair_records_${currentBranch.id}`, JSON.stringify(localRepairRecords));
    } catch (e) {
      console.error('Error saving repair records', e);
    }
  }, [localRepairRecords, currentBranch.id, repairRecordsProp]);
  const [internalRepairOpen, setInternalRepairOpen] = useState(false);
  const [internalExpenseOpen, setInternalExpenseOpen] = useState(false);
  const [internalCorteXOpen, setInternalCorteXOpen] = useState(false);

  const isRepairModalOpen = externalRepairOpen ?? internalRepairOpen;
  const setIsRepairModalOpen = externalSetIsRepairOpen ?? setInternalRepairOpen;

  const isExpenseModalOpen = externalExpenseOpen ?? internalExpenseOpen;
  const setIsExpenseModalOpen = externalSetIsExpenseOpen ?? setInternalExpenseOpen;

  const isCorteXOpen = externalCorteXOpen ?? internalCorteXOpen;
  const setIsCorteXOpen = externalSetIsCorteXOpen ?? setInternalCorteXOpen;

  const [completedTicket, setCompletedTicket] = useState<SaleTicket | null>(null);
  const [isTicketReceiptOpen, setIsTicketReceiptOpen] = useState(false);
  const [isReprintModalOpen, setIsReprintModalOpen] = useState(false);
  const [isPaymentCheckoutModalOpen, setIsPaymentCheckoutModalOpen] = useState(false);
  const [isCreditPaymentModalOpen, setIsCreditPaymentModalOpen] = useState(false);
  const [isCaseModelModalOpen, setIsCaseModelModalOpen] = useState(false);
  const [selectedFundaProduct, setSelectedFundaProduct] = useState<Product | null>(null);

  // Focus scanner input on load
  useEffect(() => {
    if (scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const sessionId = activeCashSession?.id;
    if (!sessionId || currentBranch.id === 'b-bodega') {
      setDraftReady(true);
      return;
    }
    setDraftReady(false);
    const saved = loadPosDraft(currentBranch.id, currentOperator.id, sessionId);
    setCart(saved);
    setDraftReady(true);
  }, [activeCashSession?.id, currentBranch.id, currentOperator.id]);

  useEffect(() => {
    if (!draftReady) return;
    const sessionId = activeCashSession?.id;
    if (!sessionId || currentBranch.id === 'b-bodega') return;
    savePosDraft(currentBranch.id, currentOperator.id, sessionId, cart);
  }, [cart, draftReady, activeCashSession?.id, currentBranch.id, currentOperator.id]);

  // Beep Sound Synth for Barcode Scanner
  const playBeepSound = () => {
    if (!isBeepEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz POS scanner beep
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Ignore if browser restricts audio autoplay
    }
  };

  // Barcode scan handler (triggered on ENTER or scanner submit)
  const handleBarcodeScan = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = scannerInput.trim();
    if (!query) return;

    const queryUpper = query.toUpperCase();

    const imeiLookup = findImeiInInventory(products, queryUpper, currentBranch.id);
    if (imeiLookup.status === 'other_branch') {
      setScanFeedback({
        type: 'error',
        text: `❌ SUCURSAL INCORRECTA: El IMEI "${queryUpper}" pertenece a ${branchDisplayShort(imeiLookup.branchId)}. Realice el traspaso formal a ${currentBranch.name}.`
      });
      setScannerInput('');
      setTimeout(() => setScanFeedback(null), 4000);
      return;
    }
    if (imeiLookup.status === 'found') {
      playBeepSound();
      setSelectedCreditProduct(imeiLookup.product);
      setIsCreditDeviceModalOpen(true);
      setScanFeedback({
        type: 'success',
        text: `¡IMEI Validado!: ${imeiLookup.product.name}. Seleccione Contado o Crédito.`
      });
      setScannerInput('');
      setTimeout(() => setScanFeedback(null), 4000);
      return;
    }

    // If string looks like a 10-15 digit IMEI but was not found:
    if (/^\d{8,18}$/.test(queryUpper)) {
      setScanFeedback({
        type: 'error',
        text: `❌ BLOQUEO DE TRAZABILIDAD: El IMEI "${queryUpper}" NO coincide con ningún equipo activo en el inventario de ${currentBranch.name}.`
      });
      setScannerInput('');
      setTimeout(() => setScanFeedback(null), 4000);
      return;
    }

    // 2. Search standard product by exact code, exact id, or substring
    const matchedProduct = products.find(
      (p) =>
        p.code.toUpperCase() === queryUpper ||
        p.id.toUpperCase() === queryUpper ||
        p.name.toUpperCase().includes(queryUpper)
    );

    if (matchedProduct) {
      playBeepSound();
      handleProductClick(matchedProduct);
      setScanFeedback({
        type: 'success',
        text: `¡Producto Seleccionado!: ${matchedProduct.name}`
      });
    } else {
      setScanFeedback({
        type: 'error',
        text: `⚠️ Código o IMEI "${query}" no encontrado.`
      });
    }

    setScannerInput('');
    if (scannerInputRef.current) {
      scannerInputRef.current.focus();
    }

    // Auto dismiss toast feedback
    setTimeout(() => {
      setScanFeedback(null);
    }, 3500);
  };

  // POS Button Rank Determiner:
  // 1: Abono a Crédito (Inamovible 1)
  // 2: Venta de Celular / Equipo (Inamovible 2)
  // 3: Recargas Tiempo Aire (Inamovible 3)
  // 4: Servicio Técnico / Reparaciones (Inamovible 4)
  // 5+: Productos del inventario (Ordenados estrictamente por código numérico: CA-1, CA-2... CE-1, etc.)
  const getPosProductRank = (p: Product): number => {
    if (
      p.id === 'prod-abono-gen' || 
      p.code === 'ABO-CRED' || 
      p.code?.toUpperCase().startsWith('ABO') || 
      p.name?.toLowerCase().includes('abono a crédito') ||
      p.name?.toLowerCase().includes('cobrar abono')
    ) {
      return 1;
    }

    if (
      p.id === 'prod-equipo-credito-gen' || 
      p.code === 'EQ-VENTA' || 
      p.code === 'EQ-CRED' || 
      p.code?.toUpperCase().startsWith('EQ-') ||
      p.name?.toLowerCase().includes('venta de celular') ||
      p.name?.toLowerCase().includes('venta de equipo')
    ) {
      return 2;
    }

    if (
      p.id === 'prod-recarga-gen' || 
      p.code === 'REC-01' || 
      p.code?.toUpperCase().startsWith('REC') || 
      p.category === 'recarga' ||
      p.name?.toLowerCase().includes('recarga')
    ) {
      return 3;
    }

    if (
      p.id === 'prod-reparacion-gen' || 
      p.code === 'REP-01' || 
      p.code?.toUpperCase().startsWith('REP') || 
      p.code?.toUpperCase().startsWith('SERV') ||
      (p.category === 'servicio' && p.price === 0) ||
      p.name?.toLowerCase().includes('servicio técnico') ||
      p.name?.toLowerCase().includes('reparación')
    ) {
      return 4;
    }

    return 5;
  };

  // Products array (filtered by category/search and strictly ordered by rank and natural numerical code)
  const filteredProducts = useMemo(() => {
    const rawList = products.filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      const isSpecificDevice = (p.inventoryType === 'equipo' || p.category === 'equipo_credito' || p.category === 'telefonia') && 
        p.id !== 'prod-equipo-credito-gen' && 
        p.id !== 'prod-abono-gen';

      // Without search query, hide individual phone models so they don't clutter the screen with 50 buttons
      if (!q && isSpecificDevice) {
        return false;
      }

      let matchesCategory = true;
      if (selectedCategory === 'all') {
        matchesCategory = true;
      } else if (selectedCategory === 'accesorio') {
        matchesCategory = p.category === 'accesorio' || p.inventoryType === 'accesorio';
      } else if (selectedCategory === 'equipo') {
        matchesCategory = p.category === 'equipo_credito' || p.category === 'equipo' || p.inventoryType === 'equipo';
      } else if (selectedCategory === 'servicio') {
        matchesCategory = p.category === 'servicio' || p.id === 'prod-reparacion-gen';
      } else if (selectedCategory === 'recarga') {
        matchesCategory = p.category === 'recarga';
      } else if (selectedCategory === 'abono') {
        matchesCategory = p.id === 'prod-abono-gen' || p.name.toLowerCase().includes('abono');
      } else {
        matchesCategory = p.category === selectedCategory;
      }

      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q) ||
        p.imei?.toLowerCase().includes(q) ||
        p.imeiList?.some(im => im.toLowerCase().includes(q)) ||
        (p.branchImeiMap && Object.values(p.branchImeiMap).some(arr => arr.some(im => im.toLowerCase().includes(q))));
      return matchesCategory && matchesSearch;
    });

    return [...rawList].sort((a, b) => {
      const rankA = getPosProductRank(a);
      const rankB = getPosProductRank(b);

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      // Natural alphanumeric & numerical sort by product code (e.g. CA-1, CA-2, CA-10, CE-1, etc.)
      const codeA = (a.code || '').trim();
      const codeB = (b.code || '').trim();

      const codeComparison = codeA.localeCompare(codeB, 'es', { numeric: true, sensitivity: 'base' });
      if (codeComparison !== 0) {
        return codeComparison;
      }

      // Secondary alphabetical sort by name
      return (a.name || '').localeCompare(b.name || '', 'es', { numeric: true, sensitivity: 'base' });
    });
  }, [products, searchQuery, selectedCategory]);


  // Dynamic phone case detection: Any product with "funda" or "case" in name or category
  const isFundaProduct = (p: Product): boolean => {
    const name = (p.name || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const code = (p.code || '').toLowerCase();
    return name.includes('funda') || cat.includes('funda') || code.startsWith('fun') || name.includes('case');
  };

  // Add Product handler
  const handleProductClick = (product: Product) => {
    if (product.id === 'prod-abono-gen' || product.name.toLowerCase().includes('abono')) {
      setIsCreditPaymentModalOpen(true);
      return;
    }

    if (product.category === 'recarga') {
      setSelectedRechargeProduct(product);
      setIsRechargeModalOpen(true);
      return;
    }

    // ALL equipment / phone sales (generic button or specific model) route cleanly through unified modal
    if (
      product.id === 'prod-equipo-credito-gen' || 
      product.code === 'EQ-VENTA' ||
      product.code === 'EQ-CRED' ||
      product.inventoryType === 'equipo' || 
      product.category === 'equipo_credito' ||
      product.category === 'telefonia'
    ) {
      setSelectedCreditProduct(product);
      setIsCreditDeviceModalOpen(true);
      return;
    }

    if (product.id === 'prod-reparacion-gen' || (product.category === 'servicio' && product.price === 0)) {
      setIsRepairModalOpen(true);
      return;
    }

    // Dynamic Funda / Case Detection -> Prompt for Phone Model
    if (isFundaProduct(product)) {
      setSelectedFundaProduct(product);
      setIsCaseModelModalOpen(true);
      return;
    }

    // Standard products (Accessories, fixed price services, etc.)
    if (isOutOfStockProduct(product)) {
      setScanFeedback({ type: 'error', text: `Sin stock en ${currentBranch.name} para ${product.name}.` });
      setTimeout(() => setScanFeedback(null), 3500);
      return;
    }
    addToCart(product, product.price);
  };

  const handleConfirmCaseModel = (product: Product, modelName: string, quantity: number = 1) => {
    addToCart(product, product.price, { caseModel: modelName }, quantity);
  };

  const isOutOfStockProduct = (p: Product): boolean => {
    if (VIRTUAL_POS_PRODUCT_IDS.has(p.id)) return false;
    if (p.category === 'recarga' || p.category === 'servicio') return false;
    return getBranchStockQty(p, currentBranch.id) <= 0;
  };

  const addToCart = (product: Product, unitPrice: number, metadata?: CartItemMetadata, initialQty: number = 1) => {
    if (!isVirtualPosProduct(product) && product.category !== 'recarga' && product.category !== 'servicio' && !metadata?.repairType && metadata?.saleType !== 'abono') {
      const available = getBranchStockQty(product, currentBranch.id);
      const alreadyInCart = cart
        .filter((i) => i.product.id === product.id && !i.metadata?.imei)
        .reduce((sum, i) => sum + i.quantity, 0);
      if (alreadyInCart + initialQty > available) {
        setScanFeedback({
          type: 'error',
          text: `Stock insuficiente en ${currentBranch.name}. Disponible: ${available}.`
        });
        setTimeout(() => setScanFeedback(null), 3500);
        return;
      }
    }

    setCart((prevCart) => {
      // If it's a phone case with a model specified, group by same product AND same caseModel
      if (metadata?.caseModel) {
        const existingCaseIndex = prevCart.findIndex(
          (i) => i.product.id === product.id && i.metadata?.caseModel === metadata.caseModel
        );

        if (existingCaseIndex > -1) {
          const updated = [...prevCart];
          const item = updated[existingCaseIndex];
          const newQty = item.quantity + initialQty;
          updated[existingCaseIndex] = {
            ...item,
            quantity: newQty,
            totalPrice: newQty * item.unitPrice
          };
          return updated;
        }

        const newItem: CartItem = {
          cartItemId: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product,
          quantity: initialQty,
          unitPrice,
          totalPrice: unitPrice * initialQty,
          metadata
        };
        return [...prevCart, newItem];
      }

      // If it's a special product with unique metadata (recharge, credit phone, repair), add as separate line
      if (metadata) {
        const newItem: CartItem = {
          cartItemId: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product,
          quantity: initialQty,
          unitPrice,
          totalPrice: unitPrice * initialQty,
          metadata
        };
        return [...prevCart, newItem];
      }

      // Check if standard product already exists in cart
      const existingIndex = prevCart.findIndex(
        (i) => i.product.id === product.id && !i.metadata
      );

      if (existingIndex > -1) {
        const updated = [...prevCart];
        const item = updated[existingIndex];
        const newQty = item.quantity + initialQty;
        updated[existingIndex] = {
          ...item,
          quantity: newQty,
          totalPrice: newQty * item.unitPrice
        };
        return updated;
      }

      // New standard item
      const newItem: CartItem = {
        cartItemId: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product,
        quantity: initialQty,
        unitPrice,
        totalPrice: unitPrice * initialQty
      };
      return [...prevCart, newItem];
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId !== cartItemId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (
            delta > 0 &&
            !isVirtualPosProduct(item.product) &&
            item.product.category !== 'recarga' &&
            item.product.category !== 'servicio' &&
            !item.metadata?.imei
          ) {
            const available = getBranchStockQty(item.product, currentBranch.id);
            if (newQty > available) return item;
          }
          return {
            ...item,
            quantity: newQty,
            totalPrice: newQty * item.unitPrice
          };
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setCashReceived('');
    pendingTicketRef.current = null;
    clearPosDraft(currentBranch.id, currentOperator.id);
  };

  const commitSale = async (ticket: SaleTicket) => {
    if (saleBusy) return false;
    setSaleBusy(true);
    setSaleError(null);
    const toSave = pendingTicketRef.current?.id === ticket.id
      ? { ...pendingTicketRef.current, ...ticket, id: pendingTicketRef.current.id }
      : ticket;
    pendingTicketRef.current = toSave;
    try {
      await Promise.resolve(onCompleteSale(toSave));
      pendingTicketRef.current = null;
      setCompletedTicket(toSave);
      setIsTicketReceiptOpen(true);
      clearCart();
      return true;
    } catch (err) {
      console.error('Error cobrando ticket:', err);
      setSaleError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la venta. El ticket sigue en pantalla. Pulsa Cobrar de nuevo; no se duplicará.'
      );
      return false;
    } finally {
      setSaleBusy(false);
    }
  };

  // Cart Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartTotal = cartSubtotal;

  // Open Payment Modal
  const handleCheckout = () => {
    if (tillLocked) {
      setSaleError('La caja ya cerró a las 11:00 p.m. No se pueden cobrar más ventas en este turno.');
      return;
    }
    if (cart.length === 0) return;
    setIsPaymentCheckoutModalOpen(true);
  };

  // Complete sale after payment modal confirmation
  const handleConfirmPaymentFromModal = async (
    method: 'Efectivo' | 'Tarjeta' | 'Transferencia',
    cashReceivedVal: number,
    changeVal: number
  ) => {
    const reused = pendingTicketRef.current;
    const newTicket: SaleTicket = {
      id: reused?.id || newTicketId(),
      timestamp: reused?.timestamp || new Date().toISOString(),
      branchId: currentBranch.id,
      operatorName: currentOperator.name,
      items: [...cart],
      total: cartTotal,
      paymentMethod: method,
      cashReceived: method === 'Efectivo' ? cashReceivedVal : undefined,
      change: method === 'Efectivo' ? changeVal : undefined
    };

    const ok = await commitSale(newTicket);
    if (ok) {
      setIsPaymentCheckoutModalOpen(false);
    } else {
      throw new Error('No se pudo guardar la venta. El ticket sigue en pantalla.');
    }
  };

  return (
    <div className="h-full flex flex-col gap-2 p-3 bg-slate-100/80 overflow-y-auto md:overflow-hidden">
      {currentBranch.id !== 'b-bodega' && (
        <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-start gap-2">
          <MonitorSmartphone className="w-4 h-4 text-[#0047AB] mt-0.5 shrink-0" />
          <p className="text-[11px] leading-relaxed text-slate-600">
            {tillLocked
              ? 'Caja cerrada a las 11:00 p.m. (hora Sonora). El corte del día ya quedó registrado. El siguiente turno abre después de medianoche.'
              : activeCashSession?.id
              ? 'Si recargas o entras en otra computadora de esta sucursal, el turno es el mismo. A las 11:00 p.m. el sistema registra el corte y cierra la sesión solo.'
              : 'Conectando el turno de caja… no cobres hasta ver “Turno abierto”.'}
          </p>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
      
      {/* LEFT COLUMN: Barcode Scanner & Product Grid ("BOTONES DE COBRO") */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 overflow-y-auto min-h-[300px] md:min-h-0">
        
        {/* ULTRA-COMPACT BARCODE SCANNER TOOLBAR */}
        <div className="mb-2 pb-2 border-b border-slate-100 space-y-1.5 shrink-0">
          <form onSubmit={handleBarcodeScan} className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Barcode className="w-4 h-4 text-indigo-600" />
              </div>
              <input
                ref={scannerInputRef}
                type="text"
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                placeholder="Escanear Código o Clave (ej: CARG-20W, CRIS-9H)..."
                className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-indigo-200 focus:border-indigo-600 focus:bg-white text-slate-900 text-xs font-bold rounded-lg outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                {scannerInput && (
                  <button
                    type="button"
                    onClick={() => setScannerInput('')}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <span className="flex h-1.5 w-1.5 relative" title="Escáner listo">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1.5 bg-[#0047AB] hover:bg-[#003d93] text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>Agregar</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBeepEnabled(!isBeepEnabled)}
              className={`p-1.5 border rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                isBeepEnabled ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
              title={isBeepEnabled ? 'Sonido Bip Activado' : 'Sonido Desactivado'}
            >
              {isBeepEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={toggleSearch}
              className={`p-1.5 border rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                isSearchOpen || searchQuery ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
              title={isSearchOpen ? 'Cerrar buscador' : 'Buscar por nombre o modelo'}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Toggleable Search Bar */}
          {(isSearchOpen || searchQuery) && (
            <div className="pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-indigo-500 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar productos por nombre, modelo o marca..."
                  className="w-full pl-8 pr-7 py-1 bg-indigo-50/70 border border-indigo-200 focus:border-indigo-600 focus:bg-white text-slate-900 text-xs font-bold rounded-lg outline-none placeholder:text-slate-400 placeholder:font-normal"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Toast / Feedback Banner for Barcode Scanner */}
          {scanFeedback && (
            <div className={`px-2 py-1 rounded-lg text-[11px] font-extrabold flex items-center justify-between border animate-in fade-in duration-100 ${
              scanFeedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                : 'bg-red-50 text-red-900 border-red-300'
            }`}>
              <div className="flex items-center gap-1.5">
                {scanFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                )}
                <span>{scanFeedback.text}</span>
              </div>
              <button 
                onClick={() => setScanFeedback(null)} 
                className="text-slate-400 hover:text-slate-700 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Quick Category Filter Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('accesorio')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'accesorio'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              <Tag className="w-3 h-3" />
              Accesorios ({products.filter(p => p.category === 'accesorio' || p.inventoryType === 'accesorio').length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('equipo')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'equipo'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              Equipos / Celulares ({products.filter(p => p.category === 'equipo_credito' || p.category === 'equipo' || p.inventoryType === 'equipo').length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('servicio')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'servicio'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <Wrench className="w-3 h-3" />
              Taller / Reparaciones
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('recarga')}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'recarga'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
              }`}
            >
              <Zap className="w-3 h-3" />
              Recargas
            </button>
          </div>
        </div>
        
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
            <ShoppingBag className="w-12 h-12 mb-3 text-slate-300 stroke-1" />
            <p className="text-sm font-bold text-slate-700">No hay productos en esta categoría o búsqueda.</p>
            <p className="text-xs text-slate-400 mt-1">
              Los nuevos modelos registrados en <strong>Inventario</strong> aparecen automáticamente aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 gap-3.5">
            {filteredProducts.map((p) => {
              const isRecarga = p.category === 'recarga';
              const isEquipoCredito = p.category === 'equipo_credito' || p.inventoryType === 'equipo';
              const isReparacion = p.id === 'prod-reparacion-gen' || (p.category === 'servicio' && p.price === 0);

              const branchStockQty = getBranchStockQty(p, currentBranch.id);

              const isOutOfStock = isOutOfStockProduct(p);

              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (isOutOfStock) return;
                    handleProductClick(p);
                  }}
                  disabled={isOutOfStock}
                  className={`group relative flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all duration-150 shadow-2xs hover:shadow-md active:scale-[0.98] min-h-[125px] cursor-pointer ${
                    isRecarga 
                      ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'
                      : isEquipoCredito
                      ? 'bg-indigo-50/50 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
                      : isReparacion
                      ? 'bg-amber-50/50 border-amber-200 hover:border-amber-400 hover:bg-amber-50'
                      : isOutOfStock
                      ? 'bg-red-50/20 border-red-200 hover:border-red-400 hover:bg-red-50/40'
                      : 'bg-white border-slate-200/90 hover:border-blue-400 hover:bg-slate-50/80'
                  }`}
                >
                  {/* Top row: Code & Category Tag */}
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <span className="font-mono text-[10px] font-semibold tracking-wide px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                      {p.code}
                    </span>
                    {isRecarga && (
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                        Recarga
                      </span>
                    )}
                    {isEquipoCredito && (
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                        Equipo
                      </span>
                    )}
                    {isReparacion && (
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                        Taller
                      </span>
                    )}
                  </div>

                  {/* Product Name */}
                  <h4 className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 line-clamp-2 leading-relaxed mb-2 transition-colors">
                    {p.name}
                  </h4>

                  {/* Bottom row: Price / Stock info */}
                  <div className="flex items-center justify-between w-full pt-2 border-t border-slate-100 mt-auto">
                    <span className="text-sm font-bold text-slate-900">
                      {isRecarga || (isEquipoCredito && p.price === 0) || isReparacion ? (
                        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {isReparacion ? 'Dejar / Entregar' : 'Ingresar Monto'}
                        </span>
                      ) : (
                        `$${p.price.toFixed(2)}`
                      )}
                    </span>

                    {!isRecarga && !isReparacion && p.id !== 'prod-abono-gen' && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isOutOfStock 
                          ? 'bg-red-100 text-red-700 font-extrabold' 
                          : branchStockQty < 5 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isOutOfStock ? 'Agotado (0)' : `Stock: ${branchStockQty}`}
                      </span>
                    )}
                  </div>

                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* RIGHT COLUMN: COMPACT, SLEEK CARRITO DE COMPRAS */}
      <div className="w-full md:w-[290px] lg:w-[310px] xl:w-[320px] 2xl:w-[340px] shrink-0 bg-white rounded-2xl border border-slate-200/90 shadow-md flex flex-col h-[480px] md:h-auto overflow-hidden">
        
        {/* Ticket Header */}
        <div className="px-3 py-2.5 bg-slate-50 text-slate-800 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white rounded-lg border border-slate-200">
              <ShoppingBag className="w-4 h-4 text-[#0047AB]" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Ticket actual</h3>
              <p className="text-[11px] text-slate-500">{cart.length} {cart.length === 1 ? 'artículo' : 'artículos'}</p>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[11px] text-red-700 hover:text-red-800 font-semibold px-2 py-1 rounded-md bg-red-50 hover:bg-red-100 border border-red-100 cursor-pointer"
            >
              Vaciar
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-2.5 divide-y divide-slate-100 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8 text-center space-y-2">
              <div className="p-3 bg-slate-50 rounded-full border border-slate-200">
                <ShoppingBag className="w-8 h-8 text-slate-300 stroke-1" />
              </div>
              <p className="text-xs font-extrabold text-slate-700">Carrito de compras vacío</p>
              <p className="text-[11px] text-slate-400 max-w-[200px] leading-relaxed">
                Selecciona un producto o servicio de la izquierda para agregarlo.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.cartItemId} className="pt-2 first:pt-0 space-y-1.5">
                
                {/* Item Name & Delete */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[9px] font-extrabold bg-slate-100 text-slate-800 px-1 py-0.5 rounded border border-slate-200 shrink-0">
                      {item.product.code}
                    </span>
                    <span className="text-[11px] font-bold text-slate-900 leading-tight truncate" title={item.product.name}>
                      {item.product.name}
                    </span>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.cartItemId)}
                    className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                    title="Quitar producto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Specific Metadata display */}
                {item.metadata?.rechargeAmount && !item.metadata?.phoneNumber && (
                  <div className="text-[10px] bg-emerald-50 text-emerald-900 px-2 py-1 rounded-lg border border-emerald-200/80 font-bold">
                    ⚡ Recarga (${item.metadata.rechargeAmount} MXN)
                  </div>
                )}

                {item.metadata?.phoneNumber && (
                  <div className="text-[10px] bg-emerald-50 text-emerald-950 px-2 py-1.5 rounded-lg border border-emerald-200/80 font-medium space-y-0.5">
                    <div>📱 Tel: <strong className="font-mono font-bold text-emerald-900">{item.metadata.phoneNumber}</strong></div>
                    {item.metadata.carrier && <div>📡 Compañía: <strong>{item.metadata.carrier}</strong></div>}
                  </div>
                )}

                {item.metadata?.clientName && item.metadata?.financingPlatform && (
                  <div className="text-[10px] bg-indigo-50 text-indigo-950 px-2 py-1.5 rounded-lg border border-indigo-200/80 font-medium space-y-0.5">
                    <div>👤 Cliente: <strong>{item.metadata.clientName}</strong></div>
                    <div>📱 Equipo: <strong>{item.metadata.deviceModel}</strong> (IMEI: <span className="font-mono font-bold">{item.metadata.imei}</span>)</div>
                    <div>🏦 Financiera: <strong>{item.metadata.financingPlatform}</strong></div>
                    {item.metadata.fullPrice !== undefined && (
                      <div className="pt-1 mt-1 border-t border-indigo-200/80 flex items-center justify-between font-mono text-[9.5px]">
                        <span>Precio Equipo: <strong className="text-slate-900">${item.metadata.fullPrice.toFixed(2)}</strong></span>
                        <span>Saldo Financiado: <strong className="text-emerald-800">${(item.metadata.remainingBalance ?? Math.max(0, item.metadata.fullPrice - (item.metadata.downPayment || 0))).toFixed(2)}</strong></span>
                      </div>
                    )}
                  </div>
                )}

                {item.metadata?.repairId && (
                  <div className="text-[10px] bg-amber-50 text-amber-950 px-2 py-1.5 rounded-lg border border-amber-200/80 font-medium space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span>🔧 Folio: <strong className="font-mono">{item.metadata.repairId}</strong></span>
                      <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 font-bold rounded text-[9px]">
                        {item.metadata.repairType === 'anticipo' ? 'Anticipo' : 'Saldo Final'}
                      </span>
                    </div>
                    <div>👤 Cliente: <strong>{item.metadata.clientName}</strong></div>
                  </div>
                )}

                {/* Specific metadata for Phone Cases (Fundas) */}
                {item.metadata?.caseModel && (
                  <div className="text-[10px] bg-blue-50 text-blue-950 px-2 py-1.5 rounded-lg border border-blue-200/80 font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate">
                      <Smartphone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Modelo: <strong className="font-bold text-blue-900">{item.metadata.caseModel}</strong></span>
                    </span>
                  </div>
                )}

                {/* Quantity Controls & Price */}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => updateQuantity(item.cartItemId, -1)}
                      className="w-5 h-5 flex items-center justify-center bg-white rounded text-slate-700 hover:bg-slate-200 font-bold text-xs shadow-2xs cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-[11px] font-black text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.cartItemId, 1)}
                      className="w-5 h-5 flex items-center justify-center bg-white rounded text-slate-700 hover:bg-slate-200 font-bold text-xs shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 block">
                      {item.quantity} x ${item.unitPrice.toFixed(2)}
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      ${item.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

        {/* COMPACT PAYMENT & TOTALS FOOTER */}
        <div className="p-3 bg-slate-50 border-t border-slate-200/90 space-y-2 shrink-0">
          
          {/* Subtotal & Total Banner */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex justify-between items-center text-[11px] text-slate-500 font-bold">
              <span>Subtotal Venta:</span>
              <span>${cartSubtotal.toFixed(2)} MXN</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-100">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">TOTAL A COBRAR:</span>
              <span className="text-xl text-emerald-700 font-black">
                ${cartTotal.toFixed(2)} <span className="text-[10px] font-bold text-slate-500">MXN</span>
              </span>
            </div>
          </div>

          {/* Prominent COBRAR Button (Opens Modal) */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setIsCorteXOpen(true)}
              className="py-1.5 px-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold rounded-lg cursor-pointer"
            >
              Corte
            </button>
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(true)}
              className="py-1.5 px-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold rounded-lg cursor-pointer"
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setIsReprintModalOpen(true)}
              className="py-1.5 px-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold rounded-lg cursor-pointer"
            >
              Reimprimir
            </button>
          </div>

          {saleError && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
              {saleError}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || saleBusy || tillLocked}
            className="w-full py-3 bg-[#047857] hover:bg-[#066046] disabled:opacity-40 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            {saleBusy ? 'Guardando venta…' : tillLocked ? 'Caja cerrada 11:00 p.m.' : `Cobrar $${cartTotal.toFixed(2)}`}
          </button>

        </div>

      </div>

      </div>

      {/* MODALS */}
      <PaymentCheckoutModal
        isOpen={isPaymentCheckoutModalOpen}
        onClose={() => setIsPaymentCheckoutModalOpen(false)}
        totalAmount={cartTotal}
        itemCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onConfirmPayment={handleConfirmPaymentFromModal}
      />
      <RechargeModal
        isOpen={isRechargeModalOpen}
        onClose={() => setIsRechargeModalOpen(false)}
        product={selectedRechargeProduct}
        onConfirm={(prod, amt, meta) => addToCart(prod, amt, meta)}
      />

      <CreditDeviceModal
        isOpen={isCreditDeviceModalOpen}
        onClose={() => setIsCreditDeviceModalOpen(false)}
        product={selectedCreditProduct}
        products={products}
        currentBranch={currentBranch}
        onConfirm={(prod, amt, meta) => addToCart(prod, amt, meta)}
      />

      <CreditPaymentModal
        isOpen={isCreditPaymentModalOpen}
        onClose={() => setIsCreditPaymentModalOpen(false)}
        creditAccounts={creditAccounts}
        onConfirm={(prod, amt, meta) => addToCart(prod, amt, meta)}
      />

      <RepairPriceCatalogModal
        isOpen={isRepairPriceCatalogOpen}
        onClose={() => setIsRepairPriceCatalogOpen(false)}
        isAdmin={currentOperator.role === 'admin'}
        repairPrices={repairPrices}
        onAddRepairPrice={onAddRepairPrice}
        onUpdateRepairPrice={onUpdateRepairPrice}
        onDeleteRepairPrice={onDeleteRepairPrice}
        onAddToCart={(prod, amt, meta) => addToCart(prod, amt, meta)}
      />

      <RepairModal
        isOpen={isRepairModalOpen}
        onClose={() => setIsRepairModalOpen(false)}
        repairRecords={repairRecords}
        onAddRepairRecord={(record) => {
          if (onAddRepairRecord) onAddRepairRecord(record);
          else setLocalRepairRecords((prev) => [record, ...prev]);
        }}
        onUpdateRepairRecord={(record) => {
          if (onUpdateRepairRecord) onUpdateRepairRecord(record);
          else setLocalRepairRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)));
        }}
        onAddToCart={(prod, amt, meta) => addToCart(prod, amt, meta)}
        currentBranch={currentBranch}
        currentOperator={currentOperator}
        onEmitDirectTicket={async (ticket) => {
          await commitSale(ticket);
        }}
      />

      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onAddExpense={onAddExpense}
        currentBranch={currentBranch}
        currentOperator={currentOperator}
      />

      <CorteXModal
        isOpen={isCorteXOpen}
        onClose={() => setIsCorteXOpen(false)}
        tickets={salesTickets}
        expenses={expenses}
        currentBranch={currentBranch}
        currentOperator={currentOperator}
        cortesX={cortesX}
        initialCashFund={initialCashFund}
        activeSessionId={activeCashSession?.id}
        sessionOpenedAt={activeCashSession?.fecha_apertura}
        onFinalizeCorteX={onFinalizeCorteX}
        onLogout={onLogout}
      />


      <TicketReceiptModal
        isOpen={isTicketReceiptOpen}
        onClose={() => setIsTicketReceiptOpen(false)}
        ticket={completedTicket}
        currentBranch={currentBranch}
      />

      <ReprintTicketModal
        isOpen={isReprintModalOpen}
        onClose={() => setIsReprintModalOpen(false)}
        salesTickets={salesTickets}
        currentBranch={currentBranch}
        currentOperator={currentOperator}
      />

      <CaseModelModal
        isOpen={isCaseModelModalOpen}
        onClose={() => setIsCaseModelModalOpen(false)}
        product={selectedFundaProduct}
        onConfirm={handleConfirmCaseModel}
      />

    </div>
  );
}
