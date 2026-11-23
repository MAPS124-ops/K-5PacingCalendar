import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl bg-white border border-slate-200 shadow-sm p-8 space-y-4">
            <h1 className="font-display text-xl font-bold text-[#182756]">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your workspace encountered a data or connection error. Reloading usually resolves transient issues.
            </p>
            <pre className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 overflow-x-auto max-h-40">
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
