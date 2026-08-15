import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Branch, Operator } from './types';
import { getStoredOperators, saveStoredOperators, INITIAL_OPERATORS } from './data/initialOperators';
import { ALL_BRANCHES } from './data/initialBranches';
import { subscribeToOperators, saveOperatorToFirestore, deleteOperatorFromFirestore } from './lib/firebase';

const SESSION_STORAGE_KEY = 'erp_auth_session_v1';

export default function App() {
  // Persistent Operators State with Firestore Sync
  const [operators, setOperators] = useState<Operator[]>(() => getStoredOperators());

  // Restore authenticated session from localStorage if available
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.branch) return parsed.branch;
      }
    } catch (e) {
      console.error('Error restoring branch session', e);
    }
    return null;
  });

  const [currentOperator, setCurrentOperator] = useState<Operator | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.operator) return parsed.operator;
      }
    } catch (e) {
      console.error('Error restoring operator session', e);
    }
    return null;
  });

  // Sistema hermético: Siempre solicitar contraseña al cargar o recargar la página
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeToOperators((firestoreOps) => {
      if (firestoreOps && firestoreOps.length > 0) {
        setOperators(firestoreOps);
        saveStoredOperators(firestoreOps);

        // Keep current operator in sync if modified in administration
        if (currentOperator) {
          const matched = firestoreOps.find((o) => o.id === currentOperator.id);
          if (matched) {
            setCurrentOperator(matched);
            try {
              const saved = localStorage.getItem(SESSION_STORAGE_KEY);
              if (saved) {
                const parsed = JSON.parse(saved);
                localStorage.setItem(
                  SESSION_STORAGE_KEY,
                  JSON.stringify({ ...parsed, operator: matched })
                );
              }
            } catch {
              // ignore
            }
          }
        }
      }
    });
    return () => unsubscribe();
  }, [currentOperator]);

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

    // If current operator was modified, update currentOperator in state & localStorage
    if (currentOperator) {
      const updatedSelf = newOperators.find((op) => op.id === currentOperator.id);
      if (updatedSelf) {
        setCurrentOperator(updatedSelf);
        try {
          localStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({ authenticated: true, branch: currentBranch, operator: updatedSelf })
          );
        } catch {
          // ignore
        }
      }
    }
  };

  const handleLogin = (branch: Branch, operator: Operator) => {
    setCurrentBranch(branch);
    setCurrentOperator(operator);
    setIsAuthenticated(true);

    try {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ authenticated: true, branch, operator })
      );
    } catch (e) {
      console.error('Error saving session to localStorage', e);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentBranch(null);
    setCurrentOperator(null);

    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Error clearing session from localStorage', e);
    }
  };

  if (!isAuthenticated || !currentBranch || !currentOperator) {
    return (
      <Login 
        onLogin={handleLogin}
        operators={operators.length > 0 ? operators : INITIAL_OPERATORS}
        branches={ALL_BRANCHES}
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
