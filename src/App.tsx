import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AccessProvider } from './contexts/AccessContext'
import ProtectedRoute from './components/routing/ProtectedRoute'
import { RequirePermission } from './components/routing/RequirePermission'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
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
import KullanicilarPage from './pages/yonetim/KullanicilarPage'
import RollerPage from './pages/yonetim/RollerPage'
import KurumlarPage from './pages/yonetim/KurumlarPage'
import PortalAccessPage from './pages/mobile/PortalAccessPage'
import SifreSifirlaPage from './pages/SifreSifirlaPage'
import OgrenciPortalPage from './pages/mobile/OgrenciPortalPage'
import VeliPortalPage from './pages/mobile/VeliPortalPage'

export default function App() {
  return (
    <AuthProvider>
      <AccessProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sifre-sifirla" element={<SifreSifirlaPage />} />
            <Route path="/kayit" element={<RegisterPage />} />
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
              <Route
                path="/panel"
                element={
                  <RequirePermission perm="panel.view">
                    <PanelPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/ogrenciler"
                element={
                  <RequirePermission perm="students.view">
                    <OgrencilerPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/ogrenciler/:studentId"
                element={
                  <RequirePermission perm="students.view">
                    <OgrencilerPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/denemeler"
                element={
                  <RequirePermission perm="exams.view">
                    <DenemelerPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/konular"
                element={
                  <RequirePermission perm="topics.view">
                    <KonularPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/program"
                element={
                  <RequirePermission perm="program.view">
                    <ProgramPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/devamsizlik"
                element={
                  <RequirePermission perm="attendance.view">
                    <DevamsizlikPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/raporlar"
                element={
                  <RequirePermission perm="reports.view">
                    <RaporlarPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/mufredat"
                element={
                  <RequirePermission perm="curriculum.manage">
                    <MufredatPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/tercih"
                element={
                  <RequirePermission perm="tercih.view">
                    <TercihPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/yonetim/kullanicilar"
                element={
                  <RequirePermission perm="members.manage">
                    <KullanicilarPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/yonetim/roller"
                element={
                  <RequirePermission perm="roles.manage">
                    <RollerPage />
                  </RequirePermission>
                }
              />
              <Route path="/yonetim/kurumlar" element={<KurumlarPage />} />
              <Route path="/yardim" element={<YardimPage />} />
              {/* Eski adres korunuyor: Sürüm Geçmişi artık Yardım içinde bir sekme */}
              <Route path="/surum-gecmisi" element={<Navigate to="/yardim?sekme=surum" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Routes>
        </BrowserRouter>
      </AccessProvider>
    </AuthProvider>
  )
}
