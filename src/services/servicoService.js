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

function resolverCol(empresaId) {
  return empresaId
    ? collection(db, 'empresas', empresaId, 'servicos')
    : collection(db, 'servicos');
}

function resolverDoc(empresaId, id) {
  return empresaId
    ? doc(db, 'empresas', empresaId, 'servicos', id)
    : doc(db, 'servicos', id);
}

export const servicoService = {
  async listar(empresaId) {
    const q = query(resolverCol(empresaId), orderBy('criadoEm', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async adicionar(empresaId, data) {
    return addDoc(resolverCol(empresaId), {
      nome: data.nome || '',
      preco: Number(data.preco) || 0,       // em reais
      duracao: Number(data.duracao) || 0,   // em minutos
      ativo: data.ativo !== undefined ? data.ativo : true,
      criadoEm: serverTimestamp(),
    });
  },

  async atualizar(empresaId, id, data) {
    return updateDoc(resolverDoc(empresaId, id), {
      nome: data.nome || '',
      preco: Number(data.preco) || 0,
      duracao: Number(data.duracao) || 0,
      ativo: data.ativo !== undefined ? data.ativo : true,
      atualizadoEm: serverTimestamp(),
    });
  },

  async remover(empresaId, id) {
    return deleteDoc(resolverDoc(empresaId, id));
  },
};
