import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isAuthenticated } from '@/utils/auth';

export default function PrivateRoute({ children }) {
  const { admin } = useAuth();

  if (!admin && !isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
