import { useRouteError, isRouteErrorResponse } from 'react-router';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Link } from 'react-router';

/**
 * RouteError - Error boundary for React Router routes
 * Displays user-friendly error UI when a route throws an error
 * 
 * Usage: Add as errorElement to route definitions
 */
export function RouteError() {
  const error = useRouteError();

  // Log error for debugging
  console.error('Route error caught:', error);

  let title = 'Something went wrong';
  let message = 'The application encountered an unexpected error.';
  let statusCode: number | null = null;

  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    title = error.statusText || `Error ${error.status}`;
    message = typeof error.data === 'string' 
      ? error.data 
      : 'A routing error occurred. Please try again.';
  } else if (error instanceof Error) {
    title = error.name || 'Application Error';
    message = error.message;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
        </div>
        
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {title}
        </h1>
        
        <p className="text-gray-600 mb-4">
          {message}
        </p>

        {statusCode && (
          <div className="mb-4 inline-block px-3 py-1 bg-gray-100 rounded-full text-sm font-mono text-gray-600">
            Status: {statusCode}
          </div>
        )}

        {error instanceof Error && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Show technical details
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-red-600 overflow-auto max-h-32">
              {error.stack || error.toString()}
            </pre>
          </details>
        )}

        <div className="flex gap-2 justify-center">
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reload Page
          </Button>
          
          <Button asChild>
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
