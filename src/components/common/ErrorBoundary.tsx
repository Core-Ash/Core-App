import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorScreen } from "./ErrorScreen";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV)
      console.error("Core render error", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <ErrorScreen
          title="Something went wrong"
          description="Core couldn't load this screen. Please reload and try again."
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
