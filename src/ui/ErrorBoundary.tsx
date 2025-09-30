import * as React from 'react';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    // Keep simple; Obsidian console will show details
    console.error('Enhanced Reader ErrorBoundary:', error, errorInfo);
  }

  render() {
    const { fallback, children } = this.props;
    if (this.state.hasError) {
      return fallback ?? (
        <div style={{ padding: 12 }}>
          <h3>Houve um erro ao renderizar este ePub.</h3>
          <p>Tente fechar e abrir o arquivo novamente. Se persistir, verifique o console.</p>
        </div>
      );
    }
    return children;
  }
}
