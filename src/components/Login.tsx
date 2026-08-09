import React, { useState, useMemo } from 'react';
import { Store, User, Lock, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Branch, Operator } from '../types';
import Logo from './Logo';
import { INITIAL_OPERATORS } from '../data/initialOperators';

const MOCK_BRANCHES: Branch[] = [
  { id: 'b-bodega', name: 'Bodega' },
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' },
];

interface LoginProps {
  onLogin: (branch: Branch, operator: Operator) => void;
  operators?: Operator[];
  branches?: Branch[];
}

export default function Login({ onLogin, operators = INITIAL_OPERATORS, branches = MOCK_BRANCHES }: LoginProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const availableOperators = useMemo(() => {
    if (!selectedBranchId) return [];
    return operators.filter((op) => op.branchIds.includes(selectedBranchId));
  }, [selectedBranchId, operators]);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBranchId(e.target.value);
    setSelectedOperatorId(''); // Reset operator when branch changes
    setPassword('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedBranchId || !selectedOperatorId || !password) {
      setError('Por favor, selecciona sucursal, usuario e ingresa la contraseña.');
      return;
    }

    const branch = branches.find((b) => b.id === selectedBranchId);
    const operator = operators.find((o) => o.id === selectedOperatorId);

    if (!branch || !operator) {
      setError('Datos de acceso inválidos o usuario no asignado.');
      return;
    }

    // Strict Password Validation against configured operator password
    const expectedPassword = operator.password !== undefined ? operator.password : '123';

    if (password !== expectedPassword) {
      setError(`❌ Contraseña incorrecta para el usuario '${operator.name}'. Verifique sus credenciales.`);
      return;
    }

    // Successful login
    onLogin(branch, operator);
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
            <p className="text-slate-400 mt-1 text-xs font-medium">Autenticación con Credenciales de Operador</p>
          </div>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Branch Selection */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1.5 uppercase tracking-wider">
                Sucursal de Operación
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Store className="h-4 w-4 text-slate-400" />
                </div>
                <select
                  value={selectedBranchId}
                  onChange={handleBranchChange}
                  className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-extrabold focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-xs transition-shadow"
                >
                  <option value="" disabled>-- Selecciona una sucursal --</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                    setError('');
                  }}
                  disabled={!selectedBranchId}
                  className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-extrabold focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-xs disabled:bg-slate-50 disabled:text-slate-400 transition-shadow"
                >
                  <option value="" disabled>
                    {!selectedBranchId ? 'Primero selecciona la sucursal' : '-- Selecciona tu usuario --'}
                  </option>
                  {availableOperators.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {operator.name} (@{operator.username}) - {operator.role.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
              <span>Las credenciales son configuradas y administradas por el Admin Principal en el Módulo de Configuración.</span>
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

