import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ToastProvider } from './components/ui/toast';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './lib/auth-context';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <SpeedInsights />
          <Analytics />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
