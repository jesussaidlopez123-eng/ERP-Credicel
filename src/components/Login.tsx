import React, { useState, useMemo } from 'react';
import { Store, User, Lock, ArrowRight } from 'lucide-react';
import { Branch, Operator } from '../types';
import Logo from './Logo';

const MOCK_BRANCHES: Branch[] = [
  { id: 'b-bodega', name: 'Bodega' },
  { id: 'b-navojoa', name: 'Navojoa' },
  { id: 'b-huatabampo', name: 'Huatabampo' },
];

const MOCK_OPERATORS: Operator[] = [
  { id: 'o1', name: 'Admin Principal', branchIds: ['b-bodega', 'b-navojoa', 'b-huatabampo'], role: 'admin' },
  { id: 'o2', name: 'Juan Pérez', branchIds: ['b-bodega', 'b-navojoa'], role: 'manager' },
  { id: 'o3', name: 'María García', branchIds: ['b-huatabampo'], role: 'cashier' },
  { id: 'o4', name: 'Carlos López', branchIds: ['b-bodega', 'b-navojoa', 'b-huatabampo'], role: 'cashier' },
];

interface LoginProps {
  onLogin: (branch: Branch, operator: Operator) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');

  const availableOperators = useMemo(() => {
    if (!selectedBranchId) return [];
    return MOCK_OPERATORS.filter((op) => op.branchIds.includes(selectedBranchId));
  }, [selectedBranchId]);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBranchId(e.target.value);
    setSelectedOperatorId(''); // Reset operator when branch changes
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedBranchId || !selectedOperatorId || !password) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    // Mock authentication: accept any password for now except empty
    const branch = MOCK_BRANCHES.find((b) => b.id === selectedBranchId);
    const operator = MOCK_OPERATORS.find((o) => o.id === selectedOperatorId);

    if (branch && operator) {
      onLogin(branch, operator);
    } else {
      setError('Datos de acceso inválidos.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-8 py-10 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center justify-center">
            {/* Logo */}
            <div className="mb-6 transform -rotate-1">
              <Logo size="lg" />
            </div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Acceso al Sistema</h1>
            <p className="text-slate-500 mt-1.5 text-sm font-medium">ERP & Punto de Venta</p>
          </div>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Branch Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Sucursal
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Store className="h-5 w-5 text-neutral-400" />
                </div>
                <select
                  value={selectedBranchId}
                  onChange={handleBranchChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 appearance-none bg-white text-sm transition-shadow"
                >
                  <option value="" disabled>Selecciona una sucursal...</option>
                  {MOCK_BRANCHES.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Operator Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Operador
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-neutral-400" />
                </div>
                <select
                  value={selectedOperatorId}
                  onChange={(e) => {
                    setSelectedOperatorId(e.target.value);
                    setError('');
                  }}
                  disabled={!selectedBranchId}
                  className="block w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 appearance-none bg-white text-sm disabled:bg-slate-50 disabled:text-slate-400 transition-shadow"
                >
                  <option value="" disabled>
                    {!selectedBranchId ? 'Primero selecciona sucursal' : 'Selecciona tu usuario...'}
                  </option>
                  {availableOperators.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {operator.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm transition-shadow"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-600 text-sm font-medium bg-red-50 py-2 px-3 rounded-md border border-red-100">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-2.5 px-4 rounded-lg hover:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-700 text-sm font-medium mt-4 shadow-md shadow-blue-900/10"
            >
              Ingresar al Sistema
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
