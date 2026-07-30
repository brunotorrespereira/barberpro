import {
  collection,
  getDocs,
  setDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Migração de dados para arquitetura SaaS multiempresa.
 *
 * COMPORTAMENTO:
 *   - Lê de:   /clientes, /barbeiros, /agendamentos  (coleções legadas)
 *   - Grava em: empresas/{empresaId}/clientes, /barbeiros, /agendamentos
 *   - Usa setDoc com o ID original → idempotente (seguro para executar mais de uma vez)
 *   - NÃO apaga nenhuma coleção de origem
 *
 * @param {string} empresaId - ID da empresa destino
 * @param {object} callbacks
 * @param {function} callbacks.onColecaoInicio   - (nomeColecao, total) => void
 * @param {function} callbacks.onDocMigrado      - (nomeColecao, migrados, total) => void
 * @param {function} callbacks.onColecaoConcluida - (nomeColecao, relatorio) => void
 * @returns {Promise<object>} Relatório final por coleção
 */
export async function migrarDados(empresaId, { onColecaoInicio, onDocMigrado, onColecaoConcluida } = {}) {
  if (!empresaId) throw new Error('[migrarDados] empresaId é obrigatório.');

  const COLECOES = ['clientes', 'barbeiros', 'agendamentos'];
  const relatorioFinal = {};

  for (const nomeCol of COLECOES) {
    // Lê todos os documentos da coleção legada
    const snap = await getDocs(collection(db, nomeCol));
    const total = snap.size;

    onColecaoInicio?.(nomeCol, total);

    let migrados = 0;
    let ignorados = 0; // total = 0 → nada a migrar
    let erros = 0;
    const detalhesErro = [];

    if (total === 0) {
      const rel = { total: 0, migrados: 0, ignorados: 0, erros: 0 };
      relatorioFinal[nomeCol] = rel;
      onColecaoConcluida?.(nomeCol, rel);
      continue;
    }

    for (const docSnap of snap.docs) {
      try {
        // setDoc com o ID original → idempotente
        await setDoc(
          doc(db, 'empresas', empresaId, nomeCol, docSnap.id),
          docSnap.data()
        );
        migrados++;
        onDocMigrado?.(nomeCol, migrados, total);
      } catch (err) {
        erros++;
        detalhesErro.push({ id: docSnap.id, erro: err.message });
        console.error(`[migrarDados] Erro em ${nomeCol}/${docSnap.id}:`, err);
      }
    }

    const rel = { total, migrados, ignorados, erros, detalhesErro };
    relatorioFinal[nomeCol] = rel;
    onColecaoConcluida?.(nomeCol, rel);
  }

  return relatorioFinal;
}
