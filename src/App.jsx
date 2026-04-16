import { useEffect } from 'react'
import { Routes, Route } from 'react-router'
import useAuthStore from './store/authStore'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Browse from './pages/Browse'
import Upload from './pages/Upload'
import Paper from './pages/Paper'
import About from './pages/About'

export default function App() {
  useEffect(() => {
    useAuthStore.getState().hydrateSession()
    useAuthStore.getState().validateSession()
  }, [])

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/paper/:identifier" element={<Paper />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
