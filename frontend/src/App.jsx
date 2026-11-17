import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

import HomePage from './pages/HomePage.jsx';
import AgentePage from './pages/AgentePage.jsx';
import LoginPage from './pages/admin/LoginPage.jsx';
import RegisterPage from './pages/admin/RegisterPage.jsx';
import PublicLoginPage from './pages/PublicLoginPage.jsx';
import DashboardPage from './pages/admin/DashboardPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/agente" element={<AgentePage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/registro" element={<RegisterPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/login" element={<PublicLoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
