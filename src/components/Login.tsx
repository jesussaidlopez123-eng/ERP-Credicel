import React, { useState } from 'react';
import { Store, User, Lock, ArrowRight, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Branch, Operator } from '../types';
import Logo from './Logo';
import { INITIAL_OPERATORS } from '../data/initialOperators';
import { ALL_BRANCHES } from '../data/initialBranches';

interface LoginProps {
  onLogin: (branch: Branch, operator: Operator) => void;
  operators?: Operator[];
  branches?: Branch[];
}

export default function Login({ 
  onLogin, 
  operators = INITIAL_OPERATORS, 
  branches = ALL_BRANCHES 
}: LoginProps) {
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Selected operator object
  const selectedOperator = operators.find((o) => o.id === selectedOperatorId);

  // Automatically resolve the branch assigned to this operator in Administration
  const assignedBranch: Branch = React.useMemo(() => {
    if (!selectedOperator) return branches[0];
    const assignedBranchId = selectedOperator.branchIds && selectedOperator.branchIds.length > 0 
      ? selectedOperator.branchIds[0] 
      : branches[0]?.id;
    return branches.find((b) => b.id === assignedBranchId) || branches[0];
  }, [selectedOperator, branches]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedOperatorId) {
      setError('Por favor, selecciona tu usuario de operador.');
      return;
    }

    if (!password) {
      setError('Por favor, ingresa tu contraseña de acceso.');
      return;
    }

    const operator = operators.find((o) => o.id === selectedOperatorId);

    if (!operator) {
      setError('Usuario u operador no encontrado en el sistema.');
      return;
    }

    // Strict Password Validation against configured operator password
    const expectedPassword = operator.password !== undefined ? operator.password : '123';

    if (password !== expectedPassword) {
      setError(`❌ Contraseña incorrecta para '${operator.name}'. Verifique sus credenciales.`);
      return;
    }

    // Automatic direct login to the branch assigned to this operator in Administration
    onLogin(assignedBranch, operator);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-950 border-b border-slate-800 px-8 py-8 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center justify-center">
            {/* Logo */}
            <div className="mb-4">
              <Logo size="lg" theme="dark" />
            </div>
            <h1 className="text-lg font-black text-white tracking-tight">Acceso al Sistema ERP</h1>
            <p className="text-slate-400 mt-1 text-xs font-medium">
              Ingreso automático a la sucursal asignada
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Operator Selection */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1.5 uppercase tracking-wider">
                Usuario / Operador
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <select
                  value={selectedOperatorId}
                  onChange={(e) => {
                    setSelectedOperatorId(e.target.value);
                    setPassword('');
                    setError('');
                  }}
                  className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-extrabold focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-xs transition-shadow"
                >
                  <option value="" disabled>-- Selecciona tu usuario --</option>
                  {operators.map((operator) => {
                    const opBranch = branches.find((b) => operator.branchIds?.includes(b.id)) || branches[0];
                    return (
                      <option key={operator.id} value={operator.id}>
                        {operator.name} (@{operator.username}) • {opBranch?.name || 'Sucursal'}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Automatically Display Assigned Branch */}
            {selectedOperator && (
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl animate-in fade-in zoom-in-95 duration-150 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    Sucursal Asignada en Administración:
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase">
                    {selectedOperator.role}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-900 font-black text-sm pt-0.5">
                  <Store className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{assignedBranch?.name || 'Sucursal Asignada'}</span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  El sistema iniciará sesión directamente en esta sucursal según la configuración establecida.
                </p>
              </div>
            )}

            {/* Password with Eye Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Contraseña de Acceso
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-extrabold focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-xs transition-shadow tracking-wider"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-700 text-xs font-bold bg-red-50 py-2.5 px-3 rounded-xl border border-red-200 animate-in fade-in">
                {error}
              </div>
            )}

            {/* Security Note */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 text-[11px] text-slate-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Las credenciales y sucursales son administradas desde el Módulo de Configuración.</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl text-xs font-black transition-all shadow-md cursor-pointer mt-2"
            >
              Iniciar Sesión
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
