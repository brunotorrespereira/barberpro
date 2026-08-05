import { useState, useMemo } from 'react';
import { CalendarDays, Pencil, Trash2, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useAgendamentos } from '../hooks/useAgendamentos';
import { useClientes } from '../hooks/useClientes';
import { useBarbeiros } from '../hooks/useBarbeiros';
import { useServicos } from '../hooks/useServicos';
import { agendamentoService } from '../services/agendamentoService';
import { useEmpresa } from '../hooks/useEmpresa';

const STATUS_OPTIONS = ['pendente', 'confirmado', 'concluido', 'cancelado'];

const statusConfig = {
  pendente: { label: 'Pendente', cls: 'badge-warning' },
  confirmado: { label: 'Confirmado', cls: 'badge-success' },
  concluido: { label: 'Concluído', cls: 'badge-accent' },
  cancelado: { label: 'Cancelado', cls: 'badge-danger' },
};

const emptyForm = {
  clienteId: '',
  clienteNome: '',
  barbeiroId: '',
  barbeiroNome: '',
  data: '',
  horario: '',
  servicoId: '',
  servicoNome: '',
  valorCobrado: 0,
  duracao: 0,
  status: 'pendente',
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function Agendamentos() {
  const { empresaId } = useEmpresa();
  const { agendamentos, loading: lA, recarregar } = useAgendamentos();
  const { clientes } = useClientes();
  const { barbeiros } = useBarbeiros();
  const { servicos } = useServicos();
  const toast = useToast();

  const [filterData, setFilterData] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: null });

  const filtered = useMemo(() => {
    return agendamentos.filter(a => {
      if (filterData && a.data !== filterData) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      return true;
    });
  }, [agendamentos, filterData, filterStatus]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setForm({
      clienteId: a.clienteId || '',
      clienteNome: a.clienteNome || '',
      barbeiroId: a.barbeiroId || '',
      barbeiroNome: a.barbeiroNome || '',
      data: a.data || '',
      horario: a.horario || '',
      servicoId: a.servicoId || '',
      servicoNome: a.servicoNome || '',
      valorCobrado: a.valorCobrado ?? 0,
      duracao: a.duracao ?? 0,
      status: a.status || 'pendente',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleClienteChange = (e) => {
    const id = e.target.value;
    const cliente = clientes.find(c => c.id === id);
    setForm(prev => ({
      ...prev,
      clienteId: id,
      clienteNome: cliente ? cliente.nome : '',
    }));
  };

  const handleBarbeiroChange = (e) => {
    const id = e.target.value;
    const barbeiro = barbeiros.find(b => b.id === id);
    setForm(prev => ({
      ...prev,
      barbeiroId: id,
      barbeiroNome: barbeiro ? barbeiro.nome : '',
    }));
  };

  const handleServicoChange = (e) => {
    const id = e.target.value;
    const servico = servicos.find(s => s.id === id);
    setForm(prev => ({
      ...prev,
      servicoId: id,
      servicoNome: servico ? servico.nome : '',
      valorCobrado: servico ? Number(servico.preco) : 0,
      duracao: servico ? Number(servico.duracao) : 0,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clienteId || !form.barbeiroId || !form.data || !form.horario || !form.servicoId) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await agendamentoService.atualizar(empresaId, editingId, form);
        toast.success('Agendamento atualizado!');
      } else {
        await agendamentoService.adicionar(empresaId, form);
        toast.success('Agendamento criado com sucesso!');
      }
      await recarregar();
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar agendamento.');
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (a) => setConfirm({ open: true, id: a.id });

  const handleDelete = async () => {
    try {
      await agendamentoService.remover(empresaId, confirm.id);
      toast.success('Agendamento removido.');
      await recarregar();
    } catch {
      toast.error('Erro ao remover agendamento.');
    } finally {
      setConfirm({ open: false, id: null });
    }
  };

  const clearFilters = () => {
    setFilterData('');
    setFilterStatus('');
  };

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CalendarDays size={22} /> Agendamentos</h1>
          <button className="btn btn-primary" onClick={openAdd}>
            + Novo Agendamento
          </button>
        </div>

        <div className="filters-bar">
          <div>
            <input
              className="input"
              type="date"
              value={filterData}
              onChange={e => setFilterData(e.target.value)}
              style={{ maxWidth: 180 }}
            />
          </div>
          <select
            className="input"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ maxWidth: 180 }}
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{statusConfig[s]?.label || s}</option>
            ))}
          </select>
          {(filterData || filterStatus) && (
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
              <X size={14} /> Limpar filtros
            </button>
          )}
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {filtered.length} {filtered.length === 1 ? 'agendamento' : 'agendamentos'}
          </span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {lA ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <div style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Carregando agendamentos...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><CalendarDays size={48} /></div>
              <div className="empty-state-title">Nenhum agendamento encontrado</div>
              <div className="empty-state-text">
                {filterData || filterStatus
                  ? 'Tente ajustar os filtros aplicados.'
                  : 'Clique em "+ Novo Agendamento" para começar.'}
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
                    <th>Valor</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => {
                    const sc = statusConfig[a.status] || { label: a.status, cls: 'badge-secondary' };
                    return (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.clienteNome || '-'}</td>
                        <td>{a.barbeiroNome || '-'}</td>
                        <td>{formatDate(a.data)}</td>
                        <td>{a.horario || '-'}</td>
                        <td>{a.servicoNome || a.servico || '-'}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                          {a.valorCobrado != null
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.valorCobrado)
                            : '-'}
                        </td>
                        <td>
                          <span className={`badge ${sc.cls}`}>{sc.label}</span>
                        </td>
                        <td>
                          <div className="table-actions" style={{ justifyContent: 'center' }}>
                            <button
                              className="btn-icon btn-icon-edit"
                              title="Editar"
                              onClick={() => openEdit(a)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="btn-icon btn-icon-delete"
                              title="Excluir"
                              onClick={() => askDelete(a)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          title={
            editingId
              ? <><Pencil size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Editar Agendamento</>
              : <><CalendarDays size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Novo Agendamento</>
          }
          size="md"
        >
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="input-row">
                <div className="input-group">
                  <label className="label">Cliente *</label>
                  <select
                    className="input"
                    value={form.clienteId}
                    onChange={handleClienteChange}
                    required
                  >
                    <option value="">Selecione...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="label">Barbeiro *</label>
                  <select
                    className="input"
                    value={form.barbeiroId}
                    onChange={handleBarbeiroChange}
                    required
                  >
                    <option value="">Selecione...</option>
                    {barbeiros.filter(b => b.ativo).map(b => (
                      <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-row">
                <div className="input-group">
                  <label className="label">Data *</label>
                  <input
                    className="input"
                    type="date"
                    name="data"
                    value={form.data}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="label">Horário *</label>
                  <input
                    className="input"
                    type="time"
                    name="horario"
                    value={form.horario}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="input-row">
                <div className="input-group">
                  <label className="label">Serviço *</label>
                  <select
                    className="input"
                    value={form.servicoId}
                    onChange={handleServicoChange}
                    required
                  >
                    <option value="">Selecione...</option>
                    {servicos.filter(s => s.ativo).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nome} — {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.preco)}
                      </option>
                    ))}
                  </select>
                  {form.servicoId && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(form.valorCobrado)} · Duração: {form.duracao} min
                    </div>
                  )}
                </div>

                <div className="input-group">
                  <label className="label">Status</label>
                  <select
                    className="input"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{statusConfig[s]?.label || s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                    Salvando...
                  </>
                ) : (
                  editingId ? 'Salvar alterações' : 'Criar agendamento'
                )}
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={confirm.open}
          title="Excluir agendamento"
          message="Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita."
          onConfirm={handleDelete}
          onCancel={() => setConfirm({ open: false, id: null })}
        />
      </main>
    </div>
  );
}
