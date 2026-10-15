import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import HomePage from '@/pages/home-page';
import AdminPage from '@/pages/admin-page';
import AuthPage from '@/pages/auth-page';
import NotFound from '@/pages/not-found';
import '@/lib/supabase';

const queryClient = new QueryClient();
export default function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider>
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ErrorBoundary><Switch>
        <Route path="/" component={HomePage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/sign-in/*?">{() => <AuthPage />}</Route>
        <Route component={NotFound} />
      </Switch></ErrorBoundary>
    </Router><Toaster />
  </TooltipProvider></QueryClientProvider>;
}

