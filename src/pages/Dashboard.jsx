import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useClientes } from '../hooks/useClientes';
import { useAgendamentos } from '../hooks/useAgendamentos';
import { useBarbeiros } from '../hooks/useBarbeiros';

const formatarValor = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const statusConfig = {
  pendente: { label: 'Pendente', cls: 'badge-warning' },
  confirmado: { label: 'Confirmado', cls: 'badge-success' },
  concluido: { label: 'Concluído', cls: 'badge-accent' },
  cancelado: { label: 'Cancelado', cls: 'badge-danger' },
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function Dashboard() {
  const { clientes, loading: lC } = useClientes();
  const { agendamentos, loading: lA } = useAgendamentos();
  const { barbeiros, loading: lB } = useBarbeiros();
  const navigate = useNavigate();

  const hoje = new Date().toISOString().split('T')[0];

  const agendamentosHoje = useMemo(
    () => agendamentos.filter(a => a.data === hoje),
    [agendamentos, hoje]
  );

  const faturamentoDia = useMemo(
    () => agendamentos
      .filter(a => a.data === hoje && a.status === 'concluido')
      .reduce((sum, a) => sum + (Number(a.valorCobrado) || 0), 0),
    [agendamentos, hoje]
  );

  const faturamentoMes = useMemo(() => {
    const now = new Date();
    const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return agendamentos
      .filter(a => a.data && a.data.startsWith(mes) && a.status === 'concluido')
      .reduce((sum, a) => sum + (Number(a.valorCobrado) || 0), 0);
  }, [agendamentos]);

  const barbeirosAtivos = useMemo(
    () => barbeiros.filter(b => b.ativo).length,
    [barbeiros]
  );

  const recentAgendamentos = useMemo(
    () => agendamentos.slice(0, 5),
    [agendamentos]
  );

  const loading = lC || lA || lB;

  const stats = [
    {
      icon: '👥',
      value: loading ? '...' : clientes.length,
      label: 'Total de Clientes',
      change: '+3 este mês',
    },
    {
      icon: '📅',
      value: loading ? '...' : agendamentosHoje.length,
      label: 'Agendamentos Hoje',
      change: loading ? '' : `${formatarValor(faturamentoDia)} hoje`,
    },
    {
      icon: '💰',
      value: loading ? '...' : formatarValor(faturamentoMes),
      label: 'Faturamento do Mês',
      change: loading ? '' : `${agendamentos.filter(a => {
        const mes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        return a.data?.startsWith(mes) && a.status === 'concluido';
      }).length} concluídos`,
    },
    {
      icon: '💈',
      value: loading ? '...' : barbeirosAtivos,
      label: 'Barbeiros Ativos',
      change: `de ${barbeiros.length} cadastrados`,
    },
  ];

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="dashboard-welcome">
          <h1 className="dashboard-welcome-title">
            Bem-vindo ao <span style={{ color: 'var(--accent)' }}>BarberPro</span> ✂️
          </h1>
          <p className="dashboard-welcome-sub">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="stats-grid">
          {stats.map((s, i) => (
            <div key={i} className="stat-card">
              <span className="stat-icon">{s.icon}</span>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-change">{s.change}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="section-title">⚡ Ações Rápidas</div>
          <div className="quick-actions">
            <button className="btn btn-primary" onClick={() => navigate('/clientes')}>
              👥 Novo Cliente
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/agendamentos')}>
              📅 Novo Agendamento
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/barbeiros')}>
              💈 Gerenciar Barbeiros
            </button>
          </div>
        </div>

        <div className="card">
          <div className="section-title">📋 Agendamentos Recentes</div>
          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
            </div>
          ) : recentAgendamentos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-title">Nenhum agendamento</div>
              <div className="empty-state-text">
                Crie seu primeiro agendamento clicando no botão acima.
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Barbeiro</th>
                    <th>Data</th>
                    <th>Horário</th>
                    <th>Serviço</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAgendamentos.map(a => {
                    const sc = statusConfig[a.status] || { label: a.status, cls: 'badge-secondary' };
                    return (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.clienteNome || '-'}</td>
                        <td>{a.barbeiroNome || '-'}</td>
                        <td>{formatDate(a.data)}</td>
                        <td>{a.horario || '-'}</td>
                        <td>{a.servicoNome || a.servico || '-'}</td>
                        <td>
                          <span className={`badge ${sc.cls}`}>{sc.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
