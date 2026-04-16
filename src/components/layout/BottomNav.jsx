import { NavLink } from 'react-router'

export default function BottomNav() {
  const baseCls =
    'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors min-h-[48px] flex-1'

  const linkClass = ({ isActive }) =>
    `${baseCls} ${isActive ? 'text-pyqp-accent' : 'text-pyqp-muted hover:text-pyqp-text'}`

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-pyqp-bg/95 backdrop-blur-sm border-t border-pyqp-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Main navigation"
    >
      <div className="flex items-center h-14">
        <NavLink to="/" end className={linkClass} aria-label="Home">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          <span>Home</span>
        </NavLink>

        <NavLink to="/browse" className={linkClass} aria-label="Browse">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span>Browse</span>
        </NavLink>

        <NavLink
          to="/upload"
          className={({ isActive }) =>
            `${baseCls} ${isActive ? 'text-pyqp-accent' : 'text-pyqp-accent/70 hover:text-pyqp-accent'}`
          }
          aria-label="Upload"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-pyqp-accent text-white -mt-3 shadow-lg">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </div>
          <span className="font-semibold">Upload</span>
        </NavLink>

        <NavLink to="/about" className={linkClass} aria-label="About">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span>About</span>
        </NavLink>
      </div>
    </nav>
  )
}
