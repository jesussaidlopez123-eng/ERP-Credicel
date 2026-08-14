import React, { useState } from 'react';
import { Wrench, Search, Plus, Trash2, Edit3, X, CheckCircle2, ShoppingCart, Smartphone, Battery, Zap, Lock, ListFilter } from 'lucide-react';
import { RepairPriceItem, Product, CartItemMetadata } from '../types';

interface RepairPriceCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  repairPrices: RepairPriceItem[];
  onAddRepairPrice: (item: RepairPriceItem) => void;
  onUpdateRepairPrice: (item: RepairPriceItem) => void;
  onDeleteRepairPrice: (id: string) => void;
  onAddToCart?: (product: Product, price: number, metadata?: CartItemMetadata) => void;
}

export default function RepairPriceCatalogModal({
  isOpen,
  onClose,
  isAdmin,
  repairPrices,
  onAddRepairPrice,
  onUpdateRepairPrice,
  onDeleteRepairPrice,
  onAddToCart
}: RepairPriceCatalogModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Admin Form state for Adding/Editing
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [brand, setBrand] = useState('Apple');
  const [model, setModel] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [category, setCategory] = useState<'Pantalla' | 'Batería' | 'Centro de Carga' | 'Desbloqueo' | 'Otro'>('Pantalla');
  const [price, setPrice] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const CATEGORIES = [
    { id: 'all', label: 'Todas', icon: ListFilter },
    { id: 'Pantalla', label: 'Pantalla', icon: Smartphone },
    { id: 'Batería', label: 'Batería', icon: Battery },
    { id: 'Centro de Carga', label: 'Centro de Carga', icon: Zap },
    { id: 'Desbloqueo', label: 'Desbloqueo', icon: Lock }
  ];

  // Helper to resolve category for items missing explicit category
  const getCategoryOfItem = (item: RepairPriceItem): string => {
    if (item.category) return item.category;
    const name = (item.serviceName + ' ' + item.model).toLowerCase();
    if (name.includes('pantalla') || name.includes('display') || name.includes('oled') || name.includes('lcd')) return 'Pantalla';
    if (name.includes('batería') || name.includes('bateria')) return 'Batería';
    if (name.includes('carga') || name.includes('pin') || name.includes('tipo c') || name.includes('flex')) return 'Centro de Carga';
    if (name.includes('desbloqueo') || name.includes('frp') || name.includes('cuenta') || name.includes('bypass')) return 'Desbloqueo';
    return 'Otro';
  };

  // Filter prices by Category and Search Query
  const filteredPrices = repairPrices.filter((item) => {
    const itemCat = getCategoryOfItem(item);
    const matchesCat = selectedCategory === 'all' || itemCat === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      item.model.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.serviceName.toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  const handleOpenCreateForm = () => {
    setEditingId(null);
    setBrand('Apple');
    setModel('');
    setServiceName('');
    setCategory('Pantalla');
    setPrice('');
    setEstimatedTime('45 mins');
    setNotes('');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item: RepairPriceItem) => {
    setEditingId(item.id);
    setBrand(item.brand || 'Apple');
    setModel(item.model);
    setServiceName(item.serviceName);
    setCategory((item.category as any) || (getCategoryOfItem(item) as any));
    setPrice(item.price.toString());
    setEstimatedTime(item.estimatedTime || '');
    setNotes(item.notes || '');
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!model.trim() || !serviceName.trim() || !price) {
      alert('Por favor completa los campos obligatorios (Modelo, Servicio y Precio).');
      return;
    }

    const numPrice = parseFloat(price) || 0;

    if (editingId) {
      const updatedItem: RepairPriceItem = {
        id: editingId,
        brand: brand.trim(),
        model: model.trim(),
        serviceName: serviceName.trim(),
        category,
        price: numPrice,
        estimatedTime: estimatedTime.trim() || undefined,
        notes: notes.trim() || undefined
      };
      onUpdateRepairPrice(updatedItem);
      alert('✅ Precio de reparación actualizado correctamente.');
    } else {
      const newItem: RepairPriceItem = {
        id: `rep-price-${Date.now()}`,
        brand: brand.trim(),
        model: model.trim(),
        serviceName: serviceName.trim(),
        category,
        price: numPrice,
        estimatedTime: estimatedTime.trim() || undefined,
        notes: notes.trim() || undefined
      };
      onAddRepairPrice(newItem);
      alert('✅ Nuevo modelo y precio de reparación agregado con éxito.');
    }

    setIsFormOpen(false);
  };

  const handleLoadToCart = (item: RepairPriceItem) => {
    if (!onAddToCart) return;

    const repairProduct: Product = {
      id: `prod-rep-${Date.now()}`,
      code: `REP-${item.brand.substring(0, 3).toUpperCase()}`,
      name: `Reparación: ${item.model} - ${item.serviceName}`,
      category: 'servicio',
      price: item.price,
      stock: 1
    };

    onAddToCart(repairProduct, item.price, {
      deviceModel: `${item.brand} ${item.model}`,
      issueDescription: item.serviceName,
      totalRepairCost: item.price
    });

    alert(`✅ Se agregó "${item.model} (${item.serviceName})" al ticket de venta por $${item.price.toFixed(2)} MXN.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 bg-amber-600 text-white flex items-center justify-between border-b border-amber-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-700/80 rounded-xl text-white">
              <Wrench className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">Lista de Precios de Reparaciones</h3>
              <p className="text-xs text-amber-100 font-medium">
                Consulta y cotización rápida para operador de mostrador y cliente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && !isFormOpen && (
              <button
                onClick={handleOpenCreateForm}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Agregar Precio
              </button>
            )}

            <button
              onClick={onClose}
              className="text-amber-100 hover:text-white p-1.5 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Admin Add/Edit Form */}
        {isFormOpen && (
          <form onSubmit={handleSaveForm} className="p-4 bg-amber-50/90 border-b border-amber-200 space-y-3 shrink-0">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-700" />
                {editingId ? 'Editar Modelo y Precio' : 'Agregar Nuevo Modelo y Precio de Reparación'}
              </h4>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Pantalla">Pantalla</option>
                  <option value="Batería">Batería</option>
                  <option value="Centro de Carga">Centro de Carga</option>
                  <option value="Desbloqueo">Desbloqueo</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Marca</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Apple, Samsung, Motorola..."
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo del Celular</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. iPhone 13, Moto G60..."
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Detalle del Servicio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cambio de pantalla OLED..."
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Precio ($ MXN)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tiempo Estimado (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. 45 mins"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notas / Garantía (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Incluye mica de regalo"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {editingId ? 'Guardar Cambios' : 'Registrar en Tarifario'}
              </button>
            </div>
          </form>
        )}

        {/* CATEGORY TABS (4 CATEGORÍAS: Pantalla, Batería, Centro de Carga, Desbloqueo) & SEARCH */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              const count = cat.id === 'all' 
                ? repairPrices.length 
                : repairPrices.filter((p) => getCategoryOfItem(p) === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-amber-600'}`} />
                  {cat.label}
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                    isSelected ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search Bar */}
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar modelo o servicio (ej. iPhone 11, Galaxy A54, Moto G60)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 focus:border-amber-500 rounded-xl text-xs font-medium text-slate-900 focus:outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* CLEAN TABLE LIST (MODELO | SERVICIO | PRECIO) */}
        <div className="flex-1 overflow-y-auto p-3 bg-white">
          {filteredPrices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Smartphone className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-xs font-semibold text-slate-700">No se encontraron precios para esta categoría o búsqueda.</p>
              <p className="text-[11px] text-slate-400">Prueba cambiando la categoría o borrando el término de búsqueda.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Modelo / Marca</th>
                    <th className="py-2.5 px-3">Servicio</th>
                    <th className="py-2.5 px-3 text-right">Precio</th>
                    <th className="py-2.5 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPrices.map((item) => (
                    <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                      {/* MODELO */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{item.model}</span>
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            {item.brand}
                          </span>
                        </div>
                      </td>

                      {/* SERVICIO */}
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        <div>
                          <span>{item.serviceName}</span>
                          {item.notes && (
                            <span className="block text-[10px] text-slate-400 italic">
                              {item.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PRECIO */}
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 text-sm whitespace-nowrap">
                        ${item.price.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">MXN</span>
                      </td>

                      {/* ACCIÓN */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {onAddToCart && (
                            <button
                              type="button"
                              onClick={() => handleLoadToCart(item)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              title="Cargar esta reparación al ticket de venta"
                            >
                              <ShoppingCart className="w-3 h-3" />
                              Cargar
                            </button>
                          )}

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditForm(item)}
                                className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-100 rounded-md transition-colors cursor-pointer"
                                title="Editar precio"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`¿Eliminar la cotización de ${item.model} (${item.serviceName})?`)) {
                                    onDeleteRepairPrice(item.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-md transition-colors cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs shrink-0">
          <span className="text-slate-500 font-medium">
            Registros visibles: <strong className="text-slate-900">{filteredPrices.length}</strong> de {repairPrices.length}
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
