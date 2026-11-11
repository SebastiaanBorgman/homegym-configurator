import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router';
import { BRAND } from './config/brand';
import HomePage from './pages/HomePage';
import { buttonClass } from './ui/primitives';
import { Logo } from './ui/Logo';

// De configurator (met three.js) wordt pas geladen wanneer iemand hem opent.
const ConfiguratorPage = lazy(() => import('./configurator/ConfiguratorPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PageLoading() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-ink-900 text-white" role="status">
      <Logo tone="dark" />
      <span className="size-9 animate-spin rounded-full border-[3px] border-white/15 border-t-volt" />
      <span className="text-sm text-ink-300">Even geduld, de pagina wordt geladen…</span>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-ink-900 px-6 text-center text-white">
      <Logo tone="dark" />
      <h1 className="display text-4xl">Deze pagina bestaat niet.</h1>
      <p className="text-ink-300">Misschien is de link verouderd. Je ontwerp staat nog gewoon in de configurator.</p>
      <div className="flex gap-3">
        <Link to="/" className={buttonClass('outline', 'md')}>
          Naar {BRAND.name}
        </Link>
        <Link to="/configurator" className={buttonClass('primary', 'md')}>
          Open de configurator
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/configurator"
          element={
            <Suspense fallback={<PageLoading />}>
              <ConfiguratorPage />
            </Suspense>
          }
        />
        <Route
          path="/bestellijst"
          element={
            <Suspense fallback={<PageLoading />}>
              <OrderPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
