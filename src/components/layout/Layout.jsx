import { Outlet } from 'react-router'
import Navbar from './Navbar'
import Footer from './Footer'
import BottomNav from './BottomNav'
import ScanFAB from '../upload/ScanFAB'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <ScanFAB />
      <BottomNav />
    </div>
  )
}
