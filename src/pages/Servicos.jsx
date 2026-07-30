import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useServicos } from '../hooks/useServicos';
import { useEmpresa } from '../hooks/useEmpresa';
import { servicoService } from '../services/servicoService';

const emptyForm = {
  nome: '',
  preco: '',
  duracao: '',
  ativo: true,
};

function formatarPreco(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarDuracao(min) {
  if (!min) return '-';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export default function Servicos() {
  const { empresaId, role } = useEmpresa();
  const { servicos, loading, recarregar } = useServicos();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: null, nome: '' });

  if (role !== 'admin') return <Navigate to="/" replace />;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      nome: s.nome || '',
      preco: s.preco ?? '',
      duracao: s.duracao ?? '',
      ativo: s.ativo !== undefined ? s.ativo : true,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error('O nome do serviço é obrigatório.');
    if (form.preco === '' || Number(form.preco) < 0) return toast.error('Informe um preço válido.');
    if (form.duracao === '' || Number(form.duracao) <= 0) return toast.error('Informe uma duração válida.');

    setSaving(true);
    try {
      if (editingId) {
        await servicoService.atualizar(empresaId, editingId, form);
        toast.success('Serviço atualizado com sucesso!');
      } else {
        await servicoService.adicionar(empresaId, form);
        toast.success('Serviço cadastrado com sucesso!');
      }
      await recarregar();
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar serviço. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await servicoService.remover(empresaId, confirm.id);
      toast.success(`Serviço "${confirm.nome}" removido.`);
      await recarregar();
    } catch {
      toast.error('Erro ao remover serviço.');
    } finally {
      setConfirm({ open: false, id: null, nome: '' });
    }
  };

  const toggleAtivo = async (s) => {
    try {
      await servicoService.atualizar(empresaId, s.id, { ...s, ativo: !s.ativo });
      toast.success(s.ativo ? `"${s.nome}" desativado.` : `"${s.nome}" ativado!`);
      await recarregar();
    } catch {
      toast.error('Erro ao atualizar status.');
    }
  };

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">✂️ Serviços</h1>
          <button className="btn btn-primary" onClick={openAdd}>
            + Novo Serviço
          </button>
        </div>

        <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {loading ? 'Carregando...' : `${servicos.length} serviços · ${servicos.filter(s => s.ativo).length} ativos`}
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <div style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Carregando serviços...</div>
            </div>
          ) : servicos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✂️</div>
              <div className="empty-state-title">Nenhum serviço cadastrado</div>
              <div className="empty-state-text">Clique em "+ Novo Serviço" para começar.</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th>Preço</th>
                    <th>Duração</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.nome}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {formatarPreco(s.preco)}
                      </td>
                      <td>{formatarDuracao(s.duracao)}</td>
                      <td>
                        <span
                          className={`badge ${s.ativo ? 'badge-success' : 'badge-danger'}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleAtivo(s)}
                          title="Clique para alternar status"
                        >
                          {s.ativo ? '● Ativo' : '● Inativo'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          <button className="btn-icon btn-icon-edit" title="Editar" onClick={() => openEdit(s)}>✏️</button>
                          <button className="btn-icon btn-icon-delete" title="Excluir" onClick={() => setConfirm({ open: true, id: s.id, nome: s.nome })}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Modal isOpen={modalOpen} onClose={closeModal} title={editingId ? '✏️ Editar Serviço' : '✂️ Novo Serviço'} size="sm">
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="input-group">
                <label className="label">Nome do serviço *</label>
                <input className="input" name="nome" type="text" placeholder="Ex: Corte + Barba" value={form.nome} onChange={handleChange} required autoFocus />
              </div>

              <div className="input-row">
                <div className="input-group">
                  <label className="label">Preço (R$) *</label>
                  <input className="input" name="preco" type="number" min="0" step="0.01" placeholder="0,00" value={form.preco} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label className="label">Duração (min) *</label>
                  <input className="input" name="duracao" type="number" min="1" step="1" placeholder="30" value={form.duracao} onChange={handleChange} required />
                </div>
              </div>

              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" name="ativo" checked={form.ativo} onChange={handleChange}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <span className="label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                    Serviço ativo (disponível para agendamentos)
                  </span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Salvando...</> : editingId ? 'Salvar alterações' : 'Cadastrar serviço'}
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={confirm.open}
          title="Excluir serviço"
          message={`Tem certeza que deseja excluir "${confirm.nome}"? Agendamentos existentes não serão afetados.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm({ open: false, id: null, nome: '' })}
        />
      </main>
    </div>
  );
}
