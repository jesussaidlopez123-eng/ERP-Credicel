import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Printer, Check } from 'lucide-react';
import Login from './components/Login';
import { ModuleLoading } from './components/LazyWhen';
import { Branch, Operator } from './types';
import { getStoredOperators, saveStoredOperators, INITIAL_OPERATORS } from './data/initialOperators';
import { ADMIN_WORKSPACE, ALL_BRANCHES, hasCashTill } from './data/initialBranches';
import { normalizeRole } from './lib/roles';
import { subscribeToOperators, saveOperatorToFirestore, deleteOperatorFromFirestore } from './lib/firebase';

const Dashboard = lazy(() => import('./components/Dashboard'));
const SESSION_STORAGE_KEY = 'erp_auth_session_v1';

export default function App() {
  // Printing notification state (discreet overlay toast)
  const [isPrintingNotification, setIsPrintingNotification] = useState<boolean>(false);
  const [printFinishedNotification, setPrintFinishedNotification] = useState<boolean>(false);

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

  const currentOperatorRef = useRef<Operator | null>(currentOperator);
  currentOperatorRef.current = currentOperator;

  useEffect(() => {
    const unsubscribe = subscribeToOperators((firestoreOps) => {
      if (firestoreOps && firestoreOps.length > 0) {
        setOperators(firestoreOps);
        saveStoredOperators(firestoreOps);

        const current = currentOperatorRef.current;
        if (current) {
          const matched = firestoreOps.find((o) => o.id === current.id);
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
  }, []);

  // Listen for browser print events (window.print, kiosk printing, or shortcut Ctrl+P)
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let finishedTimer: ReturnType<typeof setTimeout> | null = null;

    const handleBeforePrint = () => {
      if (hideTimer) clearTimeout(hideTimer);
      if (finishedTimer) clearTimeout(finishedTimer);
      setPrintFinishedNotification(false);
      setIsPrintingNotification(true);
    };

    const handleAfterPrint = () => {
      setIsPrintingNotification(false);
      setPrintFinishedNotification(true);
      finishedTimer = setTimeout(() => {
        setPrintFinishedNotification(false);
      }, 2500);
    };

    // Custom app-level trigger listener
    const handleCustomPrintTrigger = () => {
      handleBeforePrint();
      hideTimer = setTimeout(() => {
        setIsPrintingNotification(false);
        setPrintFinishedNotification(true);
        finishedTimer = setTimeout(() => {
          setPrintFinishedNotification(false);
        }, 2500);
      }, 1600);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    window.addEventListener('app-printing-started', handleCustomPrintTrigger);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      window.removeEventListener('app-printing-started', handleCustomPrintTrigger);
      if (hideTimer) clearTimeout(hideTimer);
      if (finishedTimer) clearTimeout(finishedTimer);
    };
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
    const workspace = normalizeRole(operator.role) === 'admin' ? ADMIN_WORKSPACE : branch;
    setCurrentBranch(workspace);
    setCurrentOperator(operator);
    setIsAuthenticated(true);

    try {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ authenticated: true, branch: workspace, operator })
      );

      if (hasCashTill(workspace.id)) {
        const todayIso = new Date().toISOString().slice(0, 10);
        const shiftLoginKey = `erp_shift_login_${workspace.id}_${todayIso}`;
        if (!localStorage.getItem(shiftLoginKey)) {
          const nowTime = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
          localStorage.setItem(shiftLoginKey, JSON.stringify({
            operatorName: operator.name,
            time: nowTime,
            timestamp: new Date().toISOString()
          }));
        }
      }
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
    <>
      <Suspense fallback={<ModuleLoading />}>
        <Dashboard 
          currentBranch={currentBranch}
          currentOperator={currentOperator}
          operators={operators}
          onUpdateOperators={handleUpdateOperators}
          onLogout={handleLogout}
        />
      </Suspense>

      {/* Discrete Printing Status Indicator (No-Print) */}
      {(isPrintingNotification || printFinishedNotification) && (
        <div 
          className="fixed bottom-4 right-4 z-9999 no-print pointer-events-none transition-all duration-300 transform translate-y-0"
          role="status"
          aria-live="polite"
        >
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-xl border backdrop-blur-md text-xs font-black select-none animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            isPrintingNotification
              ? 'bg-slate-950/90 text-amber-300 border-amber-400/40 ring-2 ring-amber-400/20'
              : 'bg-slate-950/90 text-emerald-300 border-emerald-400/40 ring-2 ring-emerald-400/20'
          }`}>
            {isPrintingNotification ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <Printer className="w-4 h-4 text-amber-300 animate-pulse" />
                <span className="tracking-wide">Imprimiendo ticket...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="tracking-wide text-slate-200">Ticket enviado a impresora</span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
