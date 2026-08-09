import React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Branch, Operator } from './types';
import { getStoredOperators, saveStoredOperators } from './data/initialOperators';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [currentOperator, setCurrentOperator] = useState<Operator | null>(null);
  
  // Persistent Operators State
  const [operators, setOperators] = useState<Operator[]>(() => getStoredOperators());

  const handleUpdateOperators = (newOperators: Operator[]) => {
    setOperators(newOperators);
    saveStoredOperators(newOperators);

    // If current operator was modified, update currentOperator in state
    if (currentOperator) {
      const updatedSelf = newOperators.find((op) => op.id === currentOperator.id);
      if (updatedSelf) {
        setCurrentOperator(updatedSelf);
      }
    }
  };

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
    return (
      <Login 
        onLogin={handleLogin}
        operators={operators}
      />
    );
  }

  return (
    <Dashboard 
      currentBranch={currentBranch}
      currentOperator={currentOperator}
      operators={operators}
      onUpdateOperators={handleUpdateOperators}
      onLogout={handleLogout}
    />
  );
}


