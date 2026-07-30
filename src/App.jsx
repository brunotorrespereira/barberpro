import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useEmpresa } from './hooks/useEmpresa';
import { EmpresaProvider } from './contexts/EmpresaContext';
import { ToastProvider } from './components/Toast';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Agendamentos from './pages/Agendamentos';
import Barbeiros from './pages/Barbeiros';
import Servicos from './pages/Servicos';
import Migracao from './pages/Migracao';
import Loading from './components/Loading';

/**
 * Protege rotas autenticadas.
 * - Não autenticado      → /login
 * - Autenticado sem empresa → /setup
 * - Autenticado com empresa → renderiza normalmente
 */
function PrivateRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { needsSetup, loading: empresaLoading } = useEmpresa();

  if (authLoading || empresaLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  return children;
}

/**
 * Protege rotas exclusivas de administrador.
 * - Não autenticado      → /login
 * - Sem empresa          → /setup
 * - Role diferente de admin → /
 */
function AdminRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { needsSetup, role, loading: empresaLoading } = useEmpresa();

  if (authLoading || empresaLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

/**
 * Protege a rota /setup.
 * - Não autenticado        → /login
 * - Autenticado com empresa → / (já configurado)
 * - Autenticado sem empresa → renderiza Setup
 */
function SetupRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { needsSetup, loading: empresaLoading } = useEmpresa();

  if (authLoading || empresaLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!needsSetup) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <EmpresaProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/setup"
              element={<SetupRoute><Setup /></SetupRoute>}
            />

            <Route
              path="/"
              element={<PrivateRoute><Dashboard /></PrivateRoute>}
            />
            <Route
              path="/clientes"
              element={<PrivateRoute><Clientes /></PrivateRoute>}
            />
            <Route
              path="/agendamentos"
              element={<PrivateRoute><Agendamentos /></PrivateRoute>}
            />
            <Route
              path="/barbeiros"
              element={<PrivateRoute><Barbeiros /></PrivateRoute>}
            />
            <Route
              path="/servicos"
              element={<AdminRoute><Servicos /></AdminRoute>}
            />
            <Route
              path="/migracao"
              element={<AdminRoute><Migracao /></AdminRoute>}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </EmpresaProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}
