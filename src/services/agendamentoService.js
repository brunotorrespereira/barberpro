import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Resolve o caminho da collection de agendamentos.
 * - Com empresaId → empresas/{empresaId}/agendamentos  (SaaS)
 * - Sem empresaId → agendamentos                       (fallback legado)
 */
function resolverCol(empresaId) {
  return empresaId
    ? collection(db, 'empresas', empresaId, 'agendamentos')
    : collection(db, 'agendamentos');
}

function resolverDoc(empresaId, id) {
  return empresaId
    ? doc(db, 'empresas', empresaId, 'agendamentos', id)
    : doc(db, 'agendamentos', id);
}

export const agendamentoService = {
  async listar(empresaId) {
    const q = query(resolverCol(empresaId), orderBy('criadoEm', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async adicionar(empresaId, data) {
    return addDoc(resolverCol(empresaId), {
      clienteId: data.clienteId || '',
      clienteNome: data.clienteNome || '',
      barbeiroId: data.barbeiroId || '',
      barbeiroNome: data.barbeiroNome || '',
      servicoId: data.servicoId || '',
      servicoNome: data.servicoNome || '',
      valorCobrado: Number(data.valorCobrado) || 0,
      duracao: Number(data.duracao) || 0,
      data: data.data || '',
      horario: data.horario || '',
      status: data.status || 'pendente',
      criadoEm: serverTimestamp(),
    });
  },

  async atualizar(empresaId, id, data) {
    return updateDoc(resolverDoc(empresaId, id), {
      ...data,
      atualizadoEm: serverTimestamp(),
    });
  },

  async remover(empresaId, id) {
    return deleteDoc(resolverDoc(empresaId, id));
  },
};
