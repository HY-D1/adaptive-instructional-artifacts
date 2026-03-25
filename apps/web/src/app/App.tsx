import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { VercelTelemetry } from './components/shared/VercelTelemetry';
import { ToastProvider } from './components/ui/toast';
import { AuthProvider } from './lib/auth-context';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <VercelTelemetry />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
