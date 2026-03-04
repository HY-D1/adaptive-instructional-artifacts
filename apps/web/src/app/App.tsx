import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ToastProvider } from './components/ui/toast';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ErrorBoundary>
  );
}
