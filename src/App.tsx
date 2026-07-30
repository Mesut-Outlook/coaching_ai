import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/routing/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import PanelPage from './pages/PanelPage'
import OgrencilerPage from './pages/OgrencilerPage'
import DenemelerPage from './pages/DenemelerPage'
import KonularPage from './pages/KonularPage'
import ProgramPage from './pages/ProgramPage'
import RaporlarPage from './pages/RaporlarPage'
import MufredatPage from './pages/MufredatPage'
import TercihPage from './pages/TercihPage'
import DevamsizlikPage from './pages/DevamsizlikPage'
import YardimPage from './pages/YardimPage'
import PortalAccessPage from './pages/mobile/PortalAccessPage'
import OgrenciPortalPage from './pages/mobile/OgrenciPortalPage'
import VeliPortalPage from './pages/mobile/VeliPortalPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/portal" element={<PortalAccessPage />} />
          <Route path="/ogrenci" element={<OgrenciPortalPage />} />
          <Route path="/veli" element={<VeliPortalPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/panel" replace />} />
            <Route path="/panel" element={<PanelPage />} />
            <Route path="/ogrenciler" element={<OgrencilerPage />} />
            <Route path="/ogrenciler/:studentId" element={<OgrencilerPage />} />
            <Route path="/denemeler" element={<DenemelerPage />} />
            <Route path="/konular" element={<KonularPage />} />
            <Route path="/program" element={<ProgramPage />} />
            <Route path="/devamsizlik" element={<DevamsizlikPage />} />
            <Route path="/raporlar" element={<RaporlarPage />} />
            <Route path="/mufredat" element={<MufredatPage />} />
            <Route path="/tercih" element={<TercihPage />} />
            <Route path="/yardim" element={<YardimPage />} />
            {/* Eski adres korunuyor: Sürüm Geçmişi artık Yardım içinde bir sekme */}
            <Route path="/surum-gecmisi" element={<Navigate to="/yardim?sekme=surum" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/panel" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
