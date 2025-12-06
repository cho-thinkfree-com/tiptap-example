import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
        // We can log the error here if needed.
        // For NotFoundError during unmount/transition, we specifically want to suppress the crash.
        // console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || null;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
