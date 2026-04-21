import { lazy, Suspense, useEffect } from "react";
import { Routes, Route } from "react-router";
import useAuthStore from "./store/authStore";
import useToastStore from "./store/toastStore";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/layout/Layout";
import Toast from "./components/ui/Toast";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import Upload from "./pages/Upload";
import Paper from "./pages/Paper";
import About from "./pages/About";

const BulkUpload = lazy(() => import("./pages/BulkUpload"));

const LazyFallback = (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-pyqp-muted">Loading...</div>
  </div>
);

export default function App() {
  useEffect(() => {
    useAuthStore.getState().hydrateSession();
    useAuthStore.getState().validateSession();
  }, []);
  const toast = useToastStore((s) => s.toast);
  const clearToast = useToastStore((s) => s.clearToast);
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/upload" element={<Upload />} />
          <Route
            path="/upload/bulk"
            element={
              <Suspense fallback={LazyFallback}>
                <BulkUpload />
              </Suspense>
            }
          />
          <Route path="/paper/:identifier" element={<Paper />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={toast.duration}
          onClose={() => clearToast(toast.id)}
        />
      )}
    </ErrorBoundary>
  );
}
