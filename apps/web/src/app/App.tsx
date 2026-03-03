import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
