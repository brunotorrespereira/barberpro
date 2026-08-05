import { useState, useMemo } from 'react';
import { Pencil, Trash2, Users, Search, UserPlus } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useClientes } from '../hooks/useClientes';
import { clienteService } from '../services/clienteService';
import { useEmpresa } from '../hooks/useEmpresa';

const SERVICOS = ['Cabelo', 'Barba', 'Cabelo + Barba', 'Hidratação', 'Progressiva'];

const emptyForm = {
  nome: '',
  telefone: '',
  servico: 'Cabelo',
  observacoes: '',
};

export default function Clientes() {
  const { empresaId } = useEmpresa();
  const { clientes, loading, recarregar } = useClientes();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: null, nome: '' });

  const filtered = useMemo(() =>
    clientes.filter(c =>
      c.nome?.toLowerCase().includes(search.toLowerCase()) ||
      c.telefone?.includes(search)
    ),
    [clientes, search]
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome || '',
      telefone: c.telefone || '',
      servico: c.servico || 'Cabelo',
      observacoes: c.observacoes || '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error('O nome do cliente é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await clienteService.atualizar(empresaId, editingId, form);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await clienteService.adicionar(empresaId, form);
        toast.success('Cliente cadastrado com sucesso!');
      }
      await recarregar();
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar cliente. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (c) => {
    setConfirm({ open: true, id: c.id, nome: c.nome });
  };

  const handleDelete = async () => {
    try {
      await clienteService.remover(empresaId, confirm.id);
      toast.success(`Cliente "${confirm.nome}" removido.`);
      await recarregar();
    } catch {
      toast.error('Erro ao remover cliente.');
    } finally {
      setConfirm({ open: false, id: null, nome: '' });
    }
  };

  const getInitials = (nome) => {
    if (!nome) return '?';
    return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={22} /> Clientes
          </h1>
          <button className="btn btn-primary" onClick={openAdd}>
            + Novo Cliente
          </button>
        </div>

        <div className="filters-bar">
          <div className="search-bar">
            <span className="search-bar-icon"><Search size={16} /></span>
            <input
              className="input"
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'}
          </span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <div style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Carregando clientes...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Users size={48} /></div>
              <div className="empty-state-title">
                {search ? 'Nenhum resultado' : 'Nenhum cliente cadastrado'}
              </div>
              <div className="empty-state-text">
                {search
                  ? `Nenhum cliente encontrado para "${search}".`
                  : 'Clique em "Novo Cliente" para começar.'}
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Telefone</th>
                    <th>Serviço</th>
                    <th>Observações</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="avatar">{getInitials(c.nome)}</div>
                          <span style={{ fontWeight: 500 }}>{c.nome}</span>
                        </div>
                      </td>
                      <td>{c.telefone || <span style={{ color: 'var(--text-secondary)' }}>-</span>}</td>
                      <td>
                        {c.servico
                          ? <span className="badge badge-accent">{c.servico}</span>
                          : <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.observacoes || '-'}
                      </td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          <button
                            className="btn-icon btn-icon-edit"
                            title="Editar"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="btn-icon btn-icon-delete"
                            title="Excluir"
                            onClick={() => askDelete(c)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
              ? <><Pencil size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Editar Cliente</>
              : <><UserPlus size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Novo Cliente</>
          }
          size="md"
        >
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="input-group">
                <label className="label">Nome completo *</label>
                <input
                  className="input"
                  name="nome"
                  type="text"
                  placeholder="Nome do cliente"
                  value={form.nome}
                  onChange={handleChange}
                  required
                  autoFocus
                />
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
                  <label className="label">Serviço preferido</label>
                  <select
                    className="input"
                    name="servico"
                    value={form.servico}
                    onChange={handleChange}
                  >
                    {SERVICOS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label className="label">Observações</label>
                <textarea
                  className="input"
                  name="observacoes"
                  placeholder="Observações sobre o cliente..."
                  value={form.observacoes}
                  onChange={handleChange}
                  rows={3}
                />
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
                  editingId ? 'Salvar alterações' : 'Cadastrar cliente'
                )}
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={confirm.open}
          title="Excluir cliente"
          message={`Tem certeza que deseja excluir "${confirm.nome}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm({ open: false, id: null, nome: '' })}
        />
      </main>
    </div>
  );
}
