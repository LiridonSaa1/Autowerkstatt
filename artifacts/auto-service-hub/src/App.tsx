import { type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { sqAL } from '@clerk/localizations';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import AdminPage from '@/pages/admin-page';
import HomePage from '@/pages/home-page';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#e96334',
    colorForeground: '#1c303c',
    colorMutedForeground: '#65727a',
    colorDanger: '#bd4037',
    colorBackground: '#fbf9f3',
    colorInput: '#f3f0e8',
    colorInputForeground: '#1c303c',
    colorNeutral: '#d7d1c5',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.7rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf9f3] rounded-xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-[#1c303c] uppercase',
    headerSubtitle: 'text-[#65727a]',
    socialButtonsBlockButtonText: 'text-[#1c303c]',
    formFieldLabel: 'text-[#1c303c]',
    footerActionLink: 'text-[#c94f2c]',
    footerActionText: 'text-[#65727a]',
    dividerText: 'text-[#65727a]',
    identityPreviewEditButton: 'text-[#c94f2c]',
    formFieldSuccessText: 'text-[#35684e]',
    alertText: 'text-[#8d3029]',
    logoBox: 'mx-auto',
    logoImage: 'h-10 w-auto',
    socialButtonsBlockButton: 'border-[#d7d1c5] bg-[#f3f0e8]',
    formButtonPrimary: 'bg-[#e96334] text-[#1c303c] hover:bg-[#f17950]',
    formFieldInput: 'border-[#d7d1c5] bg-[#f3f0e8] text-[#1c303c]',
    footerAction: 'border-t border-[#e2ddd2]',
    dividerLine: 'bg-[#d7d1c5]',
    alert: 'border-[#bd4037]',
    otpCodeFieldInput: 'border-[#d7d1c5] bg-[#f3f0e8] text-[#1c303c]',
    formFieldRow: 'text-[#1c303c]',
    main: 'text-[#1c303c]',
  },
};

function SignInPage() {
  return (
    <main className="surface-grid flex min-h-[100dvh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-[520px]">
        <a href={basePath || '/'} className="mb-8 flex items-center justify-center gap-3 text-primary" data-testid="link-auth-brand">
          <span className="grid h-10 w-10 place-items-center bg-primary text-accent"><span className="font-display text-xl font-bold">A</span></span>
          <span className="font-display text-2xl font-bold uppercase">Auto Service Hub</span>
        </a>
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="surface-grid flex min-h-[100dvh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-[520px]">
        <a href={basePath || '/'} className="mb-8 flex items-center justify-center gap-3 text-primary" data-testid="link-auth-brand">
          <span className="grid h-10 w-10 place-items-center bg-primary text-accent"><span className="font-display text-xl font-bold">A</span></span>
          <span className="font-display text-2xl font-bold uppercase">Auto Service Hub</span>
        </a>
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </main>
  );
}

function Router() {
  const [location, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={sqAL}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <RoutedErrorBoundary key={location} resetKey={location}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </ClerkProvider>
  );
}

function RoutedErrorBoundary({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  return <ErrorBoundary resetKey={resetKey}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
