import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('erp_auth_session_v1');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  private handleClearAndRestart = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-fadeIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-6 text-white text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-xs border border-white/30">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-xl font-black tracking-tight">Ocurrió un error inesperado</h1>
              <p className="text-xs text-red-100 font-medium mt-1">
                El sistema detectó un inconveniente temporal en este dispositivo.
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  Detalle del Error:
                </div>
                <p className="text-xs font-mono text-slate-600 bg-white p-3 rounded-xl border border-slate-200 break-words max-h-32 overflow-y-auto">
                  {this.state.error?.message || 'Error desconocido al inicializar el componente.'}
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={this.handleReset}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Recargar Aplicación
                </button>

                <button
                  onClick={this.handleClearAndRestart}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 px-4 rounded-xl text-xs font-bold transition-all border border-slate-300 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-slate-500" />
                  Restablecer Caché y Reingresar
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
