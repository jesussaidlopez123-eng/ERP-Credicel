import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  ArrowRightLeft, 
  Smartphone, 
  Headphones, 
  Building2, 
  X, 
  PlusCircle, 
  AlertTriangle, 
  SlidersHorizontal, 
  CheckCircle2, 
  DollarSign, 
  Info, 
  Lock, 
  ShieldCheck, 
  History,
  ShieldAlert,
  AlertCircle,
  Check,
  Ban,
  Fingerprint,
  Printer,
  Pencil,
  Tag
} from 'lucide-react';
import { Product, Branch, Operator, InventoryMovement } from '../types';
import { InventoryMovementsModal } from './InventoryMovementsModal';
import InventoryPrintModal from './InventoryPrintModal';
import EditProductModal from './EditProductModal';
import ProductLabelsModal from './ProductLabelsModal';

interface InventoryModuleProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  currentBranch?: Branch;
  currentOperator?: Operator;
  allBranches?: Branch[];
  inventoryMovements?: InventoryMovement[];
  onRecordMovement?: (movement: Omit<InventoryMovement, 'id' | 'timestamp'> | InventoryMovement) => void;
}

const OFFICIAL_BRANCHES = [
  { id: 'b-bodega', name: 'Bodega' },
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' }
];

export default function InventoryModule({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  currentBranch,
  currentOperator,
  allBranches = OFFICIAL_BRANCHES,
  inventoryMovements = [],
  onRecordMovement
}: InventoryModuleProps) {
  // 1. Tab Principal: Accesorios vs Equipos
  const [activeInventoryTab, setActiveInventoryTab] = useState<'accesorio' | 'equipo'>('accesorio');

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Impresión de Etiquetas y Códigos de Barras
  const [isLabelsModalOpen, setIsLabelsModalOpen] = useState(false);
  const [labelSelectedProduct, setLabelSelectedProduct] = useState<Product | null>(null);

  // Modal Impresión y Auditoría de Inventario
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Modal 0: Historial de Movimientos de los últimos 15 días
  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false);

  // Modals state
  // Modal 1: Ingresar (Agregar Stock / Nuevo Producto / Nuevo Equipo)
  const [isIngresarModalOpen, setIsIngresarModalOpen] = useState(false);
  const [ingresarMode, setIngresarMode] = useState<'existente' | 'nuevo'>('existente');
  const [ingresarSelectedProdId, setIngresarSelectedProdId] = useState<string>('');
  const [ingresarBranchId, setIngresarBranchId] = useState<string>('b-bodega');
  const [ingresarQuantity, setIngresarQuantity] = useState<string>('1');
  // Form fields for new product / equipo
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newSupplier, setNewSupplier] = useState('');

  // Modal Info Producto Detallado
  const [infoProduct, setInfoProduct] = useState<Product | null>(null);

  // Modal Editar / Modificar Registro de Producto o Teléfono
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Modal 5: Capturar IMEIs al registrar equipos
  const [isImeiCaptureModalOpen, setIsImeiCaptureModalOpen] = useState(false);
  const [imeiInputs, setImeiInputs] = useState<string[]>([]);
  const [pendingEquipmentData, setPendingEquipmentData] = useState<{
    isExisting: boolean;
    selectedProdId?: string;
    code?: string;
    name?: string;
    costPrice?: number;
    price?: number;
    supplier?: string;
    branchId: string;
    qty: number;
  } | null>(null);

  // Modal 6: Ver Lista Completa de IMEIs de un Producto
  const [viewingImeisProduct, setViewingImeisProduct] = useState<Product | null>(null);
  const [imeiSearchQuery, setImeiSearchQuery] = useState('');
  const [copiedImei, setCopiedImei] = useState<string | null>(null);

  // Modal 2: Transferir
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSelectedProdId, setTransferSelectedProdId] = useState<string>('');
  const [fromBranchId, setFromBranchId] = useState<string>('b-bodega');
  const [toBranchId, setToBranchId] = useState<string>('b-navojoa');
  const [transferQuantity, setTransferQuantity] = useState<string>('1');

  // Modal 2B: Selección de IMEIs para Traspaso
  const [isTransferImeiModalOpen, setIsTransferImeiModalOpen] = useState(false);
  const [selectedTransferImeis, setSelectedTransferImeis] = useState<string[]>([]);
  const [transferImeiScanInput, setTransferImeiScanInput] = useState('');
  const [pendingTransferData, setPendingTransferData] = useState<{
    product: Product;
    fromBranchId: string;
    toBranchId: string;
    qty: number;
  } | null>(null);

  // Modal 3: Ajustar (Mermas / Corrección)
  const [isAjustarModalOpen, setIsAjustarModalOpen] = useState(false);
  const [ajustarSelectedProdId, setAjustarSelectedProdId] = useState<string>('');
  const [ajustarBranchId, setAjustarBranchId] = useState<string>('b-bodega');
  const [ajustarAction, setAjustarAction] = useState<'merma' | 'incremento'>('merma'); // merma = descontar, incremento = agregar
  const [ajustarQuantity, setAjustarQuantity] = useState<string>('1');
  const [ajustarReason, setAjustarReason] = useState<string>('Merma por producto dañado/defectuoso');

  // Modal 3B: Selección de IMEIs a dar de baja por Ajuste/Merma
  const [isAjustarImeiModalOpen, setIsAjustarImeiModalOpen] = useState(false);
  const [selectedAjustarImeis, setSelectedAjustarImeis] = useState<string[]>([]);
  const [ajustarImeiScanInput, setAjustarImeiScanInput] = useState('');
  const [pendingAjustarData, setPendingAjustarData] = useState<{
    product: Product;
    branchId: string;
    action: 'merma' | 'incremento';
    qty: number;
    reason: string;
  } | null>(null);

  // Modal 4: Cambiar Precios ($)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceSelectedProdId, setPriceSelectedProdId] = useState<string>('');
  const [editCostPrice, setEditCostPrice] = useState<string>('');
  const [editSalePrice, setEditSalePrice] = useState<string>('');

  // Modal de Confirmación de Seguridad (Contraseña para Traspasos y Ajustes)
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [pendingSecurityCallback, setPendingSecurityCallback] = useState<{
    type: 'traspaso' | 'ajuste';
    title: string;
    description: string;
    execute: () => void;
  } | null>(null);

  const promptSecurityAuth = (
    type: 'traspaso' | 'ajuste',
    title: string,
    description: string,
    execute: () => void
  ) => {
    setPendingSecurityCallback({ type, title, description, execute });
    setSecurityPassword('');
    setSecurityError('');
    setIsSecurityModalOpen(true);
  };

  const handleConfirmSecurityAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityPassword.trim()) {
      setSecurityError('Por favor ingresa la contraseña para autorizar la operación.');
      return;
    }
    // Ejecutar acción pendiente tras validación de seguridad
    if (pendingSecurityCallback) {
      pendingSecurityCallback.execute();
    }
    setIsSecurityModalOpen(false);
    setPendingSecurityCallback(null);
    setSecurityPassword('');
    setSecurityError('');
  };

  // Helper stock per branch
  const getBranchStock = (p: Product, branchId: string): number => {
    if (p.branchStock && p.branchStock[branchId] !== undefined) {
      return p.branchStock[branchId];
    }
    if (branchId === 'b-bodega') return Math.ceil(p.stock * 0.5);
    if (branchId === 'b-navojoa') return Math.floor(p.stock * 0.3);
    if (branchId === 'b-huatabampo') return Math.floor(p.stock * 0.2);
    return 0;
  };

  const getTotalStock = (p: Product): number => {
    if (p.branchStock) {
      return (p.branchStock['b-bodega'] || 0) + (p.branchStock['b-navojoa'] || 0) + (p.branchStock['b-huatabampo'] || 0);
    }
    return p.stock || 0;
  };

  // Natural sorting function (numeric alphanumeric ordering matching Module 1 / POS)
  const naturalProductSort = (a: Product, b: Product): number => {
    // Primary sort by product code naturally (e.g. CA-01, CA-02, CA-10, CE-01, FUN-01, etc.)
    const codeA = (a.code || '').trim();
    const codeB = (b.code || '').trim();

    const codeComparison = codeA.localeCompare(codeB, 'es', { numeric: true, sensitivity: 'base' });
    if (codeComparison !== 0) {
      return codeComparison;
    }

    // Secondary natural sort by name
    return (a.name || '').localeCompare(b.name || '', 'es', { numeric: true, sensitivity: 'base' });
  };

  // Products filtered ONLY by current active tab (Equipos vs Accesorios) for action modals
  const tabProducts = useMemo(() => {
    const list = products.filter((p) => {
      const pType = p.inventoryType || (p.category === 'equipo_credito' ? 'equipo' : 'accesorio');
      return pType === activeInventoryTab;
    });
    return list.sort(naturalProductSort);
  }, [products, activeInventoryTab]);

  // Filter products by Accesorios vs Equipos AND Search Query (including full IMEI matching)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = products.filter((p) => {
      const pType = p.inventoryType || (p.category === 'equipo_credito' ? 'equipo' : 'accesorio');

      if (!q) {
        return pType === activeInventoryTab;
      }

      const matchesName = p.name.toLowerCase().includes(q);
      const matchesCode = p.code.toLowerCase().includes(q);
      const matchesImeiDirect = p.imei?.toLowerCase().includes(q) || false;
      const matchesImeiList = p.imeiList?.some((im) => im.toLowerCase().includes(q)) || false;
      const matchesBranchImeiMap = p.branchImeiMap
        ? Object.values(p.branchImeiMap).some((arr) => arr.some((im) => im.toLowerCase().includes(q)))
        : false;

      const isImeiMatch = matchesImeiDirect || matchesImeiList || matchesBranchImeiMap;
      const matchesSearch = matchesName || matchesCode || isImeiMatch;

      // If query matches an IMEI, return true so the user can see the equipment regardless of current tab
      if (isImeiMatch) return true;

      return matchesSearch && pType === activeInventoryTab;
    });

    return list.sort(naturalProductSort);
  }, [products, searchQuery, activeInventoryTab]);

  // --- SISTEMA ANTI-DUPLICADOS (CÓDIGOS E IMEIS ESTRICTAMENTE ÚNICOS) ---

  // 1. Verificación de Código de Producto Único
  const checkDuplicateCode = (codeToTest: string, excludeProductId?: string) => {
    const clean = codeToTest.trim().toUpperCase();
    if (!clean) return { isDuplicate: false, conflictingProduct: undefined };

    const conflict = products.find(
      (p) => p.code.trim().toUpperCase() === clean && (!excludeProductId || p.id !== excludeProductId)
    );

    if (conflict) {
      return {
        isDuplicate: true,
        conflictingProduct: conflict
      };
    }
    return { isDuplicate: false, conflictingProduct: undefined };
  };

  // 2. Validación estricta de formato y longitud de IMEI (Exactamente 15 dígitos numéricos)
  const validateImeiDigits = (imeiStr: string) => {
    const clean = (imeiStr || '').trim();
    if (!clean) {
      return {
        isValid: false,
        length: 0,
        isNumeric: false,
        errorType: 'empty' as const,
        message: 'Campo pendiente. Ingrese o escanee el IMEI.'
      };
    }

    const isNumeric = /^\d+$/.test(clean);
    const length = clean.length;

    if (!isNumeric) {
      return {
        isValid: false,
        length,
        isNumeric: false,
        errorType: 'non_numeric' as const,
        message: `El IMEI "${clean}" contiene caracteres no válidos. Solo debe contener números (0-9).`
      };
    }

    if (length < 15) {
      return {
        isValid: false,
        length,
        isNumeric: true,
        errorType: 'short' as const,
        message: `Longitud menor a 15 dígitos (${length}/15). Faltan ${15 - length} dígitos (debe tener exactamente 15 dígitos).`
      };
    }

    if (length > 15) {
      return {
        isValid: false,
        length,
        isNumeric: true,
        errorType: 'long' as const,
        message: `Longitud mayor a 15 dígitos (${length}/15). Sobran ${length - 15} dígitos (debe tener exactamente 15 dígitos).`
      };
    }

    return {
      isValid: true,
      length: 15,
      isNumeric: true,
      errorType: null,
      message: 'IMEI válido (15 dígitos numéricos)'
    };
  };

  // 3. Verificación de IMEI Único (tanto en el lote actual como en todo el inventario de todas las sucursales)
  const checkDuplicateImei = (
    imeiToTest: string,
    batch: string[],
    currentIndex: number
  ) => {
    const clean = imeiToTest.trim().toUpperCase();
    if (!clean) {
      return {
        isDuplicate: false,
        isDuplicateInBatch: false,
        batchDuplicateIndex: -1,
        isDuplicateInSystem: false,
        conflictingProduct: undefined,
        conflictingBranchId: undefined,
        conflictingBranchName: undefined
      };
    }

    // A) Revisar si está repetido dentro del mismo lote que se está capturando
    const batchDuplicateIndex = batch.findIndex(
      (otherImei, idx) => idx !== currentIndex && otherImei.trim().toUpperCase() === clean
    );
    const isDuplicateInBatch = batchDuplicateIndex !== -1;

    // B) Revisar si ya existe en la base de datos de productos
    let conflictingProduct: Product | undefined;
    let conflictingBranchId: string | undefined;

    for (const p of products) {
      // 1. Revisar en branchImeiMap (para saber la sucursal exacta)
      if (p.branchImeiMap) {
        for (const [bId, imeis] of Object.entries(p.branchImeiMap)) {
          if (Array.isArray(imeis) && imeis.some((im) => im.trim().toUpperCase() === clean)) {
            conflictingProduct = p;
            conflictingBranchId = bId;
            break;
          }
        }
      }
      if (conflictingProduct) break;

      // 2. Revisar en imeiList o imei individual
      const pImeis = p.imeiList || (p.imei ? [p.imei] : []);
      if (pImeis.some((im) => im.trim().toUpperCase() === clean)) {
        conflictingProduct = p;
        break;
      }
    }

    const isDuplicateInSystem = !!conflictingProduct;
    const branchName = conflictingBranchId 
      ? (OFFICIAL_BRANCHES.find(b => b.id === conflictingBranchId)?.name || conflictingBranchId)
      : undefined;

    return {
      isDuplicate: isDuplicateInBatch || isDuplicateInSystem,
      isDuplicateInBatch,
      batchDuplicateIndex,
      isDuplicateInSystem,
      conflictingProduct,
      conflictingBranchId,
      conflictingBranchName: branchName
    };
  };

  // --- HANDLER: INGRESAR (MODELO, CANTIDAD Y SUCURSAL) ---
  const handleOpenIngresar = () => {
    setIngresarMode('existente');
    const firstProd = tabProducts[0];
    setIngresarSelectedProdId(firstProd ? firstProd.id : '');
    setIngresarBranchId(currentBranch?.id || 'b-bodega');
    setIngresarQuantity('1');
    setNewCode('');
    setNewName('');
    setNewCostPrice('');
    setNewPrice('');
    setNewSupplier('');
    setIsIngresarModalOpen(true);
  };

  const handleConfirmIngresar = (e: React.FormEvent) => {
    e.preventDefault();

    const qty = parseInt(ingresarQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Ingresa una cantidad válida mayor a 0.');
      return;
    }

    if (activeInventoryTab === 'equipo') {
      // --- EQUIPOS FLOW ---
      if (ingresarMode === 'existente') {
        const selectedProd = products.find((p) => p.id === ingresarSelectedProdId);
        if (!selectedProd) {
          alert('Selecciona un modelo de equipo.');
          return;
        }

        setPendingEquipmentData({
          isExisting: true,
          selectedProdId: selectedProd.id,
          code: selectedProd.code,
          name: selectedProd.name,
          costPrice: selectedProd.costPrice,
          price: selectedProd.price,
          supplier: selectedProd.supplier,
          branchId: ingresarBranchId,
          qty: qty
        });

        setImeiInputs(Array(qty).fill(''));
        setIsIngresarModalOpen(false);
        setIsImeiCaptureModalOpen(true);
        return;
      } else {
        // Nuevo Modelo de Equipo Celular
        if (!newName.trim()) {
          alert('Ingresa el Modelo del equipo celular.');
          return;
        }

        const numCost = parseFloat(newCostPrice) || 0;
        const numPrice = parseFloat(newPrice) || 0;

        let generatedCode = newCode.trim() ? newCode.trim().toUpperCase() : '';

        // Validación estricta anti-duplicados de código para equipos
        if (generatedCode) {
          const codeDup = checkDuplicateCode(generatedCode);
          if (codeDup.isDuplicate && codeDup.conflictingProduct) {
            alert(
              `❌ CÓDIGO DE EQUIPO DUPLICADO:\n\nEl código "${generatedCode}" ya está registrado en el producto "${codeDup.conflictingProduct.name}" (ID: ${codeDup.conflictingProduct.id}).\n\nNo se permite duplicar códigos de productos. Por favor ingrese un código único o déjelo vacío para auto-generarlo.`
            );
            return;
          }
        } else {
          // Generación automática garantizando 0 colisiones
          const baseClean = newName.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'EQ');
          let randomSuffix = Math.floor(100 + Math.random() * 900);
          generatedCode = `EQ-${baseClean}-${randomSuffix}`;
          while (checkDuplicateCode(generatedCode).isDuplicate) {
            randomSuffix = Math.floor(1000 + Math.random() * 9000);
            generatedCode = `EQ-${baseClean}-${randomSuffix}`;
          }
        }

        setPendingEquipmentData({
          isExisting: false,
          code: generatedCode,
          name: newName.trim(),
          costPrice: numCost,
          price: numPrice,
          supplier: newSupplier.trim(),
          branchId: ingresarBranchId,
          qty: qty
        });

        setImeiInputs(Array(qty).fill(''));
        setIsIngresarModalOpen(false);
        setIsImeiCaptureModalOpen(true);
        return;
      }
    } else {
      // --- ACCESORIOS FLOW ---
      if (ingresarMode === 'existente') {
        const prod = products.find(p => p.id === ingresarSelectedProdId);
        if (!prod) {
          alert('Selecciona un accesorio válido.');
          return;
        }

        const currentBStock = prod.branchStock || {
          'b-bodega': getBranchStock(prod, 'b-bodega'),
          'b-navojoa': getBranchStock(prod, 'b-navojoa'),
          'b-huatabampo': getBranchStock(prod, 'b-huatabampo'),
        };

        const newBranchStock = {
          ...currentBStock,
          [ingresarBranchId]: (currentBStock[ingresarBranchId] || 0) + qty
        };

        const newTotalStock = (newBranchStock['b-bodega'] || 0) + (newBranchStock['b-navojoa'] || 0) + (newBranchStock['b-huatabampo'] || 0);

        const updated: Product = {
          ...prod,
          branchStock: newBranchStock,
          stock: newTotalStock
        };

        const branchName = OFFICIAL_BRANCHES.find(b => b.id === ingresarBranchId)?.name || ingresarBranchId;
        onRecordMovement?.({
          type: 'ingreso',
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          category: prod.category,
          inventoryType: 'accesorio',
          quantity: qty,
          targetBranchId: ingresarBranchId,
          targetBranchName: branchName,
          operatorName: currentOperator?.name || 'Admin',
          operatorId: currentOperator?.id,
          details: `Ingreso de stock (+${qty} pza(s)) en ${branchName}`
        });

        onUpdateProduct(updated);
        setIsIngresarModalOpen(false);
      } else {
        // Crear nuevo accesorio e ingresar
        if (!newCode.trim()) {
          alert('Ingresa un Código para el nuevo accesorio.');
          return;
        }
        if (!newName.trim()) {
          alert('Ingresa un Nombre para el nuevo accesorio.');
          return;
        }

        const cleanCode = newCode.trim().toUpperCase();

        // Validación estricta anti-duplicados de código para accesorios
        const codeDup = checkDuplicateCode(cleanCode);
        if (codeDup.isDuplicate && codeDup.conflictingProduct) {
          alert(
            `❌ CÓDIGO DE PRODUCTO DUPLICADO:\n\nEl código "${cleanCode}" ya pertenece al producto existente:\n• "${codeDup.conflictingProduct.name}" (Categoría: ${codeDup.conflictingProduct.category})\n\nNo se permite duplicar códigos ni códigos de barra. Por favor asigne un código único.`
          );
          return;
        }

        const numCost = parseFloat(newCostPrice) || 0;
        const numPrice = parseFloat(newPrice) || 0;

        const newBranchStock = {
          'b-bodega': ingresarBranchId === 'b-bodega' ? qty : 0,
          'b-navojoa': ingresarBranchId === 'b-navojoa' ? qty : 0,
          'b-huatabampo': ingresarBranchId === 'b-huatabampo' ? qty : 0,
        };

        const newProd: Product = {
          id: `prod-${Date.now()}`,
          code: cleanCode,
          name: newName.trim(),
          category: 'accesorio',
          inventoryType: 'accesorio',
          supplier: newSupplier.trim(),
          costPrice: numCost,
          price: numPrice,
          stock: qty,
          branchStock: newBranchStock,
          color: 'bg-slate-800 text-white'
        };

        const branchName = OFFICIAL_BRANCHES.find(b => b.id === ingresarBranchId)?.name || ingresarBranchId;
        onRecordMovement?.({
          type: 'creacion',
          productId: newProd.id,
          productCode: newProd.code,
          productName: newProd.name,
          category: 'accesorio',
          inventoryType: 'accesorio',
          quantity: qty,
          targetBranchId: ingresarBranchId,
          targetBranchName: branchName,
          operatorName: currentOperator?.name || 'Admin',
          operatorId: currentOperator?.id,
          unitPrice: numPrice,
          costPrice: numCost,
          details: `Alta de nuevo accesorio e ingreso inicial de ${qty} pza(s) en ${branchName}`
        });

        onAddProduct(newProd);
        setIsIngresarModalOpen(false);
      }
    }
  };

  // --- HANDLER: CONFIRMAR Y GUARDAR IMEIS CAPTURADOS ---
  const handleSaveCapturedImeis = (e: React.FormEvent) => {
    e.preventDefault();

    if (!pendingEquipmentData) return;

    const finalImeis = imeiInputs.map((s) => s.trim().toUpperCase()).filter(Boolean);

    const { isExisting, selectedProdId, branchId, qty, name, code, costPrice, price, supplier } = pendingEquipmentData;

    // 1. Strict quantity validation
    if (finalImeis.length !== qty) {
      alert(`❌ REGISTRO BLOQUEADO: Debes ingresar exactamente ${qty} número(s) de IMEI válidos para este registro (tienes ${finalImeis.length} completados). No se permiten equipos sin IMEI.`);
      return;
    }

    // 2. Validate format/length (Exact 15 digits numeric)
    for (const im of finalImeis) {
      const digitValidation = validateImeiDigits(im);
      if (!digitValidation.isValid) {
        alert(`❌ ERROR DE IMEI: ${digitValidation.message}`);
        return;
      }
    }

    // 3. Check internal duplicates in batch
    const uniqueSet = new Set(finalImeis);
    if (uniqueSet.size < finalImeis.length) {
      const duplicatesInBatch: string[] = [];
      finalImeis.forEach((im, idx) => {
        if (finalImeis.indexOf(im) !== idx && !duplicatesInBatch.includes(im)) {
          duplicatesInBatch.push(im);
        }
      });
      alert(`❌ DUPLICADO EN LOTE DETECTADO:\n\nHas ingresado los siguientes IMEIs repetidos en esta captura:\n• ${duplicatesInBatch.join(', ')}\n\nCada celular debe tener un IMEI 100% único.`);
      return;
    }

    // 4. Check external duplicates across entire system
    for (const im of finalImeis) {
      const dupCheck = checkDuplicateImei(im, finalImeis, -1);
      if (dupCheck.isDuplicateInSystem && dupCheck.conflictingProduct) {
        alert(
          `❌ IMEI YA EXISTE EN EL SISTEMA:\n\nEl IMEI "${im}" ya está registrado en el inventario activo:\n• Producto: "${dupCheck.conflictingProduct.name}"\n• Ubicación: ${dupCheck.conflictingBranchName || 'Sistema'}\n\nLos IMEIs son identificadores mundiales únicos y no pueden duplicarse bajo ninguna circunstancia.`
        );
        return;
      }
    }

    if (isExisting && selectedProdId) {
      const prod = products.find((p) => p.id === selectedProdId);
      if (!prod) return;

      const existingImeis = prod.imeiList && prod.imeiList.length > 0
        ? prod.imeiList
        : (prod.imei ? [prod.imei] : []);

      const updatedImeis = [...existingImeis, ...finalImeis];

      const currentBranchImeis = prod.branchImeiMap?.[branchId] || [];
      const updatedBranchImeis = [...currentBranchImeis, ...finalImeis];
      const updatedBranchImeiMap = {
        ...(prod.branchImeiMap || {}),
        [branchId]: updatedBranchImeis
      };

      const currentBStock = prod.branchStock || {
        'b-bodega': getBranchStock(prod, 'b-bodega'),
        'b-navojoa': getBranchStock(prod, 'b-navojoa'),
        'b-huatabampo': getBranchStock(prod, 'b-huatabampo'),
      };

      const newBranchStock = {
        ...currentBStock,
        [branchId]: (currentBStock[branchId] || 0) + qty
      };

      const newTotalStock = (newBranchStock['b-bodega'] || 0) + (newBranchStock['b-navojoa'] || 0) + (newBranchStock['b-huatabampo'] || 0);

      const updated: Product = {
        ...prod,
        imeiList: updatedImeis,
        branchImeiMap: updatedBranchImeiMap,
        imei: updatedImeis[0] || prod.imei || '',
        branchStock: newBranchStock,
        stock: newTotalStock
      };

      const branchName = OFFICIAL_BRANCHES.find(b => b.id === branchId)?.name || branchId;
      onRecordMovement?.({
        type: 'ingreso',
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        category: prod.category,
        inventoryType: 'equipo',
        quantity: qty,
        targetBranchId: branchId,
        targetBranchName: branchName,
        operatorName: currentOperator?.name || 'Admin',
        operatorId: currentOperator?.id,
        imeis: finalImeis,
        details: `Ingreso de ${qty} equipo(s) con captura de IMEIs en ${branchName}`
      });

      onUpdateProduct(updated);
    } else {
      // New equipment model
      const newBranchStock = {
        'b-bodega': branchId === 'b-bodega' ? qty : 0,
        'b-navojoa': branchId === 'b-navojoa' ? qty : 0,
        'b-huatabampo': branchId === 'b-huatabampo' ? qty : 0,
      };

      const newBranchImeiMap = {
        'b-bodega': branchId === 'b-bodega' ? finalImeis : [],
        'b-navojoa': branchId === 'b-navojoa' ? finalImeis : [],
        'b-huatabampo': branchId === 'b-huatabampo' ? finalImeis : [],
      };

      const newProd: Product = {
        id: `prod-${Date.now()}`,
        code: code || `EQ-${Date.now()}`,
        name: name || 'Equipo Celular',
        category: 'equipo_credito',
        inventoryType: 'equipo',
        imei: finalImeis[0] || '',
        imeiList: finalImeis,
        branchImeiMap: newBranchImeiMap,
        supplier: supplier || '',
        costPrice: costPrice || 0,
        price: price || 0,
        stock: qty,
        branchStock: newBranchStock,
        color: 'bg-blue-800 text-white'
      };

      const branchName = OFFICIAL_BRANCHES.find(b => b.id === branchId)?.name || branchId;
      onRecordMovement?.({
        type: 'creacion',
        productId: newProd.id,
        productCode: newProd.code,
        productName: newProd.name,
        category: 'equipo_credito',
        inventoryType: 'equipo',
        quantity: qty,
        targetBranchId: branchId,
        targetBranchName: branchName,
        operatorName: currentOperator?.name || 'Admin',
        operatorId: currentOperator?.id,
        unitPrice: price || 0,
        costPrice: costPrice || 0,
        imeis: finalImeis,
        details: `Alta de nuevo equipo celular e ingreso de ${qty} pza(s) con IMEIs en ${branchName}`
      });

      onAddProduct(newProd);
    }

    setIsImeiCaptureModalOpen(false);
    setPendingEquipmentData(null);
    setImeiInputs([]);
  };

  // --- HANDLER: TRANSFERIR (SUC ORIGEN, SUC DESTINO, MODELO Y CANTIDAD) ---
  const handleOpenTransfer = () => {
    const firstProd = tabProducts[0];
    setTransferSelectedProdId(firstProd ? firstProd.id : '');
    setFromBranchId('b-bodega');
    setToBranchId('b-navojoa');
    setTransferQuantity('1');
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === transferSelectedProdId);
    if (!prod) {
      alert('Selecciona un modelo a transferir.');
      return;
    }

    if (fromBranchId === toBranchId) {
      alert('La sucursal origen y la sucursal destino deben ser diferentes.');
      return;
    }

    const qty = parseInt(transferQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Ingresa una cantidad válida mayor a 0.');
      return;
    }

    const currentBStock = prod.branchStock || {
      'b-bodega': getBranchStock(prod, 'b-bodega'),
      'b-navojoa': getBranchStock(prod, 'b-navojoa'),
      'b-huatabampo': getBranchStock(prod, 'b-huatabampo'),
    };

    const originAvailable = currentBStock[fromBranchId] || 0;
    if (qty > originAvailable) {
      const originName = OFFICIAL_BRANCHES.find(b => b.id === fromBranchId)?.name;
      alert(`No hay suficiente inventario en ${originName}. Disponibles: ${originAvailable}`);
      return;
    }

    // Si es un equipo celular, abrir el modal de selección de IMEIs para el traspaso
    const isEquipment = prod.inventoryType === 'equipo' || prod.category === 'equipo_credito';
    if (isEquipment) {
      const availImeis = prod.imeiList && prod.imeiList.length > 0
        ? prod.imeiList
        : (prod.imei ? [prod.imei] : []);

      setPendingTransferData({
        product: prod,
        fromBranchId,
        toBranchId,
        qty
      });
      setSelectedTransferImeis(availImeis.slice(0, qty));
      setTransferImeiScanInput('');
      setIsTransferModalOpen(false);
      setIsTransferImeiModalOpen(true);
      return;
    }

    const newBranchStock = {
      ...currentBStock,
      [fromBranchId]: originAvailable - qty,
      [toBranchId]: (currentBStock[toBranchId] || 0) + qty
    };

    const newTotalStock = (newBranchStock['b-bodega'] || 0) + (newBranchStock['b-navojoa'] || 0) + (newBranchStock['b-huatabampo'] || 0);

    const updated: Product = {
      ...prod,
      branchStock: newBranchStock,
      stock: newTotalStock
    };

    const fromName = OFFICIAL_BRANCHES.find(b => b.id === fromBranchId)?.name || fromBranchId;
    const toName = OFFICIAL_BRANCHES.find(b => b.id === toBranchId)?.name || toBranchId;

    promptSecurityAuth(
      'traspaso',
      `Traspaso: ${prod.name}`,
      `De ${fromName} ➔ ${toName} (${qty} pza(s))`,
      () => {
        onRecordMovement?.({
          type: 'traspaso',
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          category: prod.category,
          inventoryType: prod.inventoryType || 'accesorio',
          quantity: qty,
          sourceBranchId: fromBranchId,
          sourceBranchName: fromName,
          targetBranchId: toBranchId,
          targetBranchName: toName,
          operatorName: currentOperator?.name || 'Admin',
          operatorId: currentOperator?.id,
          details: `Traspaso de ${qty} pza(s) de ${fromName} ➔ ${toName}`
        });

        onUpdateProduct(updated);
        setIsTransferModalOpen(false);
      }
    );
  };

  // --- HANDLER: GUARDAR TRASPASO CON IMEIS SELECCIONADOS ---
  const handleSaveTransferWithImeis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTransferData) return;

    const { product, fromBranchId, toBranchId, qty } = pendingTransferData;

    if (selectedTransferImeis.length < qty) {
      alert(`Debes seleccionar o escanear exactamente ${qty} IMEI(s) para confirmar el traspaso.`);
      return;
    }

    const currentBStock = product.branchStock || {
      'b-bodega': getBranchStock(product, 'b-bodega'),
      'b-navojoa': getBranchStock(product, 'b-navojoa'),
      'b-huatabampo': getBranchStock(product, 'b-huatabampo'),
    };

    const originAvailable = currentBStock[fromBranchId] || 0;
    const newBranchStock = {
      ...currentBStock,
      [fromBranchId]: Math.max(0, originAvailable - qty),
      [toBranchId]: (currentBStock[toBranchId] || 0) + qty
    };

    const newTotalStock = (newBranchStock['b-bodega'] || 0) + (newBranchStock['b-navojoa'] || 0) + (newBranchStock['b-huatabampo'] || 0);

    const currentFromImeis = product.branchImeiMap?.[fromBranchId] || product.imeiList || [];
    const currentToImeis = product.branchImeiMap?.[toBranchId] || [];

    const newFromImeis = currentFromImeis.filter((im) => !selectedTransferImeis.some(s => s.toUpperCase() === im.toUpperCase()));
    const newToImeis = [...currentToImeis, ...selectedTransferImeis];

    const updatedImeiMap = {
      ...(product.branchImeiMap || {}),
      [fromBranchId]: newFromImeis,
      [toBranchId]: newToImeis
    };

    const updated: Product = {
      ...product,
      branchStock: newBranchStock,
      branchImeiMap: updatedImeiMap,
      stock: newTotalStock
    };

    const fromName = OFFICIAL_BRANCHES.find(b => b.id === fromBranchId)?.name || fromBranchId;
    const toName = OFFICIAL_BRANCHES.find(b => b.id === toBranchId)?.name || toBranchId;

    promptSecurityAuth(
      'traspaso',
      `Traspaso de Equipos con IMEI: ${product.name}`,
      `De ${fromName} ➔ ${toName} (${qty} IMEI(s))`,
      () => {
        onRecordMovement?.({
          type: 'traspaso',
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          category: product.category,
          inventoryType: 'equipo',
          quantity: qty,
          sourceBranchId: fromBranchId,
          sourceBranchName: fromName,
          targetBranchId: toBranchId,
          targetBranchName: toName,
          operatorName: currentOperator?.name || 'Admin',
          operatorId: currentOperator?.id,
          imeis: selectedTransferImeis,
          details: `Traspaso de ${qty} equipo(s) con IMEI de ${fromName} ➔ ${toName}`
        });

        onUpdateProduct(updated);
        setIsTransferImeiModalOpen(false);
        setPendingTransferData(null);
        setSelectedTransferImeis([]);
      }
    );
  };

  // --- HANDLER: AJUSTAR / MERMAS (MODELO, CANTIDAD, UBICACIÓN/SUCURSAL Y MOTIVO) ---
  const handleOpenAjustar = () => {
    const firstProd = tabProducts[0];
    setAjustarSelectedProdId(firstProd ? firstProd.id : '');
    setAjustarBranchId('b-bodega');
    setAjustarAction('merma');
    setAjustarQuantity('1');
    setAjustarReason('Merma por producto dañado / defectuoso');
    setIsAjustarModalOpen(true);
  };

  const handleConfirmAjustar = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === ajustarSelectedProdId);
    if (!prod) {
      alert('Selecciona un modelo.');
      return;
    }

    const qty = parseInt(ajustarQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Ingresa una cantidad válida a ajustar.');
      return;
    }

    const currentBStock = prod.branchStock || {
      'b-bodega': getBranchStock(prod, 'b-bodega'),
      'b-navojoa': getBranchStock(prod, 'b-navojoa'),
      'b-huatabampo': getBranchStock(prod, 'b-huatabampo'),
    };

    const currentQtyInBranch = currentBStock[ajustarBranchId] || 0;

    const isEquipment = prod.inventoryType === 'equipo' || prod.category === 'equipo_credito';

    if (isEquipment) {
      if (ajustarAction === 'merma') {
        if (qty > currentQtyInBranch) {
          const branchName = OFFICIAL_BRANCHES.find(b => b.id === ajustarBranchId)?.name;
          alert(`No puedes restar más de las ${currentQtyInBranch} piezas disponibles en ${branchName}.`);
          return;
        }

        const availImeis = prod.imeiList && prod.imeiList.length > 0
          ? prod.imeiList
          : (prod.imei ? [prod.imei] : []);

        setPendingAjustarData({
          product: prod,
          branchId: ajustarBranchId,
          action: 'merma',
          qty,
          reason: ajustarReason
        });
        setSelectedAjustarImeis(availImeis.slice(0, qty));
        setAjustarImeiScanInput('');
        setIsAjustarModalOpen(false);
        setIsAjustarImeiModalOpen(true);
        return;
      } else {
        // Incremento de stock de equipo -> Capturar IMEIs nuevos
        setPendingEquipmentData({
          isExisting: true,
          selectedProdId: prod.id,
          code: prod.code,
          name: prod.name,
          costPrice: prod.costPrice,
          price: prod.price,
          supplier: prod.supplier,
          branchId: ajustarBranchId,
          qty
        });
        setImeiInputs(Array(qty).fill(''));
        setIsAjustarModalOpen(false);
        setIsImeiCaptureModalOpen(true);
        return;
      }
    }

    let newBranchQty = currentQtyInBranch;
    if (ajustarAction === 'merma') {
      if (qty > currentQtyInBranch) {
        const branchName = OFFICIAL_BRANCHES.find(b => b.id === ajustarBranchId)?.name;
        alert(`No puedes restar más de las ${currentQtyInBranch} piezas disponibles en ${branchName}.`);
        return;
      }
      newBranchQty = currentQtyInBranch - qty;
    } else {
      newBranchQty = currentQtyInBranch + qty;
    }

    const newBranchStock = {
      ...currentBStock,
      [ajustarBranchId]: newBranchQty
    };

    const newTotalStock = (newBranchStock['b-bodega'] || 0) + (newBranchStock['b-navojoa'] || 0) + (newBranchStock['b-huatabampo'] || 0);

    const updated: Product = {
      ...prod,
      branchStock: newBranchStock,
      stock: newTotalStock
    };

    const actionText = ajustarAction === 'merma' ? 'Baja por Merma' : 'Incremento de Stock';
    const branchName = OFFICIAL_BRANCHES.find(b => b.id === ajustarBranchId)?.name || ajustarBranchId;

    promptSecurityAuth(
      'ajuste',
      `Ajuste (${actionText}): ${prod.name}`,
      `Sucursal: ${branchName} | Cantidad: ${qty} pza(s) | Motivo: ${ajustarReason}`,
      () => {
        onRecordMovement?.({
          type: 'ajuste',
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          category: prod.category,
          inventoryType: prod.inventoryType || 'accesorio',
          quantity: ajustarAction === 'merma' ? -qty : qty,
          targetBranchId: ajustarBranchId,
          targetBranchName: branchName,
          operatorName: currentOperator?.name || 'Admin',
          operatorId: currentOperator?.id,
          reason: ajustarReason,
          details: `Ajuste (${actionText}): ${ajustarAction === 'merma' ? `-${qty}` : `+${qty}`} pza(s) en ${branchName}. Motivo: ${ajustarReason}`
        });

        onUpdateProduct(updated);
        setIsAjustarModalOpen(false);
      }
    );
  };

  // --- HANDLER: GUARDAR MERMA/DAR DE BAJA IMEIS DE EQUIPOS ---
  const handleSaveAjustarMermaWithImeis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAjustarData) return;

    const { product, branchId, qty } = pendingAjustarData;

    if (selectedAjustarImeis.length < qty) {
      alert(`Debes seleccionar o escanear exactamente ${qty} IMEI(s) a dar de baja por merma.`);
      return;
    }

    const currentImeis = product.imeiList && product.imeiList.length > 0
      ? product.imeiList
      : (product.imei ? [product.imei] : []);

    const remainingImeis = currentImeis.filter(i => !selectedAjustarImeis.includes(i));

    const currentBStock = product.branchStock || {
      'b-bodega': getBranchStock(product, 'b-bodega'),
      'b-navojoa': getBranchStock(product, 'b-navojoa'),
      'b-huatabampo': getBranchStock(product, 'b-huatabampo'),
    };

    const currentQtyInBranch = currentBStock[branchId] || 0;
    const newBranchQty = Math.max(0, currentQtyInBranch - qty);

    const newBranchStock = {
      ...currentBStock,
      [branchId]: newBranchQty
    };

    const newTotalStock = (newBranchStock['b-bodega'] || 0) + (newBranchStock['b-navojoa'] || 0) + (newBranchStock['b-huatabampo'] || 0);

    const updated: Product = {
      ...product,
      imeiList: remainingImeis,
      imei: remainingImeis[0] || '',
      branchStock: newBranchStock,
      stock: newTotalStock
    };

    const branchName = OFFICIAL_BRANCHES.find(b => b.id === branchId)?.name || branchId;

    promptSecurityAuth(
      'ajuste',
      `Baja de IMEIs por Merma: ${product.name}`,
      `Sucursal: ${branchName} | ${qty} IMEI(s) a eliminar del inventario`,
      () => {
        onRecordMovement?.({
          type: 'ajuste',
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          category: product.category,
          inventoryType: 'equipo',
          quantity: -qty,
          targetBranchId: branchId,
          targetBranchName: branchName,
          operatorName: currentOperator?.name || 'Admin',
          operatorId: currentOperator?.id,
          reason: pendingAjustarData.reason || 'Baja de IMEIs por merma',
          imeis: selectedAjustarImeis,
          details: `Baja de ${qty} IMEI(s) por merma en ${branchName}. Motivo: ${pendingAjustarData.reason || 'Producto dañado / merma'}`
        });

        onUpdateProduct(updated);
        setIsAjustarImeiModalOpen(false);
        setPendingAjustarData(null);
        setSelectedAjustarImeis([]);
      }
    );
  };

  // --- HANDLER: CAMBIAR PRECIOS ($) ---
  const handleOpenPriceModal = () => {
    const firstProd = tabProducts[0];
    if (firstProd) {
      setPriceSelectedProdId(firstProd.id);
      setEditCostPrice(firstProd.costPrice !== undefined ? firstProd.costPrice.toString() : '0');
      setEditSalePrice(firstProd.price !== undefined ? firstProd.price.toString() : '0');
    } else {
      setPriceSelectedProdId('');
      setEditCostPrice('');
      setEditSalePrice('');
    }
    setIsPriceModalOpen(true);
  };

  const handleSelectProductForPriceChange = (prodId: string) => {
    setPriceSelectedProdId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setEditCostPrice(prod.costPrice !== undefined ? prod.costPrice.toString() : '0');
      setEditSalePrice(prod.price !== undefined ? prod.price.toString() : '0');
    }
  };

  const handleConfirmPriceChange = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === priceSelectedProdId);
    if (!prod) {
      alert('Selecciona un artículo.');
      return;
    }

    const numCost = parseFloat(editCostPrice);
    const numPrice = parseFloat(editSalePrice);

    if (isNaN(numCost) || numCost < 0) {
      alert('Ingresa un Precio Inicial (Costo de Compra) válido mayor o igual a 0.');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      alert('Ingresa un Precio Final (Precio de Venta) válido mayor o igual a 0.');
      return;
    }

    const updated: Product = {
      ...prod,
      costPrice: numCost,
      price: numPrice
    };

    onRecordMovement?.({
      type: 'precio',
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      category: prod.category,
      inventoryType: prod.inventoryType,
      quantity: 0,
      operatorName: currentOperator?.name || 'Admin',
      operatorId: currentOperator?.id,
      oldCostPrice: prod.costPrice,
      newCostPrice: numCost,
      oldPrice: prod.price,
      newPrice: numPrice,
      details: `Cambio de Precios: Costo $${prod.costPrice?.toFixed(2) || '0.00'} ➔ $${numCost.toFixed(2)} | Venta $${prod.price?.toFixed(2) || '0.00'} ➔ $${numPrice.toFixed(2)}`
    });

    onUpdateProduct(updated);
    setIsPriceModalOpen(false);
  };

  // --- HANDLER: MODIFICAR / EDITAR REGISTRO DE PRODUCTO O CELULAR ---
  const handleSaveEditedProduct = (updatedProduct: Product) => {
    const original = products.find(p => p.id === updatedProduct.id);
    
    // Si cambiaron código, precios, nombre o proveedor, registrar movimiento de auditoría
    const codeChanged = original && original.code !== updatedProduct.code;
    const priceChanged = original && (original.price !== updatedProduct.price || original.costPrice !== updatedProduct.costPrice);
    const supplierChanged = original && original.supplier !== updatedProduct.supplier;
    const nameChanged = original && original.name !== updatedProduct.name;

    if (codeChanged || priceChanged || supplierChanged || nameChanged) {
      const detailsList: string[] = [];
      if (codeChanged) detailsList.push(`Código: "${original?.code}" ➔ "${updatedProduct.code}"`);
      if (nameChanged) detailsList.push(`Nombre: "${original?.name}" ➔ "${updatedProduct.name}"`);
      if (supplierChanged) detailsList.push(`Proveedor: "${original?.supplier || 'N/A'}" ➔ "${updatedProduct.supplier || 'N/A'}"`);
      if (priceChanged) {
        detailsList.push(`Costo $${original?.costPrice?.toFixed(2) || '0.00'} ➔ $${updatedProduct.costPrice?.toFixed(2) || '0.00'}`);
        detailsList.push(`Venta $${original?.price?.toFixed(2) || '0.00'} ➔ $${updatedProduct.price?.toFixed(2) || '0.00'}`);
      }

      onRecordMovement?.({
        type: 'precio',
        productId: updatedProduct.id,
        productCode: updatedProduct.code,
        productName: updatedProduct.name,
        category: updatedProduct.category,
        inventoryType: updatedProduct.inventoryType,
        quantity: 0,
        operatorName: currentOperator?.name || 'Admin',
        operatorId: currentOperator?.id,
        oldCostPrice: original?.costPrice,
        newCostPrice: updatedProduct.costPrice,
        oldPrice: original?.price,
        newPrice: updatedProduct.price,
        details: `Modificación de Registro: ${detailsList.join(' | ')}`
      });
    }

    onUpdateProduct(updatedProduct);
    setEditingProduct(null);
  };

  return (
    <div className="h-full flex flex-col p-3 bg-slate-100 overflow-y-auto space-y-3">
      
      {/* BARRA SUPERIOR OPTIMIZADA */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
        
        {/* IZQUIERDA: 1. ACCESORIOS y 2. EQUIPOS */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveInventoryTab('accesorio')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeInventoryTab === 'accesorio'
                ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Headphones className="w-4 h-4 text-blue-400" />
            1. ACCESORIOS
          </button>

          <button
            onClick={() => setActiveInventoryTab('equipo')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeInventoryTab === 'equipo'
                ? 'bg-blue-700 text-white shadow-md ring-2 ring-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-amber-300" />
            2. EQUIPOS
          </button>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-extrabold shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Anti-Duplicados Activo</span>
          </div>
        </div>

        {/* DERECHA: BÚSQUEDA + BOTONES INGRESAR, TRANSFERIR Y AJUSTAR */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          
          {/* Búsqueda */}
          <div className="relative flex-1 md:w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          {/* Botón INGRESAR */}
          <button
            onClick={handleOpenIngresar}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Ingresar
          </button>

          {/* Botón TRANSFERIR */}
          <button
            onClick={handleOpenTransfer}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transferir
          </button>

          {/* Botón AJUSTAR (NUEVO - MERMAS Y CORRECCIONES) */}
          <button
            onClick={handleOpenAjustar}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Ajustar
          </button>

          {/* Botón EDITAR / MODIFICAR REGISTRO */}
          <button
            onClick={() => {
              const first = filteredProducts[0] || tabProducts[0] || null;
              setEditingProduct(first);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
            title="Modificar registro de teléfonos o artículos (proveedor, precios, modelo, etc.)"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>

          {/* Botón CAMBIAR PRECIOS ($) */}
          <button
            onClick={handleOpenPriceModal}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
            title="Cambiar Precio Inicial (Compra) y Precio Final (Venta)"
          >
            <DollarSign className="w-4 h-4" />
            Precios
          </button>

          {/* Botón IMPRIMIR ETIQUETAS (CÓDIGO DE BARRAS, PRECIO, NOMBRE) */}
          <button
            onClick={() => {
              setLabelSelectedProduct(null);
              setIsLabelsModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0 border border-amber-400"
            title="Imprimir etiquetas adhesivas con código de barras, precio y nombre para etiquetar productos"
          >
            <Tag className="w-4 h-4 text-slate-950" />
            <span>Imprimir Etiquetas</span>
          </button>

          {/* Botón IMPRIMIR INVENTARIO (SELECCIÓN DINÁMICA POR TAB: EQUIPOS O ACCESORIOS) */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0 ${
              activeInventoryTab === 'equipo' 
                ? 'bg-blue-700 hover:bg-blue-800' 
                : 'bg-purple-700 hover:bg-purple-800'
            }`}
            title={`Generar archivo e imprimir reporte de ${activeInventoryTab === 'equipo' ? 'Equipos Celulares' : 'Accesorios'}`}
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>{activeInventoryTab === 'equipo' ? 'Imprimir Equipos' : 'Imprimir Accesorios'}</span>
          </button>

          {/* Botón HISTORIAL DE MOVIMIENTOS (15 DÍAS) */}
          <button
            onClick={() => setIsMovementsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0 border border-slate-700"
            title="Ver Historial de Movimientos de los últimos 15 días con auto-limpieza"
          >
            <History className="w-4 h-4 text-purple-300" />
            <span>Historial (15 Días)</span>
            {inventoryMovements && inventoryMovements.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-purple-500 text-white rounded-full">
                {inventoryMovements.length}
              </span>
            )}
          </button>

        </div>

      </div>

      {/* VISTA TABLA GENERAL DE INVENTARIO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold text-xs tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-32">1. CÓDIGO</th>
                  <th className="p-3">2. PRODUCTO</th>
                  {activeInventoryTab === 'equipo' && (
                    <th className="p-3 w-40 text-left bg-blue-950 text-amber-300">IMEI</th>
                  )}
                  <th className="p-3 text-right w-32">3. PRECIO INICIAL</th>
                  <th className="p-3 text-right w-32">4. PRECIO FINAL</th>
                  <th className="p-3 text-center w-28 bg-blue-950 border-l border-slate-800">BODEGA</th>
                  <th className="p-3 text-center w-28 bg-emerald-950">NAVOJOA</th>
                  <th className="p-3 text-center w-28 bg-purple-950 border-r border-slate-800">HUATABAMPO</th>
                  <th className="p-3 text-center w-24">TOTAL STOCK</th>
                  <th className="p-3 text-center w-28">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={activeInventoryTab === 'equipo' ? 10 : 9} className="p-12 text-center text-slate-400">
                      No hay productos en el inventario de {activeInventoryTab}s.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const bodegaQty = getBranchStock(p, 'b-bodega');
                    const navojoaQty = getBranchStock(p, 'b-navojoa');
                    const huatabampoQty = getBranchStock(p, 'b-huatabampo');
                    const totalQty = getTotalStock(p);

                    const isTypeEquipo = (p.inventoryType || (p.category === 'equipo_credito' ? 'equipo' : 'accesorio')) === 'equipo';

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        
                        {/* 1. Código */}
                        <td className="p-3 font-mono font-extrabold text-blue-700 bg-slate-50/50">
                          {p.code}
                        </td>

                        {/* 2. Producto */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className={`p-1.5 rounded-lg shrink-0 ${
                              isTypeEquipo ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {isTypeEquipo ? <Smartphone className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block">{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium uppercase">
                                {isTypeEquipo ? 'Equipo Celular' : 'Accesorio'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Column for IMEI (only on Equipos tab) */}
                        {activeInventoryTab === 'equipo' && (
                          <td className="p-3 font-mono font-bold text-xs bg-blue-50/30">
                            {(() => {
                              const imeiList = p.imeiList && p.imeiList.length > 0 
                                ? p.imeiList 
                                : (p.imei ? [p.imei] : []);

                              if (imeiList.length === 0) {
                                return <span className="text-slate-300 italic font-normal">Sin IMEI</span>;
                              }

                              if (imeiList.length === 1) {
                                return (
                                  <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-200">
                                    {imeiList[0]}
                                  </span>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={() => setViewingImeisProduct(p)}
                                  className="inline-flex items-center gap-1.5 font-mono text-xs font-extrabold bg-amber-100 hover:bg-amber-200 text-amber-950 px-2.5 py-1 rounded-lg border border-amber-300 transition-all cursor-pointer shadow-2xs"
                                  title="Haz clic para ver la lista completa de IMEIs"
                                >
                                  <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                                  <span>{imeiList.length} IMEIs Registrados</span>
                                </button>
                              );
                            })()}
                          </td>
                        )}

                        {/* 3. Precio Inicial (Costo) */}
                        <td className="p-3 text-right font-semibold text-slate-600 font-mono">
                          {p.costPrice ? `$${p.costPrice.toFixed(2)}` : <span className="text-slate-300">$0.00</span>}
                        </td>

                        {/* 4. Precio Final (Venta) */}
                        <td className="p-3 text-right font-black text-slate-900 font-mono text-sm">
                          {p.price > 0 ? `$${p.price.toFixed(2)}` : <span className="text-slate-400 font-normal">Variable</span>}
                        </td>

                        {/* 5. Cantidad Bodega */}
                        <td className="p-3 text-center bg-blue-50/30 border-l border-slate-100">
                          <span className={`inline-block px-2.5 py-1 rounded-md font-black text-xs font-mono ${
                            bodegaQty < 3 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-900'
                          }`}>
                            {bodegaQty}
                          </span>
                        </td>

                        {/* 5. Cantidad Navojoa */}
                        <td className="p-3 text-center bg-emerald-50/30">
                          <span className={`inline-block px-2.5 py-1 rounded-md font-black text-xs font-mono ${
                            navojoaQty < 3 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-900'
                          }`}>
                            {navojoaQty}
                          </span>
                        </td>

                        {/* 5. Cantidad Huatabampo */}
                        <td className="p-3 text-center bg-purple-50/30 border-r border-slate-100">
                          <span className={`inline-block px-2.5 py-1 rounded-md font-black text-xs font-mono ${
                            huatabampoQty < 3 ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-900'
                          }`}>
                            {huatabampoQty}
                          </span>
                        </td>

                        {/* Total Stock */}
                        <td className="p-3 text-center">
                          <span className="px-3 py-1 rounded-full bg-slate-900 text-white font-black text-xs font-mono">
                            {totalQty}
                          </span>
                        </td>

                        {/* Acciones: Etiqueta, Modificar y Ver Información */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setLabelSelectedProduct(p);
                                setIsLabelsModalOpen(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-500 text-amber-950 hover:text-white transition-all cursor-pointer border border-amber-300 font-extrabold text-[11px] shadow-2xs"
                              title={`Imprimir etiqueta con código de barras para ${p.name}`}
                            >
                              <Tag className="w-3.5 h-3.5" />
                              <span>Etiqueta</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProduct(p)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-500 text-amber-900 hover:text-white transition-all cursor-pointer border border-amber-300 font-extrabold text-[11px] shadow-2xs"
                              title={`Modificar datos de ${isTypeEquipo ? 'este teléfono' : 'este artículo'} (precios, proveedor, modelo, etc.)`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInfoProduct(p)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-all cursor-pointer border border-blue-200 shadow-2xs"
                              title="Ver Información Detallada del Artículo / Proveedor"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* VENTANA EMERGENTE 1: INGRESAR (MODELO, CANTIDAD Y SUCURSAL) */}
      {isIngresarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className={`flex items-center justify-between px-6 py-4 text-white ${activeInventoryTab === 'equipo' ? 'bg-blue-900' : 'bg-emerald-800'}`}>
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-300" />
                <h3 className="font-extrabold text-base">
                  {activeInventoryTab === 'equipo' ? 'Ingresar Equipo Celular' : 'Ingresar Accesorio'}
                </h3>
              </div>
              <button onClick={() => setIsIngresarModalOpen(false)} className="text-emerald-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmIngresar} className="p-6 space-y-4">
              
              {/* Tabs: Modelo Existente vs Registrar Nuevo Modelo */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setIngresarMode('existente')}
                  className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    ingresarMode === 'existente'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {activeInventoryTab === 'equipo' ? 'Modelo de Equipo Existente' : 'Accesorio Existente'}
                </button>
                <button
                  type="button"
                  onClick={() => setIngresarMode('nuevo')}
                  className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    ingresarMode === 'nuevo'
                      ? activeInventoryTab === 'equipo' ? 'bg-blue-800 text-white shadow-xs' : 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {activeInventoryTab === 'equipo' ? '+ Registrar Nuevo Modelo de Equipo' : '+ Registrar Nuevo Accesorio'}
                </button>
              </div>

              {ingresarMode === 'existente' ? (
                <>
                  {/* Seleccionar Modelo Existente */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      {activeInventoryTab === 'equipo' ? 'Modelo de Equipo:' : 'Accesorio:'}
                    </label>
                    <select
                      value={ingresarSelectedProdId}
                      onChange={(e) => setIngresarSelectedProdId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-600"
                    >
                      {tabProducts.length === 0 ? (
                        <option value="">
                          {activeInventoryTab === 'equipo' ? 'No hay modelos de equipo registrados' : 'No hay accesorios registrados'}
                        </option>
                      ) : (
                        tabProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            [{p.code}] {p.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </>
              ) : activeInventoryTab === 'equipo' ? (
                <>
                  {/* Campos para Nuevo Equipo Celular */}
                  <div className="space-y-3 p-3 bg-blue-50/50 border border-blue-200 rounded-xl">
                    <div>
                      <label className="block text-[11px] font-extrabold text-blue-950 mb-1">Modelo del Equipo *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Samsung Galaxy A54 128GB"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-extrabold text-blue-950">Código Interno</label>
                          {newCode.trim() && (
                            (() => {
                              const dup = checkDuplicateCode(newCode);
                              return dup.isDuplicate ? (
                                <span className="text-[10px] font-extrabold text-rose-600 flex items-center gap-0.5">
                                  <AlertCircle className="w-3 h-3" /> Duplicado
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold text-emerald-600 flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Disponible
                                </span>
                              );
                            })()
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Ej. EQ-SAMA54 (Opcional)"
                          value={newCode}
                          onChange={(e) => setNewCode(e.target.value)}
                          className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-bold uppercase transition-all ${
                            newCode.trim() && checkDuplicateCode(newCode).isDuplicate
                              ? 'border-rose-500 bg-rose-50/60 text-rose-950 focus:ring-2 focus:ring-rose-500'
                              : newCode.trim()
                              ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 focus:ring-2 focus:ring-emerald-500'
                              : 'border-slate-300 bg-white focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                        {newCode.trim() && checkDuplicateCode(newCode).isDuplicate && (
                          <div className="mt-1 p-1.5 bg-rose-100 border border-rose-300 rounded-lg text-[10px] font-bold text-rose-800 flex items-start gap-1">
                            <Ban className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                            <span>Código en uso por "{checkDuplicateCode(newCode).conflictingProduct?.name}"</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold text-blue-950 mb-1">Precio Inicial (Costo)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="$0.00"
                          value={newCostPrice}
                          onChange={(e) => setNewCostPrice(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold text-blue-950 mb-1">Precio Final (Venta)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="$0.00"
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-blue-950 mb-1">
                        Proveedor (Información Adicional):
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Distribuidor Celular Telcel / Macropay"
                        value={newSupplier}
                        onChange={(e) => setNewSupplier(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Campos para Nuevo Accesorio */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-extrabold text-slate-700">Código *</label>
                        {newCode.trim() && (
                          (() => {
                            const dup = checkDuplicateCode(newCode);
                            return dup.isDuplicate ? (
                              <span className="text-[10px] font-extrabold text-rose-600 flex items-center gap-0.5">
                                <AlertCircle className="w-3 h-3" /> Duplicado
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold text-emerald-600 flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> Disponible
                              </span>
                            );
                          })()
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Ej. AUDI-01"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-bold uppercase transition-all ${
                          newCode.trim() && checkDuplicateCode(newCode).isDuplicate
                            ? 'border-rose-500 bg-rose-50/60 text-rose-950 focus:ring-2 focus:ring-rose-500'
                            : newCode.trim()
                            ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 focus:ring-2 focus:ring-emerald-500'
                            : 'border-slate-300 focus:ring-2 focus:ring-emerald-600'
                        }`}
                      />
                      {newCode.trim() && checkDuplicateCode(newCode).isDuplicate && (
                        <div className="mt-1 p-1.5 bg-rose-100 border border-rose-300 rounded-lg text-[10px] font-bold text-rose-800 flex items-start gap-1">
                          <Ban className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                          <span>Ya asignado a: "{checkDuplicateCode(newCode).conflictingProduct?.name}"</span>
                        </div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Nombre / Modelo *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Audífonos Gamer X"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Precio Inicial (Costo)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="$0.00"
                        value={newCostPrice}
                        onChange={(e) => setNewCostPrice(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Precio Final (Venta)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="$0.00"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      Proveedor (Información Adicional):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Mayorista Accesorios MX"
                      value={newSupplier}
                      onChange={(e) => setNewSupplier(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                    />
                  </div>
                </>
              )}

              {/* Sucursal que se agrega & Cantidad */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Sucursal que ingresa:
                  </label>
                  <select
                    value={ingresarBranchId}
                    onChange={(e) => setIngresarBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                  >
                    {OFFICIAL_BRANCHES.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Cantidad a Ingresar:
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={ingresarQuantity}
                    onChange={(e) => setIngresarQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIngresarModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer"
                >
                  Confirmar Ingreso
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* VENTANA EMERGENTE 2: TRANSFERIR (SUC ORIGEN, SUC DESTINO, MODELO Y CANTIDAD) */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-6 py-4 bg-blue-900 text-white">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-300" />
                <h3 className="font-extrabold text-base">
                  {activeInventoryTab === 'equipo' ? 'Transferencia de Equipos Celulares' : 'Transferencia de Accesorios'}
                </h3>
              </div>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-blue-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="p-6 space-y-4">
              
              {/* Modelo / Producto */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  {activeInventoryTab === 'equipo' ? 'Modelo de Equipo:' : 'Accesorio:'}
                </label>
                <select
                  value={transferSelectedProdId}
                  onChange={(e) => setTransferSelectedProdId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-600"
                >
                  {tabProducts.length === 0 ? (
                    <option value="">No hay elementos disponibles para transferir</option>
                  ) : (
                    tabProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Suc Origen y Suc Destino */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Sucursal Origen:
                  </label>
                  <select
                    value={fromBranchId}
                    onChange={(e) => setFromBranchId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                  >
                    {OFFICIAL_BRANCHES.map(b => {
                      const prod = products.find(p => p.id === transferSelectedProdId);
                      const qtyInB = prod ? getBranchStock(prod, b.id) : 0;
                      return (
                        <option key={b.id} value={b.id}>
                          {b.name} ({qtyInB} pzs)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Sucursal Destino:
                  </label>
                  <select
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                  >
                    {OFFICIAL_BRANCHES.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cantidad */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Cantidad a Transferir:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-extrabold text-slate-900 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer"
                >
                  Confirmar Transferencia
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* VENTANA EMERGENTE 3: AJUSTAR (MODELO, CANTIDAD, UBICACIÓN/SUCURSAL Y MOTIVO DE MERMA) */}
      {isAjustarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-6 py-4 bg-amber-700 text-white">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-200" />
                <h3 className="font-extrabold text-base">
                  {activeInventoryTab === 'equipo' ? 'Ajuste de Equipos Celulares / Mermas' : 'Ajuste de Accesorios / Mermas'}
                </h3>
              </div>
              <button onClick={() => setIsAjustarModalOpen(false)} className="text-amber-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAjustar} className="p-6 space-y-4">
              
              {/* Modelo / Producto */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  {activeInventoryTab === 'equipo' ? 'Modelo de Equipo a Ajustar:' : 'Accesorio a Ajustar:'}
                </label>
                <select
                  value={ajustarSelectedProdId}
                  onChange={(e) => setAjustarSelectedProdId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-amber-600"
                >
                  {tabProducts.length === 0 ? (
                    <option value="">No hay elementos disponibles para ajustar</option>
                  ) : (
                    tabProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Ubicación / Sucursal */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Ubicación / Sucursal:
                </label>
                <select
                  value={ajustarBranchId}
                  onChange={(e) => setAjustarBranchId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                >
                  {OFFICIAL_BRANCHES.map(b => {
                    const prod = products.find(p => p.id === ajustarSelectedProdId);
                    const qtyInB = prod ? getBranchStock(prod, b.id) : 0;
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name} (Stock actual: {qtyInB} pzs)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Accion: Descontar Merma vs Corrección / Incremento */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAjustarAction('merma')}
                  className={`p-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                    ajustarAction === 'merma'
                      ? 'bg-red-700 text-white border-red-700 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-300" />
                  - Descontar Merma
                </button>

                <button
                  type="button"
                  onClick={() => setAjustarAction('incremento')}
                  className={`p-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                    ajustarAction === 'incremento'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <PlusCircle className="w-4 h-4 text-emerald-200" />
                  + Sumar Corrección
                </button>
              </div>

              {/* Cantidad & Motivo */}
              <div className="space-y-3 p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                <div>
                  <label className="block text-xs font-extrabold text-amber-950 mb-1">
                    Cantidad a Ajustar:
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={ajustarQuantity}
                    onChange={(e) => setAjustarQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-extrabold text-slate-900 focus:ring-2 focus:ring-amber-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-amber-950 mb-1">
                    Motivo / Razón del Ajuste:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Producto dañado, robo, diferencia en físico..."
                    value={ajustarReason}
                    onChange={(e) => setAjustarReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-600 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAjustarModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer"
                >
                  Aplicar Ajuste
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* VENTANA EMERGENTE 4: CAMBIAR PRECIOS (COSTO DE COMPRA Y PRECIO DE VENTA) */}
      {isPriceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-6 py-4 bg-indigo-900 text-white">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-base">
                  {activeInventoryTab === 'equipo' ? 'Modificar Precios de Equipos Celulares' : 'Modificar Precios de Accesorios'}
                </h3>
              </div>
              <button onClick={() => setIsPriceModalOpen(false)} className="text-indigo-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPriceChange} className="p-6 space-y-4">
              
              {/* Lista desplegable de artículos del inventario */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  {activeInventoryTab === 'equipo' ? 'Seleccionar Modelo de Equipo:' : 'Seleccionar Accesorio:'}
                </label>
                <select
                  value={priceSelectedProdId}
                  onChange={(e) => handleSelectProductForPriceChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-600"
                >
                  {tabProducts.length === 0 ? (
                    <option value="">No hay artículos disponibles</option>
                  ) : (
                    tabProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Formulario de Precios */}
              <div className="space-y-3 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Precio Inicial (Costo de Compra):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editCostPrice}
                      onChange={(e) => setEditCostPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-indigo-600 bg-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Precio Final (Precio de Venta):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editSalePrice}
                      onChange={(e) => setEditSalePrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-indigo-600 bg-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPriceModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer"
                >
                  Guardar Precios
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* VENTANA EMERGENTE 5: DETALLES E INFORMACIÓN ADICIONAL (PROVEEDOR, IMEI, PRECIOS Y STOCK) */}
      {infoProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base">Información del Artículo</h3>
              </div>
              <button onClick={() => setInfoProduct(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Encabezado con Código y Nombre */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {infoProduct.code}
                  </span>
                  <span className="uppercase text-[10px] font-extrabold px-2 py-0.5 bg-slate-200 text-slate-800 rounded-full">
                    {infoProduct.category === 'equipo_credito' || infoProduct.inventoryType === 'equipo' ? 'Equipo Celular' : 'Accesorio'}
                  </span>
                </div>
                <h4 className="font-black text-slate-900 text-sm pt-1">{infoProduct.name}</h4>
              </div>

              {/* IMEI del equipo */}
              {(infoProduct.imeiList?.length || infoProduct.imei || infoProduct.inventoryType === 'equipo' || infoProduct.category === 'equipo_credito') && (
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-blue-900 uppercase tracking-wider block">
                      IMEIs del Equipo ({(infoProduct.imeiList && infoProduct.imeiList.length > 0) ? infoProduct.imeiList.length : (infoProduct.imei ? 1 : 0)} registrados):
                    </span>
                    {infoProduct.imeiList && infoProduct.imeiList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setViewingImeisProduct(infoProduct);
                          setInfoProduct(null);
                        }}
                        className="text-[10px] font-extrabold text-blue-700 hover:underline cursor-pointer"
                      >
                        Ver todos ({infoProduct.imeiList.length}) →
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {(infoProduct.imeiList && infoProduct.imeiList.length > 0
                      ? infoProduct.imeiList
                      : (infoProduct.imei ? [infoProduct.imei] : [])
                    ).map((imei, idx) => (
                      <span key={idx} className="font-mono font-bold text-xs bg-white text-blue-950 px-2 py-1 rounded border border-blue-200 shadow-2xs">
                        #{idx + 1}: {imei}
                      </span>
                    ))}
                    {(!infoProduct.imeiList?.length && !infoProduct.imei) && (
                      <span className="text-slate-400 italic">Sin IMEIs registrados</span>
                    )}
                  </div>
                </div>
              )}

              {/* Proveedor / Información Adicional */}
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider block">Proveedor (Información Adicional):</span>
                <span className="font-bold text-slate-900 block text-xs">
                  {infoProduct.supplier || 'No especificado'}
                </span>
              </div>

              {/* Precios */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Precio Inicial (Costo):</span>
                  <span className="font-mono font-black text-sm text-slate-800">
                    {infoProduct.costPrice ? `$${infoProduct.costPrice.toFixed(2)}` : '$0.00'}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase block">Precio Final (Venta):</span>
                  <span className="font-mono font-black text-sm text-emerald-900">
                    {infoProduct.price ? `$${infoProduct.price.toFixed(2)}` : '$0.00'}
                  </span>
                </div>
              </div>

              {/* Stock por Sucursal */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Stock en Sucursales:</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-1.5 bg-blue-100/50 rounded-lg">
                    <span className="text-[10px] font-bold text-blue-900 block">Bodega</span>
                    <span className="font-black font-mono text-xs text-blue-950">{getBranchStock(infoProduct, 'b-bodega')}</span>
                  </div>
                  <div className="p-1.5 bg-emerald-100/50 rounded-lg">
                    <span className="text-[10px] font-bold text-emerald-900 block">Navojoa</span>
                    <span className="font-black font-mono text-xs text-emerald-950">{getBranchStock(infoProduct, 'b-navojoa')}</span>
                  </div>
                  <div className="p-1.5 bg-purple-100/50 rounded-lg">
                    <span className="text-[10px] font-bold text-purple-900 block">Huatabampo</span>
                    <span className="font-black font-mono text-xs text-purple-950">{getBranchStock(infoProduct, 'b-huatabampo')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = infoProduct;
                    setInfoProduct(null);
                    setEditingProduct(target);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-sm cursor-pointer transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Modificar Datos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInfoProduct(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* VENTANA EMERGENTE: CAPTURAR IMEIS AL REGISTRAR EQUIPOS */}
      {isImeiCaptureModalOpen && pendingEquipmentData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            
            <div className="flex items-center justify-between px-6 py-4 bg-amber-500 text-slate-950">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-slate-950 fill-amber-300" />
                <div>
                  <h3 className="font-black text-base">Captura de IMEIs - {pendingEquipmentData.name}</h3>
                  <p className="text-[11px] font-bold text-slate-900 opacity-90">
                    Cantidad: {pendingEquipmentData.qty} equipo(s) a ingresar en {OFFICIAL_BRANCHES.find(b => b.id === pendingEquipmentData.branchId)?.name || 'Bodega'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImeiCaptureModalOpen(false);
                  setPendingEquipmentData(null);
                }}
                className="text-slate-900 hover:text-slate-950 p-1 rounded-lg hover:bg-amber-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCapturedImeis} className="p-6 space-y-4">
              
              {/* Banner informativo */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Escanee el IMEI de cada equipo con su lector de código de barras.
                  </p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    Al presionar <span className="font-mono font-bold bg-blue-100 px-1 rounded">Enter</span> el cursor avanzará automáticamente al siguiente campo. El sistema valida en tiempo real que ningún IMEI esté duplicado.
                  </p>
                </div>
              </div>

              {/* Banner General de Alerta si hay duplicados detectados */}
              {(() => {
                let batchDupCount = 0;
                let sysDupCount = 0;

                imeiInputs.forEach((im, idx) => {
                  const clean = im.trim().toUpperCase();
                  if (clean) {
                    const chk = checkDuplicateImei(clean, imeiInputs, idx);
                    if (chk.isDuplicateInBatch) batchDupCount++;
                    if (chk.isDuplicateInSystem) sysDupCount++;
                  }
                });

                if (batchDupCount > 0 || sysDupCount > 0) {
                  return (
                    <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-start gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-extrabold text-rose-950">
                          🚫 BLOQUEO ANTI-DUPLICADOS ACTIVO: Se detectaron IMEIs duplicados
                        </p>
                        <p className="text-[11px] text-rose-800 mt-0.5">
                          {batchDupCount > 0 && `• ${batchDupCount} IMEI(s) repetidos dentro de este mismo lote. `}
                          {sysDupCount > 0 && `• ${sysDupCount} IMEI(s) ya existentes en el inventario activo. `}
                          Corrija los campos marcados en rojo para poder continuar.
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* INPUTS DE IMEIS CON VALIDACIÓN EN TIEMPO REAL */}
              <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 border border-slate-200 p-3 rounded-xl bg-slate-50">
                {Array.from({ length: pendingEquipmentData.qty }).map((_, idx) => {
                  const currentVal = imeiInputs[idx] || '';
                  const cleanVal = currentVal.trim().toUpperCase();
                  const dupCheck = cleanVal ? checkDuplicateImei(cleanVal, imeiInputs, idx) : null;
                  const hasBatchDup = dupCheck?.isDuplicateInBatch || false;
                  const hasSystemDup = dupCheck?.isDuplicateInSystem || false;
                  const digitValidation = cleanVal ? validateImeiDigits(cleanVal) : null;
                  const isDigitError = digitValidation && !digitValidation.isValid;
                  const isValidAndUnique = Boolean(digitValidation?.isValid && !hasBatchDup && !hasSystemDup);

                  return (
                    <div 
                      key={idx} 
                      className={`p-2.5 rounded-xl border transition-all ${
                        hasBatchDup || hasSystemDup || isDigitError
                          ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400'
                          : isValidAndUnique
                          ? 'bg-emerald-50/40 border-emerald-300'
                          : 'bg-white border-slate-200'
                      } space-y-1.5`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-20 text-[11px] font-mono font-extrabold text-slate-600 shrink-0">
                          Equipo #{idx + 1}:
                        </span>
                        <div className="relative flex-1">
                          <input
                            id={`imei-input-${idx}`}
                            type="text"
                            placeholder={`Escanee o escriba IMEI #${idx + 1} (15 dígitos)`}
                            value={imeiInputs[idx] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setImeiInputs((prev) => {
                                const copy = [...prev];
                                copy[idx] = val;
                                return copy;
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const next = document.getElementById(`imei-input-${idx + 1}`);
                                if (next) {
                                  next.focus();
                                }
                              }
                            }}
                            className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-extrabold uppercase transition-all ${
                              hasBatchDup || hasSystemDup || isDigitError
                                ? 'border-rose-500 bg-white text-rose-950 focus:ring-2 focus:ring-rose-500'
                                : isValidAndUnique
                                ? 'border-emerald-500 bg-white text-emerald-950 focus:ring-2 focus:ring-emerald-500'
                                : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500'
                            }`}
                          />
                          {isValidAndUnique && (
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-extrabold text-emerald-600">
                              <Check className="w-3.5 h-3.5" />
                              <span>15 dígitos (Válido)</span>
                            </div>
                          )}
                          {(hasBatchDup || hasSystemDup || isDigitError) && (
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-extrabold text-rose-600">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {cleanVal && <span>{cleanVal.length}/15</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Notificación de Error de Longitud o Formato de IMEI */}
                      {isDigitError && digitValidation && (
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-rose-800 bg-rose-100 p-1.5 rounded-lg border border-rose-300">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                          <span>❌ ERROR DE IMEI: {digitValidation.message}</span>
                        </div>
                      )}

                      {/* Notificaciones específicas de duplicado por renglón */}
                      {hasBatchDup && (
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-rose-700 bg-rose-100 p-1.5 rounded-lg border border-rose-300">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                          <span>⚠️ DUPLICADO EN LOTE: Idéntico al Equipo #{(dupCheck?.batchDuplicateIndex ?? 0) + 1}</span>
                        </div>
                      )}

                      {hasSystemDup && dupCheck?.conflictingProduct && (
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-rose-800 bg-rose-100 p-1.5 rounded-lg border border-rose-300">
                          <Ban className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                          <span>
                            ❌ YA EXISTE EN SISTEMA: Registrado en "{dupCheck.conflictingProduct.name}" ({dupCheck.conflictingBranchName || 'Inventario'})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pie del modal con conteo y validación de guardado */}
              {(() => {
                const filledCount = imeiInputs.filter((s) => s.trim()).length;
                let hasAnyDuplicates = false;
                let hasAnyDigitErrors = false;

                imeiInputs.forEach((im, idx) => {
                  const clean = im.trim().toUpperCase();
                  if (clean) {
                    const chk = checkDuplicateImei(clean, imeiInputs, idx);
                    if (chk.isDuplicate) hasAnyDuplicates = true;
                    const digitVal = validateImeiDigits(clean);
                    if (!digitVal.isValid) hasAnyDigitErrors = true;
                  }
                });

                const isComplete = filledCount === pendingEquipmentData.qty;
                const canSubmit = isComplete && !hasAnyDuplicates && !hasAnyDigitErrors;

                return (
                  <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                      <span className={`text-xs font-extrabold block ${
                        isComplete && !hasAnyDuplicates && !hasAnyDigitErrors ? 'text-emerald-700' : 'text-slate-500'
                      }`}>
                        {`${filledCount} / ${pendingEquipmentData.qty} campos completados (15 dígitos c/u)`}
                      </span>
                      {hasAnyDigitErrors && (
                        <span className="text-[10px] font-extrabold text-rose-600 block">
                          Todos los IMEIs deben tener exactamente 15 dígitos numéricos
                        </span>
                      )}
                      {hasAnyDuplicates && (
                        <span className="text-[10px] font-extrabold text-rose-600 block">
                          Corrija los duplicados antes de guardar
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsImeiCaptureModalOpen(false);
                          setPendingEquipmentData(null);
                        }}
                        className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!canSubmit}
                        className={`px-5 py-2 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 ${
                          canSubmit
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Guardar Equipos y IMEIs
                      </button>
                    </div>
                  </div>
                );
              })()}

            </form>

          </div>
        </div>
      )}

      {/* VENTANA EMERGENTE: LISTA DE IMEIS DE UN PRODUCTO */}
      {viewingImeisProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-base">IMEIs Registrados</h3>
                  <p className="text-[11px] text-slate-300">{viewingImeisProduct.name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setViewingImeisProduct(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Buscador de IMEI dentro de la lista */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar IMEI específico..."
                  value={imeiSearchQuery}
                  onChange={(e) => setImeiSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Lista de IMEIs */}
              <div className="max-h-64 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {(() => {
                  const list = viewingImeisProduct.imeiList && viewingImeisProduct.imeiList.length > 0
                    ? viewingImeisProduct.imeiList
                    : (viewingImeisProduct.imei ? [viewingImeisProduct.imei] : []);

                  const filtered = list.filter(i => !imeiSearchQuery || i.toLowerCase().includes(imeiSearchQuery.toLowerCase()));

                  if (filtered.length === 0) {
                    return <p className="p-4 text-center text-slate-400">No se encontraron IMEIs con ese criterio.</p>;
                  }

                  return filtered.map((imei, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 font-mono text-xs font-bold text-slate-800">
                      <span>#{idx + 1}: <strong className="text-blue-900">{imei}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(imei);
                          setCopiedImei(imei);
                          setTimeout(() => setCopiedImei(null), 1500);
                        }}
                        className="px-2 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-all cursor-pointer font-sans font-extrabold"
                      >
                        {copiedImei === imei ? '¡Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  ));
                })()}
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500 font-bold text-[11px]">
                  Total: {(viewingImeisProduct.imeiList?.length || (viewingImeisProduct.imei ? 1 : 0))} unidades
                </span>
                <button
                  type="button"
                  onClick={() => setViewingImeisProduct(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* VENTANA EMERGENTE: SELECCIÓN DE IMEIS PARA TRASPASO */}
      {isTransferImeiModalOpen && pendingTransferData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-6 py-4 bg-blue-900 text-white">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-300" />
                <div>
                  <h3 className="font-extrabold text-base">Seleccionar IMEIs para Traspaso</h3>
                  <p className="text-[11px] text-blue-200">{pendingTransferData.product.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTransferImeiModalOpen(false);
                  setPendingTransferData(null);
                }}
                className="text-blue-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransferWithImeis} className="p-6 space-y-4 text-xs">
              
              {/* Resumen del movimiento */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-blue-950 font-bold">
                <div>
                  <span className="text-[10px] text-blue-700 uppercase font-black block">Movimiento:</span>
                  <span>{OFFICIAL_BRANCHES.find(b => b.id === pendingTransferData.fromBranchId)?.name} ➔ {OFFICIAL_BRANCHES.find(b => b.id === pendingTransferData.toBranchId)?.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-blue-700 uppercase font-black block">Cantidad:</span>
                  <span className="font-mono text-sm font-black text-blue-900">{pendingTransferData.qty} equipo(s)</span>
                </div>
              </div>

              {/* Lector / Escáner de IMEI */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-700">
                  Escanear código con lector o buscar IMEI:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escanee IMEI aquí..."
                    value={transferImeiScanInput}
                    onChange={(e) => setTransferImeiScanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = transferImeiScanInput.trim().toUpperCase();
                        if (val) {
                          if (!selectedTransferImeis.includes(val)) {
                            setSelectedTransferImeis(prev => [...prev, val]);
                          }
                          setTransferImeiScanInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const avail = pendingTransferData.product.imeiList && pendingTransferData.product.imeiList.length > 0
                        ? pendingTransferData.product.imeiList
                        : (pendingTransferData.product.imei ? [pendingTransferData.product.imei] : []);
                      setSelectedTransferImeis(avail.slice(0, pendingTransferData.qty));
                    }}
                    className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-900 font-extrabold text-[11px] rounded-xl border border-blue-300 transition-all cursor-pointer whitespace-nowrap"
                  >
                    Auto-seleccionar
                  </button>
                </div>
              </div>

              {/* Lista de IMEIs para marcar/desmarcar */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-slate-600 font-bold text-[11px]">
                  <span>Marque los {pendingTransferData.qty} IMEIs que se traspasarán:</span>
                  <span className={`font-mono font-black ${selectedTransferImeis.length === pendingTransferData.qty ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {selectedTransferImeis.length} / {pendingTransferData.qty} seleccionados
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {(() => {
                    const avail = pendingTransferData.product.imeiList && pendingTransferData.product.imeiList.length > 0
                      ? pendingTransferData.product.imeiList
                      : (pendingTransferData.product.imei ? [pendingTransferData.product.imei] : []);

                    if (avail.length === 0) {
                      return (
                        <p className="p-3 text-center text-slate-400 italic">
                          No hay IMEIs registrados formalmente. Puede ingresar/escaneo manual arriba.
                        </p>
                      );
                    }

                    return avail.map((imei, idx) => {
                      const isChecked = selectedTransferImeis.includes(imei);
                      return (
                        <label
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-blue-50 border-blue-300 text-blue-950 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  if (!selectedTransferImeis.includes(imei)) {
                                    setSelectedTransferImeis(prev => [...prev, imei]);
                                  }
                                } else {
                                  setSelectedTransferImeis(prev => prev.filter(i => i !== imei));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <span>IMEI #{idx + 1}: <strong>{imei}</strong></span>
                          </div>
                          {isChecked && (
                            <span className="text-[10px] bg-blue-200 text-blue-900 font-extrabold px-1.5 py-0.5 rounded">
                              Seleccionado
                            </span>
                          )}
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsTransferImeiModalOpen(false);
                    setPendingTransferData(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer"
                >
                  Confirmar Traspaso con IMEIs
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* VENTANA EMERGENTE: SELECCIÓN DE IMEIS A DAR DE BAJA POR AJUSTE/MERMA */}
      {isAjustarImeiModalOpen && pendingAjustarData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-6 py-4 bg-amber-700 text-white">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-200" />
                <div>
                  <h3 className="font-extrabold text-base">Dar de Baja IMEIs por Ajuste / Merma</h3>
                  <p className="text-[11px] text-amber-100">{pendingAjustarData.product.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAjustarImeiModalOpen(false);
                  setPendingAjustarData(null);
                }}
                className="text-amber-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAjustarMermaWithImeis} className="p-6 space-y-4 text-xs">
              
              {/* Resumen del ajuste */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-950 font-bold">
                <div>
                  <span className="text-[10px] text-amber-800 uppercase font-black block">Ubicación / Motivo:</span>
                  <span>{OFFICIAL_BRANCHES.find(b => b.id === pendingAjustarData.branchId)?.name} • {pendingAjustarData.reason}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-amber-800 uppercase font-black block">Baja de Stock:</span>
                  <span className="font-mono text-sm font-black text-amber-900">-{pendingAjustarData.qty} equipo(s)</span>
                </div>
              </div>

              {/* Escáner de IMEI */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-700">
                  Escanear IMEI del equipo dañado/retirado:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escanee IMEI a eliminar..."
                    value={ajustarImeiScanInput}
                    onChange={(e) => setAjustarImeiScanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = ajustarImeiScanInput.trim().toUpperCase();
                        if (val) {
                          if (!selectedAjustarImeis.includes(val)) {
                            setSelectedAjustarImeis(prev => [...prev, val]);
                          }
                          setAjustarImeiScanInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-600 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const avail = pendingAjustarData.product.imeiList && pendingAjustarData.product.imeiList.length > 0
                        ? pendingAjustarData.product.imeiList
                        : (pendingAjustarData.product.imei ? [pendingAjustarData.product.imei] : []);
                      setSelectedAjustarImeis(avail.slice(0, pendingAjustarData.qty));
                    }}
                    className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 font-extrabold text-[11px] rounded-xl border border-amber-300 transition-all cursor-pointer whitespace-nowrap"
                  >
                    Auto-seleccionar
                  </button>
                </div>
              </div>

              {/* Lista de IMEIs disponibles para dar de baja */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-slate-600 font-bold text-[11px]">
                  <span>Seleccione los {pendingAjustarData.qty} IMEI(s) que serán eliminados del inventario:</span>
                  <span className={`font-mono font-black ${selectedAjustarImeis.length === pendingAjustarData.qty ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {selectedAjustarImeis.length} / {pendingAjustarData.qty} marcados
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {(() => {
                    const avail = pendingAjustarData.product.imeiList && pendingAjustarData.product.imeiList.length > 0
                      ? pendingAjustarData.product.imeiList
                      : (pendingAjustarData.product.imei ? [pendingAjustarData.product.imei] : []);

                    if (avail.length === 0) {
                      return (
                        <p className="p-3 text-center text-slate-400 italic">
                          No hay IMEIs registrados en este producto.
                        </p>
                      );
                    }

                    return avail.map((imei, idx) => {
                      const isChecked = selectedAjustarImeis.includes(imei);
                      return (
                        <label
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-amber-100 border-amber-300 text-amber-950 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  if (!selectedAjustarImeis.includes(imei)) {
                                    setSelectedAjustarImeis(prev => [...prev, imei]);
                                  }
                                } else {
                                  setSelectedAjustarImeis(prev => prev.filter(i => i !== imei));
                                }
                              }}
                              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                            />
                            <span>IMEI #{idx + 1}: <strong>{imei}</strong></span>
                          </div>
                          {isChecked && (
                            <span className="text-[10px] bg-red-200 text-red-900 font-extrabold px-1.5 py-0.5 rounded">
                              Eliminar
                            </span>
                          )}
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAjustarImeiModalOpen(false);
                    setPendingAjustarData(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer"
                >
                  Confirmar Baja de IMEI(s)
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal 8: Confirmación de Seguridad (Contraseña para Traspasos o Ajustes) */}
      {isSecurityModalOpen && pendingSecurityCallback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className={`flex items-center justify-between px-6 py-4 text-white ${
              pendingSecurityCallback.type === 'traspaso' ? 'bg-blue-900' : 'bg-amber-800'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-base">Confirmación de Seguridad</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSecurityModalOpen(false);
                  setPendingSecurityCallback(null);
                }}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSecurityAuth} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  pendingSecurityCallback.type === 'traspaso'
                    ? 'bg-blue-100 text-blue-900'
                    : 'bg-amber-100 text-amber-900'
                }`}>
                  {pendingSecurityCallback.type === 'traspaso' ? 'Solicitud de Traspaso' : 'Solicitud de Ajuste'}
                </span>
                <p className="font-extrabold text-xs text-slate-900">
                  {pendingSecurityCallback.title}
                </p>
                <p className="text-[11px] font-medium text-slate-600">
                  {pendingSecurityCallback.description}
                </p>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-600" />
                  Contraseña de Autorización *
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Ingresa contraseña de autorización..."
                  value={securityPassword}
                  onChange={(e) => {
                    setSecurityPassword(e.target.value);
                    if (securityError) setSecurityError('');
                  }}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-600"
                />
                {securityError && (
                  <p className="mt-1 text-[11px] font-bold text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {securityError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSecurityModalOpen(false);
                    setPendingSecurityCallback(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer ${
                    pendingSecurityCallback.type === 'traspaso'
                      ? 'bg-blue-800 hover:bg-blue-900'
                      : 'bg-amber-700 hover:bg-amber-800'
                  }`}
                >
                  Autorizar y Confirmar
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 0: HISTORIAL DE MOVIMIENTOS DE LOS ÚLTIMOS 15 DÍAS */}
      <InventoryMovementsModal
        isOpen={isMovementsModalOpen}
        onClose={() => setIsMovementsModalOpen(false)}
        movements={inventoryMovements}
        currentBranch={currentBranch || OFFICIAL_BRANCHES[0]}
        branches={allBranches}
      />

      {/* MODAL DE IMPRESIÓN Y REPORTE DE INVENTARIO */}
      <InventoryPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        products={products}
        currentBranch={currentBranch}
        currentOperator={currentOperator}
        allBranches={allBranches}
        initialCategory={activeInventoryTab}
      />

      {/* MODAL DE IMPRESIÓN DE ETIQUETAS CON CÓDIGO DE BARRAS */}
      <ProductLabelsModal
        isOpen={isLabelsModalOpen}
        onClose={() => {
          setIsLabelsModalOpen(false);
          setLabelSelectedProduct(null);
        }}
        products={products}
        currentBranch={currentBranch}
        allBranches={allBranches}
        initialSelectedProduct={labelSelectedProduct}
      />

      {/* MODAL DE MODIFICACIÓN / EDICIÓN DE REGISTRO (TELÉFONOS Y ARTÍCULOS) */}
      <EditProductModal
        isOpen={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
        product={editingProduct}
        products={tabProducts}
        onSave={handleSaveEditedProduct}
        currentOperator={currentOperator}
        branches={allBranches}
      />

    </div>
  );
}
