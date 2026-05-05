import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <section className="w-full max-w-md space-y-4 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Something needs a refresh</h1>
            <p className="text-sm text-muted-foreground">
              The app hit a runtime error while loading. Refreshing usually clears stale cached files after a deployment.
            </p>
          </div>
          <pre className="max-h-32 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
          <Button onClick={() => window.location.reload()}>Refresh app</Button>
        </section>
      </main>
    );
  }
}
