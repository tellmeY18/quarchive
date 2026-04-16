import { Link } from 'react-router'
import AuthStatus from '../auth/AuthStatus'

export default function Navbar() {
  return (
    <nav className="hidden md:block sticky top-0 z-50 bg-pyqp-bg/95 backdrop-blur-sm border-b border-pyqp-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-heading font-bold text-2xl text-pyqp-text">Quarchive</span>
            <span className="text-sm text-pyqp-muted">Question Paper Archive</span>
          </Link>

          {/* Desktop nav links + auth */}
          <div className="flex items-center gap-6">
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
        </div>
      </div>
    </nav>
  )
}
