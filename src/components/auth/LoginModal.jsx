import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import useArchiveAuth from "../../hooks/useArchiveAuth";
import useAuthStore from "../../store/authStore";
import LoginForm from "./LoginForm";

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const { login, generateKeys } = useArchiveAuth();
  const { isLoggingIn, loginError } = useAuthStore();
  const setLoginError = useAuthStore((s) => s.setLoginError);

  // Internal modal state: 'form' | 'generating-keys'
  const [modalState, setModalState] = useState("form");
  const [keyGenError, setKeyGenError] = useState(null);

  // Reset state and close modal
  const handleClose = useCallback(() => {
    setModalState("form");
    setKeyGenError(null);
    setLoginError(null);
    onClose();
  }, [onClose, setLoginError]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        handleClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [isOpen]);

  // Handle login form submission
  const handleSubmit = useCallback(
    async ({ email, password, remember }) => {
      const result = await login({ email, password, remember });

      if (!result) return;

      if (result.success) {
        handleClose();
        onLoginSuccess?.();
        return;
      }

      if (result.needsKeys && result.cookies) {
        // Switch to key generation sub-step
        setModalState("generating-keys");
        setKeyGenError(null);

        try {
          const keyResult = await generateKeys({
            cookies: result.cookies,
            email,
            remember,
          });
          if (keyResult?.success) {
            handleClose();
            onLoginSuccess?.();
          } else {
            setKeyGenError(
              keyResult?.error ||
                "Failed to generate upload keys. Please try again.",
            );
          }
        } catch {
          setKeyGenError("Failed to generate upload keys. Please try again.");
        }
        return;
      }

      // Error case is handled by the store (loginError)
    },
    [login, generateKeys, handleClose, onLoginSuccess],
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[60] overflow-y-auto">
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <div className="relative w-full max-w-md bg-pyqp-card rounded-xl shadow-xl">
          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 text-pyqp-muted hover:text-pyqp-text transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <h2 className="font-heading text-xl font-bold text-pyqp-text">
                Sign in with Internet Archive
              </h2>
              <p className="mt-1.5 text-sm text-pyqp-muted">
                Upload papers directly using your existing Archive.org account.
              </p>
            </div>

            {/* Conditional rendering based on modal state */}
            {modalState === "form" && (
              <LoginForm
                onSubmit={handleSubmit}
                isLoading={isLoggingIn}
                error={loginError}
              />
            )}

            {modalState === "generating-keys" && (
              <div className="py-8 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-pyqp-accent/10 flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-pyqp-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-sm font-medium text-pyqp-text">
                    {"Your Archive.org account doesn't have upload keys yet."}
                  </p>
                  {!keyGenError && (
                    <p className="mt-2 text-sm text-pyqp-muted flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4 text-pyqp-accent"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Generating your upload keys...
                    </p>
                  )}
                </div>

                {keyGenError && (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                      {keyGenError}
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalState("form")}
                      className="text-sm text-pyqp-accent hover:text-pyqp-accent-hover font-medium underline underline-offset-2 transition-colors cursor-pointer"
                    >
                      {"\u2190"} Back to sign in
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
