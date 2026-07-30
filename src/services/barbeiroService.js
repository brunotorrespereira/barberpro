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
  return collection(db, 'empresas', empresaId, 'barbeiros');
}

function resolverDoc(empresaId, id) {
  return doc(db, 'empresas', empresaId, 'barbeiros', id);
}

export const barbeiroService = {
  async listar(empresaId) {
    const q = query(resolverCol(empresaId), orderBy('criadoEm', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async adicionar(empresaId, data) {
    return addDoc(resolverCol(empresaId), {
      nome: data.nome || '',
      especialidade: data.especialidade || '',
      foto: data.foto || '',
      telefone: data.telefone || '',
      ativo: data.ativo !== undefined ? data.ativo : true,
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
