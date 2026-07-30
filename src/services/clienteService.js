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
 * Resolve o caminho da collection de clientes.
 * - Com empresaId → empresas/{empresaId}/clientes  (SaaS)
 * - Sem empresaId → clientes                       (fallback legado)
 */
function resolverCol(empresaId) {
  return empresaId
    ? collection(db, 'empresas', empresaId, 'clientes')
    : collection(db, 'clientes');
}

function resolverDoc(empresaId, id) {
  return empresaId
    ? doc(db, 'empresas', empresaId, 'clientes', id)
    : doc(db, 'clientes', id);
}

export const clienteService = {
  async listar(empresaId) {
    const q = query(resolverCol(empresaId), orderBy('criadoEm', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async adicionar(empresaId, data) {
    return addDoc(resolverCol(empresaId), {
      ...data,
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
