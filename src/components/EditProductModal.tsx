import React, { useState, useEffect } from 'react';
import { 
  Pencil, 
  X, 
  Lock, 
  DollarSign, 
  Building2, 
  Smartphone, 
  Headphones, 
  CheckCircle2, 
  ShieldCheck, 
  Tag, 
  AlertCircle,
  Palette,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Product, Branch, Operator } from '../types';

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  products?: Product[];
  onSave: (updatedProduct: Product) => void;
  onSelectProduct?: (product: Product) => void;
  currentOperator?: Operator;
  branches?: Branch[];
}

export default function EditProductModal({
  isOpen,
  onClose,
  product: initialProduct,
  products = [],
  onSave,
  onSelectProduct,
  currentOperator,
  branches = []
}: EditProductModalProps) {
  const [currentProduct, setCurrentProduct] = useState<Product | null>(initialProduct);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [supplier, setSupplier] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state when product or isOpen changes
  useEffect(() => {
    const activeProd = initialProduct || (products.length > 0 ? products[0] : null);
    setCurrentProduct(activeProd);
    if (activeProd) {
      setName(activeProd.name || '');
      setBrand(activeProd.brand || '');
      setModel(activeProd.model || '');
      setColor(activeProd.color || '');
      setSupplier(activeProd.supplier || '');
      setCostPrice(activeProd.costPrice !== undefined ? activeProd.costPrice.toString() : '0');
      setPrice(activeProd.price !== undefined ? activeProd.price.toString() : '0');
      setCategory(activeProd.category || (activeProd.inventoryType === 'equipo' ? 'equipo_credito' : 'accesorio'));
      setSaveSuccess(false);
      setErrorMsg('');
    }
  }, [initialProduct, isOpen, products]);

  const handleProductSwitch = (prodId: string) => {
    const found = products.find(p => p.id === prodId);
    if (found) {
      setCurrentProduct(found);
      setName(found.name || '');
      setBrand(found.brand || '');
      setModel(found.model || '');
      setColor(found.color || '');
      setSupplier(found.supplier || '');
      setCostPrice(found.costPrice !== undefined ? found.costPrice.toString() : '0');
      setPrice(found.price !== undefined ? found.price.toString() : '0');
      setCategory(found.category || (found.inventoryType === 'equipo' ? 'equipo_credito' : 'accesorio'));
      setErrorMsg('');
      if (onSelectProduct) {
        onSelectProduct(found);
      }
    }
  };

  if (!isOpen || !currentProduct) return null;

  const isEquipo = (currentProduct.inventoryType || (currentProduct.category === 'equipo_credito' ? 'equipo' : 'accesorio')) === 'equipo';
  
  const imeiList = currentProduct.imeiList && currentProduct.imeiList.length > 0 
    ? currentProduct.imeiList 
    : (currentProduct.imei ? [currentProduct.imei] : []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('El nombre o modelo del producto es obligatorio.');
      return;
    }

    const numCost = parseFloat(costPrice);
    const numPrice = parseFloat(price);

    if (isNaN(numCost) || numCost < 0) {
      setErrorMsg('El Precio Inicial (Costo de Compra) debe ser un número válido mayor o igual a $0.00.');
      return;
    }

    if (isNaN(numPrice) || numPrice < 0) {
      setErrorMsg('El Precio Final (Venta) debe ser un número válido mayor o igual a $0.00.');
      return;
    }

    // STRICT CONSTRAINT: The original `code`, `imei`, `imeiList`, and `branchImeiMap` are preserved identically and never mutated
    const updatedProduct: Product = {
      ...currentProduct,
      name: name.trim(),
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      color: color.trim() || undefined,
      supplier: supplier.trim() || undefined,
      costPrice: numCost,
      price: numPrice,
      category: category.trim() || currentProduct.category,
      // Immutable fields explicitly preserved:
      id: currentProduct.id,
      code: currentProduct.code,
      imei: currentProduct.imei,
      imeiList: currentProduct.imeiList,
      branchImeiMap: currentProduct.branchImeiMap,
      stock: currentProduct.stock,
      branchStock: currentProduct.branchStock,
      inventoryType: currentProduct.inventoryType
    };

    onSave(updatedProduct);
    setSaveSuccess(true);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* ENCABEZADO */}
        <div className={`flex items-center justify-between px-6 py-4 text-white ${
          isEquipo ? 'bg-blue-900' : 'bg-slate-900'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isEquipo ? 'bg-blue-800 text-amber-300' : 'bg-slate-800 text-blue-300'}`}>
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <span>Modificar Registro de {isEquipo ? 'Equipo Celular' : 'Artículo'}</span>
                <span className="text-[10px] bg-white/20 text-white font-mono px-2 py-0.5 rounded-md font-bold">
                  {currentProduct.code}
                </span>
              </h3>
              <p className="text-[11px] text-slate-200">
                Actualiza datos generales, proveedor y precios sin alterar códigos ni IMEIs
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            type="button"
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MENSAJE DE ÉXITO */}
        {saveSuccess ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-black text-slate-900">¡Registro Actualizado Correctamente!</h4>
            <p className="text-xs text-slate-600">
              Los cambios han sido guardados y sincronizados en la nube.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            
            {/* ALERTA DE ERROR SI EXISTE */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* SELECTOR DE PRODUCTO SI HAY VARIOS */}
            {products && products.length > 1 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <label className="block text-[11px] font-extrabold text-slate-700">
                  Seleccionar Producto / Celular a Modificar:
                </label>
                <div className="relative">
                  <select
                    value={currentProduct.id}
                    onChange={(e) => handleProductSwitch(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none appearance-none"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name} {p.supplier ? `(Prov: ${p.supplier})` : ''} - Costo: ${p.costPrice?.toFixed(2) || '0.00'} / Venta: ${p.price?.toFixed(2) || '0.00'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* SECCIÓN 1: CAMPOS PROTEGIDOS (CÓDIGO E IMEIS INMUTABLES) */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-wider uppercase text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Datos Protegidos e Inmutables
                </span>
                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                  No editables por trazabilidad
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* CÓDIGO INMUTABLE */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Código de Producto:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      disabled
                      value={currentProduct.code}
                      className="w-full pl-3 pr-8 py-2 bg-slate-200 border border-slate-300 rounded-xl text-xs font-mono font-black text-slate-700 cursor-not-allowed select-none"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Identificador permanente de inventario</span>
                </div>

                {/* TIPO / CATEGORÍA ACTUAL */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Tipo de Inventario:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      disabled
                      value={isEquipo ? 'Equipo Celular (Smartphone)' : 'Accesorio'}
                      className="w-full pl-3 pr-8 py-2 bg-slate-200 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-700 cursor-not-allowed select-none"
                    />
                    {isEquipo ? (
                      <Smartphone className="w-3.5 h-3.5 text-blue-600 absolute right-3 top-1/2 -translate-y-1/2" />
                    ) : (
                      <Headphones className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Clasificación de catálogo</span>
                </div>
              </div>

              {/* LISTA DE IMEIS INMUTABLES (SOLO PARA EQUIPOS) */}
              {isEquipo && (
                <div className="pt-2 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                      <span>IMEIs Registrados ({imeiList.length}):</span>
                    </label>
                    <span className="text-[9px] text-slate-500 italic">
                      Protegidos contra edición
                    </span>
                  </div>

                  {imeiList.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">Sin IMEIs registrados</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-slate-100/80 rounded-lg border border-slate-200">
                      {imeiList.map((im, idx) => (
                        <span 
                          key={idx} 
                          className="font-mono text-[10px] font-bold bg-white text-slate-800 px-2 py-0.5 rounded border border-slate-300 shadow-2xs flex items-center gap-1"
                        >
                          <Lock className="w-2.5 h-2.5 text-slate-400" />
                          #{idx + 1}: {im}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN 2: CAMPOS EDITABLES */}
            <div className="space-y-3.5 pt-1">
              
              {/* NOMBRE / MODELO */}
              <div>
                <label className="block text-xs font-extrabold text-slate-900 mb-1">
                  {isEquipo ? 'Nombre o Modelo del Teléfono *' : 'Nombre del Producto / Accesorio *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Samsung Galaxy A54 128GB Negro"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* MARCA, MODELO ESPECÍFICO Y COLOR */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-400" />
                    Marca:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Samsung, Apple, Xiaomi..."
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-400" />
                    Modelo:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Galaxy A54, iPhone 13..."
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Palette className="w-3 h-3 text-slate-400" />
                    Color:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Negro, Azul, Blanco..."
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* PROVEEDOR */}
              <div>
                <label className="block text-xs font-extrabold text-slate-900 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  Proveedor / Distribuidor:
                </label>
                <input
                  type="text"
                  placeholder="Ej. Distribuidor Celular Telcel / Macropay / Mayorista Central"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* PRECIOS: INICIAL (COSTO) Y FINAL (VENTA) */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                <span className="text-[10px] font-black tracking-wider uppercase text-blue-900 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                  Actualización de Precios
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* PRECIO INICIAL / COSTO DE COMPRA */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-800 mb-1">
                      Precio Inicial (Costo de Compra) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-extrabold text-slate-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={costPrice}
                        onChange={(e) => setCostPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-black text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* PRECIO FINAL / VENTA */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-800 mb-1">
                      Precio Final (Precio de Venta) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-extrabold text-slate-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-black text-emerald-950 bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`flex items-center gap-1.5 px-5 py-2 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer ${
                  isEquipo
                    ? 'bg-blue-700 hover:bg-blue-800 shadow-blue-200'
                    : 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Guardar Modificaciones
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
