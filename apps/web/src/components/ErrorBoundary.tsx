import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('DragonBallistics Pro failed safely', error, info);
  }

  public override render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="fatal-screen">
        <section className="fatal-card" role="alert">
          <AlertTriangle aria-hidden="true" size={30} />
          <div>
            <p className="eyebrow">ERROR CONTROLADO</p>
            <h1>No se pudo abrir el laboratorio</h1>
            <p>{this.state.error.message}</p>
            <button
              type="button"
              className="button primary"
              onClick={() => window.location.reload()}
            >
              Recargar aplicacion
            </button>
          </div>
        </section>
      </main>
    );
  }
}
