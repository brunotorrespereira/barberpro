import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useBarbeiros } from '../hooks/useBarbeiros';
import { barbeiroService } from '../services/barbeiroService';
import { useEmpresa } from '../hooks/useEmpresa';

const ESPECIALIDADES = [
  'Corte Masculino',
  'Barba',
  'Corte + Barba',
  'Coloração',
  'Hidratação',
  'Progressiva',
  'Corte Infantil',
];

const emptyForm = {
  nome: '',
  especialidade: 'Corte Masculino',
  foto: '',
  telefone: '',
  ativo: true,
};

export default function Barbeiros() {
  const { empresaId } = useEmpresa();
  const { barbeiros, loading, recarregar } = useBarbeiros();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: null, nome: '' });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (b) => {
    setEditingId(b.id);
    setForm({
      nome: b.nome || '',
      especialidade: b.especialidade || 'Corte Masculino',
      foto: b.foto || '',
      telefone: b.telefone || '',
      ativo: b.ativo !== undefined ? b.ativo : true,
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
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error('O nome do barbeiro é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await barbeiroService.atualizar(empresaId, editingId, form);
        toast.success('Barbeiro atualizado com sucesso!');
      } else {
        await barbeiroService.adicionar(empresaId, form);
        toast.success('Barbeiro cadastrado com sucesso!');
      }
      await recarregar();
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar barbeiro.');
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (b) => {
    setConfirm({ open: true, id: b.id, nome: b.nome });
  };

  const handleDelete = async () => {
    try {
      await barbeiroService.remover(empresaId, confirm.id);
      toast.success(`Barbeiro "${confirm.nome}" removido.`);
      await recarregar();
    } catch {
      toast.error('Erro ao remover barbeiro.');
    } finally {
      setConfirm({ open: false, id: null, nome: '' });
    }
  };

  const getInitials = (nome) => {
    if (!nome) return '?';
    return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const toggleAtivo = async (b) => {
    try {
      await barbeiroService.atualizar(empresaId, b.id, { ativo: !b.ativo });
      toast.success(b.ativo ? `${b.nome} desativado.` : `${b.nome} ativado!`);
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
          <h1 className="page-title">💈 Barbeiros</h1>
          <button className="btn btn-primary" onClick={openAdd}>
            + Novo Barbeiro
          </button>
        </div>

        <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {loading ? 'Carregando...' : `${barbeiros.length} barbeiros cadastrados · ${barbeiros.filter(b => b.ativo).length} ativos`}
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner"></div>
            <div style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Carregando barbeiros...</div>
          </div>
        ) : barbeiros.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💈</div>
            <div className="empty-state-title">Nenhum barbeiro cadastrado</div>
            <div className="empty-state-text">
              Clique em "+ Novo Barbeiro" para adicionar um profissional.
            </div>
          </div>
        ) : (
          <div className="card-grid">
            {barbeiros.map((b, i) => (
              <div
                key={b.id}
                className="barber-card"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="avatar avatar-xl">
                  {b.foto ? (
                    <img
                      src={b.foto}
                      alt={b.nome}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    getInitials(b.nome)
                  )}
                </div>

                <div>
                  <div className="barber-card-name">{b.nome}</div>
                  <div className="barber-card-specialty">{b.especialidade}</div>
                </div>

                <span
                  className={`badge ${b.ativo ? 'badge-success' : 'badge-danger'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleAtivo(b)}
                  title="Clique para alternar status"
                >
                  {b.ativo ? '● Ativo' : '● Inativo'}
                </span>

                {b.telefone && (
                  <div className="barber-card-phone">
                    📞 {b.telefone}
                  </div>
                )}

                <div className="barber-card-actions">
                  <button
                    className="btn-icon btn-icon-edit"
                    title="Editar"
                    onClick={() => openEdit(b)}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon btn-icon-delete"
                    title="Excluir"
                    onClick={() => askDelete(b)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          title={editingId ? '✏️ Editar Barbeiro' : '💈 Novo Barbeiro'}
          size="md"
        >
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="input-row">
                <div className="input-group">
                  <label className="label">Nome completo *</label>
                  <input
                    className="input"
                    name="nome"
                    type="text"
                    placeholder="Nome do barbeiro"
                    value={form.nome}
                    onChange={handleChange}
                    required
                    autoFocus
                  />
                </div>

                <div className="input-group">
                  <label className="label">Especialidade</label>
                  <select
                    className="input"
                    name="especialidade"
                    value={form.especialidade}
                    onChange={handleChange}
                  >
                    {ESPECIALIDADES.map(e => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-row">
                <div className="input-group">
                  <label className="label">Telefone</label>
                  <input
                    className="input"
                    name="telefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={form.telefone}
                    onChange={handleChange}
                  />
                </div>

                <div className="input-group">
                  <label className="label">URL da foto</label>
                  <input
                    className="input"
                    name="foto"
                    type="url"
                    placeholder="https://exemplo.com/foto.jpg"
                    value={form.foto}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {form.foto && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                  <div className="avatar avatar-xl">
                    <img
                      src={form.foto}
                      alt="Preview"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="ativo"
                    checked={form.ativo}
                    onChange={handleChange}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <span className="label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                    Barbeiro ativo (disponível para agendamentos)
                  </span>
                </label>
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
                  editingId ? 'Salvar alterações' : 'Cadastrar barbeiro'
                )}
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={confirm.open}
          title="Excluir barbeiro"
          message={`Tem certeza que deseja excluir "${confirm.nome}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm({ open: false, id: null, nome: '' })}
        />
      </main>
    </div>
  );
}
