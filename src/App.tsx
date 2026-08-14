import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Branch, Operator } from './types';
import { getStoredOperators, saveStoredOperators } from './data/initialOperators';
import { subscribeToOperators, saveOperatorToFirestore, deleteOperatorFromFirestore } from './lib/firebase';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [currentOperator, setCurrentOperator] = useState<Operator | null>(null);
  
  // Persistent Operators State with Firestore Sync
  const [operators, setOperators] = useState<Operator[]>(() => getStoredOperators());

  useEffect(() => {
    const unsubscribe = subscribeToOperators((firestoreOps) => {
      if (firestoreOps && firestoreOps.length > 0) {
        setOperators(firestoreOps);
        saveStoredOperators(firestoreOps);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateOperators = async (newOperators: Operator[]) => {
    // Detect removed operators by comparing old and new operator IDs
    const newIds = new Set(newOperators.map((o) => o.id));
    const deletedOperators = operators.filter((o) => !newIds.has(o.id));

    setOperators(newOperators);
    saveStoredOperators(newOperators);

    // 1. Permanently delete removed operators from Firestore
    for (const delOp of deletedOperators) {
      try {
        await deleteOperatorFromFirestore(delOp.id);
        console.log(`[Firestore] Deleted operator ${delOp.id} (${delOp.username})`);
      } catch (err) {
        console.error(`[Firestore] Error deleting operator ${delOp.id}:`, err);
      }
    }

    // 2. Save created or modified operators to Firestore
    for (const op of newOperators) {
      try {
        await saveOperatorToFirestore(op);
      } catch (err) {
        console.error('Error saving operator to Firestore:', err);
      }
    }

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


