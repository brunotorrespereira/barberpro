import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEmpresa } from '../hooks/useEmpresa';
import { useToast } from './Toast';

const navItems = [
  { path: '/', icon: '🏠', label: 'Dashboard', end: true },
  { path: '/clientes', icon: '👥', label: 'Clientes' },
  { path: '/agendamentos', icon: '📅', label: 'Agendamentos' },
  { path: '/barbeiros', icon: '💈', label: 'Barbeiros' },
];

const adminItems = [
  { path: '/servicos', icon: '✂️', label: 'Serviços' },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { role } = useEmpresa();
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.success('Sessão encerrada com sucesso!');
    } catch {
      toast.error('Erro ao sair. Tente novamente.');
    }
  };

  const getInitials = (email) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  const closeSidebar = () => setOpen(false);

  return (
    <>
      <button
        className="sidebar-hamburger"
        onClick={() => setOpen(prev => !prev)}
        aria-label="Toggle menu"
      >
        {open ? '✕' : '☰'}
      </button>

      <div
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={closeSidebar}
      />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">✂️</span>
          <div>
            <div className="sidebar-logo-text">BarberPro</div>
            <div className="sidebar-logo-sub">Sistema de Gestão</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Menu Principal</div>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {role === 'admin' && (
            <>
              <div className="sidebar-section-title" style={{ marginTop: '1rem' }}>Administração</div>
              {adminItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">
              {getInitials(user?.email)}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-email">{user?.email}</div>
              <div className="sidebar-user-role">Administrador</div>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleLogout}
          >
            🚪 Sair
          </button>
        </div>
      </aside>
    </>
  );
}
