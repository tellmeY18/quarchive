import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-pyqp-bg px-4">
          <div className="max-w-md w-full bg-pyqp-card border border-pyqp-border rounded-xl p-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            <h2 className="font-heading text-xl font-bold text-pyqp-text mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-pyqp-muted mb-6">
              An unexpected error occurred. You can try again or go back to the home page.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-pyqp-accent text-white rounded-lg font-medium hover:bg-pyqp-accent-hover transition-colors min-h-[48px]"
              >
                Try Again
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-pyqp-border text-pyqp-text rounded-lg font-medium hover:bg-pyqp-border/50 transition-colors min-h-[48px]"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
