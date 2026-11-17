import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { admin, cargando } = useAuth();

  if (cargando) return null;
  if (!admin) return <Navigate to="/admin/login" replace />;

  return children;
}
