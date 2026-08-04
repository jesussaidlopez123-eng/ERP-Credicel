import React, { useState, useRef, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Product, CartItem, CartItemMetadata, SaleTicket, Expense, Branch, Operator, RepairRecord } from '../types';
import RechargeModal from './RechargeModal';
import CreditDeviceModal from './CreditDeviceModal';
import ExpenseModal from './ExpenseModal';
import CorteXModal from './CorteXModal';
import TicketReceiptModal from './TicketReceiptModal';
import RepairModal from './RepairModal';
import RepairPriceCatalogModal from './RepairPriceCatalogModal';
import PaymentCheckoutModal from './PaymentCheckoutModal';
import CreditPaymentModal from './CreditPaymentModal';
import { RepairPriceItem } from '../types';

interface PosModuleProps {
  products: Product[];
  currentBranch: Branch;
  currentOperator: Operator;
  salesTickets: SaleTicket[];
  expenses: Expense[];
  onCompleteSale: (ticket: SaleTicket) => void;
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
  setIsRepairPriceCatalogOpen = () => {}
}: PosModuleProps) {
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
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

  // Mandatory Equipment IMEI Selection State
  const [isSelectImeiModalOpen, setIsSelectImeiModalOpen] = useState(false);
  const [selectedEquipmentForSale, setSelectedEquipmentForSale] = useState<Product | null>(null);
  const [posImeiInput, setPosImeiInput] = useState('');
  const [posImeiError, setPosImeiError] = useState<string | null>(null);

  const [repairRecords, setRepairRecords] = useState<RepairRecord[]>([]);
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
  const [isPaymentCheckoutModalOpen, setIsPaymentCheckoutModalOpen] = useState(false);
  const [isCreditPaymentModalOpen, setIsCreditPaymentModalOpen] = useState(false);

  // Focus scanner input on load
  useEffect(() => {
    if (scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, []);

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

    // 1. Direct IMEI Lookup across all products
    let foundProductByImei: Product | null = null;
    let foundImeiString: string = '';
    let foundInBranchId: string = '';

    for (const p of products) {
      if (p.inventoryType === 'equipo' || p.category === 'equipo_credito') {
        // Check current branch IMEIs first
        const bImeis = p.branchImeiMap?.[currentBranch.id] || [];
        if (bImeis.some((im) => im.toUpperCase() === queryUpper)) {
          foundProductByImei = p;
          foundImeiString = queryUpper;
          foundInBranchId = currentBranch.id;
          break;
        }

        // Check other branches
        if (p.branchImeiMap) {
          for (const [bId, list] of Object.entries(p.branchImeiMap)) {
            if (list.some((im) => im.toUpperCase() === queryUpper)) {
              foundProductByImei = p;
              foundImeiString = queryUpper;
              foundInBranchId = bId;
            }
          }
        } else if (p.imeiList?.some((im) => im.toUpperCase() === queryUpper) || p.imei?.toUpperCase() === queryUpper) {
          foundProductByImei = p;
          foundImeiString = queryUpper;
          foundInBranchId = currentBranch.id;
        }
      }
    }

    if (foundProductByImei) {
      if (foundInBranchId !== currentBranch.id) {
        const branchName = foundInBranchId === 'b-bodega' ? 'Bodega' : foundInBranchId === 'b-navojoa' ? 'Navojoa' : 'Huatabampo';
        setScanFeedback({
          type: 'error',
          text: `❌ SUCURSAL INCORRECTA: El IMEI "${foundImeiString}" pertenece a ${branchName}. Realice el traspaso formal a ${currentBranch.name}.`
        });
      } else {
        playBeepSound();
        addToCart(foundProductByImei, foundProductByImei.price, {
          imei: foundImeiString,
          deviceModel: foundProductByImei.name
        });
        setScanFeedback({
          type: 'success',
          text: `¡IMEI Escaneado y Validado!: ${foundProductByImei.name} (IMEI: ${foundImeiString})`
        });
      }
      setScannerInput('');
      setTimeout(() => setScanFeedback(null), 4000);
      return;
    }

    // If string looks like a 10-15 digit IMEI but was not found:
    if (/^\d{10,15}$/.test(queryUpper)) {
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
        text: `¡Agregado por escáner!: ${matchedProduct.name} ($${matchedProduct.price.toFixed(2)})`
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

  // Products array (filtered by category and search query if active)
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.imei?.toLowerCase().includes(q) ||
      p.imeiList?.some(im => im.toLowerCase().includes(q)) ||
      (p.branchImeiMap && Object.values(p.branchImeiMap).some(arr => arr.some(im => im.toLowerCase().includes(q))));
    return matchesCategory && matchesSearch;
  });

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

    if (product.id === 'prod-equipo-credito-gen' || product.code === 'EQ-CRED') {
      setSelectedCreditProduct(product);
      setIsCreditDeviceModalOpen(true);
      return;
    }

    if (product.id === 'prod-reparacion-gen' || (product.category === 'servicio' && product.price === 0)) {
      setIsRepairModalOpen(true);
      return;
    }

    // If product is an Equipment item, enforce IMEI selection!
    if (product.inventoryType === 'equipo' || product.category === 'equipo_credito') {
      const branchImeis = product.branchImeiMap?.[currentBranch.id] || [];
      const availImeis = branchImeis.length > 0 ? branchImeis : (product.imeiList || (product.imei ? [product.imei] : []));

      if (availImeis.length === 0) {
        setScanFeedback({
          type: 'error',
          text: `❌ SIN STOCK DE IMEI: No hay IMEIs activos para ${product.name} en ${currentBranch.name}.`
        });
        setTimeout(() => setScanFeedback(null), 4000);
        return;
      }

      setSelectedEquipmentForSale(product);
      setPosImeiInput(availImeis[0] || '');
      setPosImeiError(null);
      setIsSelectImeiModalOpen(true);
      return;
    }

    // Standard products (Accessories, fixed price repairs, etc.)
    addToCart(product, product.price);
  };

  const addToCart = (product: Product, unitPrice: number, metadata?: CartItemMetadata) => {
    setCart((prevCart) => {
      // If it's a special product with unique metadata, add as separate line
      if (metadata) {
        const newItem: CartItem = {
          cartItemId: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product,
          quantity: 1,
          unitPrice,
          totalPrice: unitPrice,
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
        const newQty = item.quantity + 1;
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
        quantity: 1,
        unitPrice,
        totalPrice: unitPrice
      };
      return [...prevCart, newItem];
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              totalPrice: newQty * item.unitPrice
            };
          }
          return item;
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
  };

  // Cart Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartTotal = cartSubtotal;

  // Open Payment Modal
  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsPaymentCheckoutModalOpen(true);
  };

  // Complete sale after payment modal confirmation
  const handleConfirmPaymentFromModal = (
    method: 'Efectivo' | 'Tarjeta' | 'Transferencia',
    cashReceivedVal: number,
    changeVal: number
  ) => {
    const newTicket: SaleTicket = {
      id: `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      branchId: currentBranch.id,
      operatorName: currentOperator.name,
      items: [...cart],
      total: cartTotal,
      paymentMethod: method,
      cashReceived: method === 'Efectivo' ? cashReceivedVal : undefined,
      change: method === 'Efectivo' ? changeVal : undefined
    };

    onCompleteSale(newTicket);
    setCompletedTicket(newTicket);
    setIsTicketReceiptOpen(true);
    clearCart();
    setIsPaymentCheckoutModalOpen(false);
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 p-3 bg-slate-100/80 overflow-y-auto md:overflow-hidden">
      
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
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-black rounded-lg shadow-2xs transition-all cursor-pointer shrink-0"
            >
              <ScanLine className="w-3.5 h-3.5 text-indigo-200" />
              <span>Cobrar</span>
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
        </div>
        
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
            <ShoppingBag className="w-12 h-12 mb-3 text-slate-300 stroke-1" />
            <p className="text-sm font-bold text-slate-700">No hay productos registrados.</p>
            <p className="text-xs text-slate-400 mt-1">
              Puedes agregar más productos desde el módulo de <strong>Inventario</strong>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 gap-3.5">
            {filteredProducts.map((p) => {
              const isRecarga = p.category === 'recarga';
              const isEquipoCredito = p.category === 'equipo_credito';
              const isReparacion = p.id === 'prod-reparacion-gen' || (p.category === 'servicio' && p.price === 0);

              return (
                <button
                  key={p.id}
                  onClick={() => handleProductClick(p)}
                  className={`group relative flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all duration-150 shadow-2xs hover:shadow-md active:scale-[0.98] min-h-[125px] cursor-pointer ${
                    isRecarga 
                      ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'
                      : isEquipoCredito
                      ? 'bg-indigo-50/50 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
                      : isReparacion
                      ? 'bg-amber-50/50 border-amber-200 hover:border-amber-400 hover:bg-amber-50'
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
                        Crédito
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
                      {isRecarga || isEquipoCredito || isReparacion ? (
                        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {isReparacion ? 'Dejar / Entregar' : 'Ingresar Monto'}
                        </span>
                      ) : (
                        `$${p.price.toFixed(2)}`
                      )}
                    </span>

                    {!isRecarga && !isEquipoCredito && !isReparacion && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        p.stock < 5 ? 'bg-red-50 text-red-600 font-semibold' : 'text-slate-400'
                      }`}>
                        Stock: {p.stock}
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
        <div className="px-3 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-800 rounded-lg border border-slate-700">
              <ShoppingBag className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs tracking-tight">Ticket de Venta Actual</h3>
              <p className="text-[10px] text-slate-400">{cart.length} {cart.length === 1 ? 'producto' : 'productos'} en carrito</p>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[11px] text-red-400 hover:text-red-300 font-bold px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 transition-all cursor-pointer"
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
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            COBRAR (${cartTotal.toFixed(2)})
          </button>

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

      {/* Equipment Mandatory IMEI Selection Modal */}
      {isSelectImeiModalOpen && selectedEquipmentForSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm">Seleccionar IMEI Obligatorio</h3>
                  <p className="text-[11px] text-slate-300">{selectedEquipmentForSale.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSelectImeiModalOpen(false);
                  setSelectedEquipmentForSale(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedEquipmentForSale) return;

                const cleanImei = posImeiInput.trim().toUpperCase();
                if (!cleanImei || cleanImei.length < 10) {
                  setPosImeiError('Por favor ingresa o selecciona un IMEI válido (mínimo 10 o 15 dígitos).');
                  return;
                }

                const branchImeis = selectedEquipmentForSale.branchImeiMap?.[currentBranch.id] || selectedEquipmentForSale.imeiList || [];
                const isMatched = branchImeis.some(im => im.toUpperCase() === cleanImei);

                if (!isMatched) {
                  setPosImeiError(`❌ El IMEI "${cleanImei}" no pertenece al inventario activo de ${selectedEquipmentForSale.name} en ${currentBranch.name}.`);
                  return;
                }

                addToCart(selectedEquipmentForSale, selectedEquipmentForSale.price, {
                  imei: cleanImei,
                  deviceModel: selectedEquipmentForSale.name
                });

                setIsSelectImeiModalOpen(false);
                setSelectedEquipmentForSale(null);
                setPosImeiInput('');
                setPosImeiError(null);
              }}
              className="p-5 space-y-4"
            >
              {posImeiError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-900 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{posImeiError}</span>
                </div>
              )}

              <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-800 tracking-wider">Sucursal Actual:</span>
                  <p className="text-xs font-extrabold text-indigo-950">{currentBranch.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Precio Venta:</span>
                  <p className="text-sm font-black text-slate-900">${selectedEquipmentForSale.price.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Escanear o Ingresar IMEI (15 dígitos) *</span>
                  <span className="text-[10px] text-indigo-600 font-mono">Requerido</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={15}
                  placeholder="Ej. 354890123456701"
                  value={posImeiInput}
                  onChange={(e) => {
                    setPosImeiInput(e.target.value.toUpperCase());
                    setPosImeiError(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-black text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Available IMEIs Chips for Current Branch */}
              {(() => {
                const availImeis = selectedEquipmentForSale.branchImeiMap?.[currentBranch.id] || selectedEquipmentForSale.imeiList || [];
                if (availImeis.length === 0) return null;
                return (
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                      IMEIs Disponibles en esta Sucursal ({availImeis.length}):
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                      {availImeis.map((im) => (
                        <button
                          key={im}
                          type="button"
                          onClick={() => {
                            setPosImeiInput(im);
                            setPosImeiError(null);
                          }}
                          className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                            posImeiInput.toUpperCase() === im.toUpperCase()
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white hover:bg-indigo-50 text-slate-800 border-slate-300'
                          }`}
                        >
                          {im}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectImeiModalOpen(false);
                    setSelectedEquipmentForSale(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Agregar a Carrito
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      <CreditPaymentModal
        isOpen={isCreditPaymentModalOpen}
        onClose={() => setIsCreditPaymentModalOpen(false)}
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
        onAddRepairRecord={(record) => setRepairRecords((prev) => [record, ...prev])}
        onUpdateRepairRecord={(record) => setRepairRecords((prev) => prev.map((r) => r.id === record.id ? record : r))}
        onAddToCart={(prod, amt, meta) => addToCart(prod, amt, meta)}
        currentBranch={currentBranch}
        currentOperator={currentOperator}
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
      />

      <TicketReceiptModal
        isOpen={isTicketReceiptOpen}
        onClose={() => setIsTicketReceiptOpen(false)}
        ticket={completedTicket}
        currentBranch={currentBranch}
      />

    </div>
  );
}
