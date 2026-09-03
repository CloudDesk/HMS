import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './auth/AuthContext';
import { AppRouter } from './routing/AppRouter';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2 } } });

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
