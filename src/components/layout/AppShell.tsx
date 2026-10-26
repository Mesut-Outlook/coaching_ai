import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { SidebarProvider } from '../../contexts/SidebarContext'
import HomeSummaryProvider from '../../contexts/HomeSummaryProvider'

export default function AppShell() {
  return (
    <SidebarProvider>
      <HomeSummaryProvider>
        <div className="app">
          <Sidebar />
          <div className="main">
            <Outlet />
          </div>
        </div>
      </HomeSummaryProvider>
    </SidebarProvider>
  )
}
