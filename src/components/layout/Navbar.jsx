import { useState } from 'react';
import { Link } from 'react-router';
import AuthStatus from '../auth/AuthStatus';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-pyqp-bg/95 backdrop-blur-sm border-b border-pyqp-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-heading font-bold text-2xl text-pyqp-text">Quarchive</span>
            <span className="hidden sm:inline text-sm text-pyqp-muted">Question Paper Archive</span>
          </Link>

          {/* Desktop nav links + auth */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/browse"
              className="text-sm font-medium text-pyqp-text-light hover:text-pyqp-text transition-colors"
            >
              Browse
            </Link>
            <Link
              to="/about"
              className="text-sm font-medium text-pyqp-text-light hover:text-pyqp-text transition-colors"
            >
              About
            </Link>
            <AuthStatus />
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-pyqp-muted hover:text-pyqp-text hover:bg-pyqp-border/50 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-pyqp-border bg-pyqp-bg">
          <div className="px-4 py-4 space-y-3">
            <Link
              to="/browse"
              className="block text-sm font-medium text-pyqp-text-light hover:text-pyqp-text transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Browse
            </Link>
            <Link
              to="/about"
              className="block text-sm font-medium text-pyqp-text-light hover:text-pyqp-text transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              About
            </Link>
            <div className="pt-3 border-t border-pyqp-border">
              <AuthStatus />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
