import React, { useState } from 'react';
import { 
  Users, 
  ShieldAlert, 
  UserPlus, 
  Key, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Lock, 
  CheckCircle2, 
  X, 
  Building2, 
  Search, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle,
  Settings,
  RefreshCw
} from 'lucide-react';
import { Operator, Branch } from '../types';

interface SettingsModuleProps {
  operators: Operator[];
  onUpdateOperators: (newOperators: Operator[]) => void;
  currentOperator: Operator;
  currentBranch: Branch;
  allBranches: Branch[];
}

export default function SettingsModule({
  operators,
  onUpdateOperators,
  currentOperator,
  currentBranch,
  allBranches,
}: SettingsModuleProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  
  // Modal states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);

  // Form State for User Create/Edit
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'manager' | 'cashier'>('cashier');
  const [formBranchIds, setFormBranchIds] = useState<string[]>([]);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Quick Change Password Modal
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [targetPasswordOperator, setTargetPasswordOperator] = useState<Operator | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);

  // Reveal password state in table
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Check if logged-in user is the Main Admin (Admin Principal)
  const isMainAdmin = currentOperator.isMainAdmin || currentOperator.id === 'o1' || (currentOperator.role === 'admin' && currentOperator.username === 'admin');

  // Toggle reveal password for a specific operator in table
  const togglePasswordVisibility = (opId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [opId]: !prev[opId],
    }));
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingOperator(null);
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormConfirmPassword('');
    setFormRole('cashier');
    setFormBranchIds([currentBranch.id]);
    setShowFormPassword(false);
    setModalError(null);
    setIsUserModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (op: Operator) => {
    setEditingOperator(op);
    setFormName(op.name);
    setFormUsername(op.username);
    setFormPassword(op.password || '');
    setFormConfirmPassword(op.password || '');
    setFormRole(op.role);
    setFormBranchIds(op.branchIds || []);
    setShowFormPassword(false);
    setModalError(null);
    setIsUserModalOpen(true);
  };

  // Open Change Password Modal
  const handleOpenChangePasswordModal = (op: Operator) => {
    setTargetPasswordOperator(op);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setPasswordChangeSuccess(null);
    setModalError(null);
    setIsChangePasswordModalOpen(true);
  };

  // Save User (Create or Update)
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanName = formName.trim();
    const cleanUsername = formUsername.trim().toLowerCase();
    const cleanPassword = formPassword.trim();

    if (!cleanName) {
      setModalError('Ingrese el nombre completo del usuario.');
      return;
    }

    if (!cleanUsername) {
      setModalError('Ingrese un nombre de usuario para el inicio de sesión.');
      return;
    }

    // Check username duplicate
    const existingUser = operators.find(
      (op) => op.username.toLowerCase() === cleanUsername && op.id !== editingOperator?.id
    );

    if (existingUser) {
      setModalError(`El usuario '${cleanUsername}' ya está registrado en el sistema. Elija otro nombre de usuario.`);
      return;
    }

    if (!cleanPassword) {
      setModalError('Escriba la contraseña para el usuario.');
      return;
    }

    if (cleanPassword !== formConfirmPassword.trim()) {
      setModalError('Las contraseñas ingresadas no coinciden. Verifique los campos.');
      return;
    }

    if (formBranchIds.length === 0) {
      setModalError('Seleccione al menos una sucursal permitida para este operador.');
      return;
    }

    if (editingOperator) {
      // Update
      const updatedList = operators.map((op) => {
        if (op.id === editingOperator.id) {
          return {
            ...op,
            name: cleanName,
            username: cleanUsername,
            password: cleanPassword,
            role: formRole,
            branchIds: formBranchIds,
          };
        }
        return op;
      });
      onUpdateOperators(updatedList);
    } else {
      // Create New
      const newOp: Operator = {
        id: `op-${Date.now()}`,
        name: cleanName,
        username: cleanUsername,
        password: cleanPassword,
        role: formRole,
        branchIds: formBranchIds,
        isMainAdmin: false,
        createdAt: new Date().toISOString().split('T')[0],
      };
      onUpdateOperators([...operators, newOp]);
    }

    setIsUserModalOpen(false);
  };

  // Submit Password Change Only
  const handleSavePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPasswordOperator) return;

    setModalError(null);
    const cleanPass = newPassword.trim();

    if (!cleanPass) {
      setModalError('Escriba la nueva contraseña.');
      return;
    }

    if (cleanPass !== confirmNewPassword.trim()) {
      setModalError('Las contraseñas no coinciden.');
      return;
    }

    const updatedList = operators.map((op) => {
      if (op.id === targetPasswordOperator.id) {
        return {
          ...op,
          password: cleanPass,
        };
      }
      return op;
    });

    onUpdateOperators(updatedList);
    setPasswordChangeSuccess(`Contraseña de ${targetPasswordOperator.name} actualizada correctamente.`);
    setTimeout(() => {
      setIsChangePasswordModalOpen(false);
    }, 1200);
  };

  // Delete User
  const handleDeleteUser = (op: Operator) => {
    if (op.isMainAdmin || op.id === 'o1') {
      alert('❌ OPERACIÓN DENEGADA: No se puede eliminar la cuenta del Administrador Principal.');
      return;
    }

    if (op.id === currentOperator.id) {
      alert('❌ OPERACIÓN DENEGADA: No puedes eliminar tu propio usuario activo en esta sesión.');
      return;
    }

    const confirmDelete = window.confirm(
      `¿Está seguro de eliminar al usuario '${op.name}' (${op.username}) del sistema? Ya no podrá acceder al punto de venta.`
    );

    if (confirmDelete) {
      const updated = operators.filter((o) => o.id !== op.id);
      onUpdateOperators(updated);
    }
  };

  // Filtered operators list
  const filteredOperators = operators.filter((op) => {
    const matchesSearch =
      op.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRoleFilter === 'all' || op.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      
      {/* Module Title Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-black tracking-tight">Módulo de Configuración y Control de Usuarios</h1>
          </div>
          <p className="text-xs text-slate-300 font-medium">
            Gestión centralizada de credenciales (usuarios y contraseñas), asignación de sucursales y permisos del sistema.
          </p>
        </div>

        {/* Admin Principal Badge */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700">
          <ShieldCheck className={`w-5 h-5 ${isMainAdmin ? 'text-emerald-400' : 'text-amber-400'}`} />
          <div className="text-left">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estado de Permisos</span>
            <span className="text-xs font-black text-white">
              {isMainAdmin ? '👑 Admin Principal (Edición Habilitada)' : '👁️ Solo Lectura (Usuario Estándar)'}
            </span>
          </div>
        </div>
      </div>

      {/* RESTRICTION WARNING IF NOT MAIN ADMIN */}
      {!isMainAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 animate-in fade-in">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-sm text-amber-950">Acceso de Edición Restringido</h4>
            <p className="text-xs mt-0.5 leading-relaxed text-amber-900">
              Únicamente el <strong>Administrador Principal (Admin Principal)</strong> tiene autorización para crear nuevos usuarios, modificar contraseñas y alterar los roles o asignación de sucursales. A continuación se muestra el directorio activo de personal en modo consulta.
            </p>
          </div>
        </div>
      )}

      {/* SEARCH AND ACTION BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search & Filter */}
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 w-full">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="w-full sm:w-44 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="manager">Gerentes</option>
            <option value="cashier">Cajeros</option>
          </select>
        </div>

        {/* Create Button (Only for Admin Principal) */}
        {isMainAdmin && (
          <button
            onClick={handleOpenCreateModal}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Usuario / Operador
          </button>
        )}
      </div>

      {/* OPERATORS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h3 className="font-extrabold text-sm text-slate-900">Directorio de Usuarios y Contraseñas Registradas</h3>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-0.5 rounded-full">
            {filteredOperators.length} Operadores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Usuario / Nombre</th>
                <th className="px-4 py-3.5">Nombre de Usuario (Login)</th>
                <th className="px-4 py-3.5">Rol de Sistema</th>
                <th className="px-4 py-3.5">Sucursal Asignada</th>
                <th className="px-4 py-3.5">Contraseña de Acceso</th>
                {isMainAdmin && <th className="px-4 py-3.5 text-center">Acciones Administrador</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredOperators.map((op) => {
                const isRevealed = !!revealedPasswords[op.id];
                const isCurrentSelf = op.id === currentOperator.id;

                return (
                  <tr key={op.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Name & Avatar */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white ${
                          op.isMainAdmin ? 'bg-amber-500' : op.role === 'admin' ? 'bg-blue-600' : 'bg-slate-600'
                        }`}>
                          {op.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong className="text-slate-900 font-bold text-xs block">{op.name}</strong>
                          {op.isMainAdmin && (
                            <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded font-extrabold border border-amber-300">
                              Admin Principal
                            </span>
                          )}
                          {isCurrentSelf && (
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-bold border border-blue-200 ml-1">
                              (Sesión Actual)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Username */}
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-900">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 font-mono text-blue-900">
                        {op.username}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                        op.role === 'admin' 
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : op.role === 'manager'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        {op.role === 'admin' ? 'Administrador' : op.role === 'manager' ? 'Gerente' : 'Cajero'}
                      </span>
                    </td>

                    {/* Assigned Branch */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 items-center">
                        {op.branchIds && op.branchIds.length > 0 ? (
                          op.branchIds.map((bId) => {
                            const branchObj = allBranches.find((b) => b.id === bId);
                            return (
                              <span
                                key={bId}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-900 text-[11px] font-black rounded-lg border border-blue-200"
                              >
                                <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                                {branchObj ? branchObj.name : bId}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Sin sucursal asignada</span>
                        )}
                      </div>
                    </td>

                    {/* Password View/Hide */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800 tracking-wider bg-slate-50 px-2.5 py-1 rounded border border-slate-200 min-w-[80px] text-center">
                          {isRevealed ? (op.password || '123') : '••••••••'}
                        </span>
                        
                        {isMainAdmin && (
                          <button
                            onClick={() => togglePasswordVisibility(op.id)}
                            className="p-1 text-slate-500 hover:text-slate-900 transition-colors"
                            title={isRevealed ? 'Ocultar contraseña' : 'Ver contraseña'}
                          >
                            {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Admin Actions */}
                    {isMainAdmin && (
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenChangePasswordModal(op)}
                            className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                            title="Cambiar contraseña de este usuario"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-600" />
                            Clave
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(op)}
                            className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all cursor-pointer"
                            title="Editar usuario"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {!op.isMainAdmin && op.id !== 'o1' && op.id !== currentOperator.id && (
                            <button
                              onClick={() => handleDeleteUser(op)}
                              className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-all cursor-pointer"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {filteredOperators.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                    No se encontraron usuarios con el criterio de búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingOperator ? `Editar Usuario: ${editingOperator.name}` : 'Registrar Nuevo Usuario u Operador'}
                </h3>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Notification inside modal */}
            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-900 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4">
              
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Completo del Operador *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Ana Martínez"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>

              {/* Username (Login) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de Usuario (Para Iniciar Sesión) *
                </label>
                <input
                  type="text"
                  placeholder="Ej. amartinez"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Este es el identificador único con el que ingresará al punto de venta.
                </p>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Contraseña *</span>
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      {showFormPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </label>
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirmar Contraseña *
                  </label>
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formConfirmPassword}
                    onChange={(e) => setFormConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rol y Nivel de Permisos *
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  <option value="cashier">Cajero / Vendedor (Acceso restringido solo al Punto de Venta)</option>
                  <option value="manager">Gerente de Sucursal (Acceso a Inventario y Ventas)</option>
                  <option value="admin">Administrador (Acceso Total a todos los módulos)</option>
                </select>
              </div>

              {/* Branch Assignment */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Sucursal Asignada (Acceso Automático) *
                  </label>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-blue-600" />
                    Asignación Automática
                  </span>
                </div>
                
                <p className="text-[11px] text-slate-500 mb-2">
                  El usuario ingresará directamente a esta sucursal sin necesidad de seleccionarla en la pantalla de acceso.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {allBranches.map((branch) => {
                    const isChecked = formBranchIds.includes(branch.id);
                    return (
                      <button
                        type="button"
                        key={branch.id}
                        onClick={() => {
                          // Allow setting single primary branch or toggling
                          setFormBranchIds([branch.id]);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer text-left ${
                          isChecked 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm ring-2 ring-blue-600/20' 
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className={`w-4 h-4 ${isChecked ? 'text-white' : 'text-slate-400'}`} />
                          <span>{branch.name}</span>
                        </div>
                        {isChecked && (
                          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  {editingOperator ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* QUICK CHANGE PASSWORD MODAL */}
      {isChangePasswordModalOpen && targetPasswordOperator && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  Cambiar Contraseña
                </h3>
              </div>
              <button
                onClick={() => setIsChangePasswordModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
              Cambiando contraseña para: <strong className="text-amber-950 font-black">{targetPasswordOperator.name}</strong> (@{targetPasswordOperator.username})
            </div>

            {passwordChangeSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordChangeSuccess}</span>
              </div>
            )}

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-900 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSavePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Nueva Contraseña *</span>
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    {showNewPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Escriba nueva clave..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar Nueva Contraseña *
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Repita la nueva clave..."
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  Actualizar Contraseña
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
