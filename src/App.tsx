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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
            <Route path="/raporlar" element={<RaporlarPage />} />
            <Route path="/mufredat" element={<MufredatPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/panel" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
