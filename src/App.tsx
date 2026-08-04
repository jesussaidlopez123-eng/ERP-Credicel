import React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Branch, Operator } from './types';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [currentOperator, setCurrentOperator] = useState<Operator | null>(null);

  const handleLogin = (branch: Branch, operator: Operator) => {
    setCurrentBranch(branch);
    setCurrentOperator(operator);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentBranch(null);
    setCurrentOperator(null);
  };

  if (!isAuthenticated || !currentBranch || !currentOperator) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Dashboard 
      currentBranch={currentBranch}
      currentOperator={currentOperator}
      onLogout={handleLogout}
    />
  );
}

