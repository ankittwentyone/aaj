import { Component, ReactNode } from "react";

export class ScreenErrorBoundary extends Component<{ name: string; children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error(`[boundary:${this.props.name}]`, err); }
  render() {
    if (this.state.err) return (
      <div className="p-8 border border-danger-border bg-danger-dim rounded-lg m-6">
        <h2 className="text-danger font-mono text-sm">{this.props.name} crashed</h2>
        <p className="text-sm opacity-80 mt-2">{this.state.err.message}</p>
        <button onClick={() => this.setState({ err: null })} className="mt-4 px-3 py-1 bg-voltage text-voltage-foreground rounded-md text-sm">Retry</button>
      </div>
    );
    return this.props.children;
  }
}

export default ScreenErrorBoundary;
