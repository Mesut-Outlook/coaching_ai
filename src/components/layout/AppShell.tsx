import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { SidebarProvider } from '../../contexts/SidebarContext'

export default function AppShell() {
  return (
    <SidebarProvider>
      <div className="app">
        <Sidebar />
        <div className="main">
          <Outlet />
        </div>
      </div>
    </SidebarProvider>
  )
}
