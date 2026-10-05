'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error UI, e.g. "Avatar" or "Settings". */
  label?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Generic React error boundary for the Alisha app.
 *
 * Wrap any component that depends on external libraries (Live2D, pixi.js,
 * speech APIs) in this to prevent a single crash from taking down the whole
 * page. The boundary renders a small inline error UI with a "try again"
 * button that re-mounts the children.
 */
export default class AlishaErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[AlishaErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
          <AlertCircle className="h-8 w-8 text-rose-400" />
          <p className="text-xs">
            {this.props.label ? `${this.props.label}: ` : ''}
            حدث خطأ غير متوقع.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
          >
            <RefreshCw className="h-3 w-3" />
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
