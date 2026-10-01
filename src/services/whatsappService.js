import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

/**
 * Integração com WhatsApp (Evolution API) por empresa.
 *
 * IMPORTANTE: este service ainda NÃO fala com a Evolution API real.
 * As funções abaixo simulam (mock) o fluxo de conexão apenas para
 * validar a estrutura de dados e a experiência do painel. A troca
 * pela integração real (via backend próprio, sem expor API Key no
 * frontend) será feita em uma etapa futura.
 *
 * Documento: integracoes_whatsapp/{empresaId}
 */

function resolverDoc(empresaId) {
  return doc(db, 'integracoes_whatsapp', empresaId);
}

function instanciaMock(empresaId) {
  return `bp_${empresaId.slice(0, 8)}`;
}

export const whatsappService = {
  async buscar(empresaId) {
    const snap = await getDoc(resolverDoc(empresaId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  },

  /** MOCK: simula a criação da instância e a geração do QR Code. */
  async iniciarConexao(empresaId) {
    const ref = resolverDoc(empresaId);
    const snap = await getDoc(ref);

    const dadosConexao = {
      empresaId,
      evolutionInstance: instanciaMock(empresaId),
      status: 'aguardando_leitura',
      qrCode: 'MOCK_QR_CODE',
      numeroConectado: null,
      ultimoErro: null,
      atualizadoEm: serverTimestamp(),
    };

    if (snap.exists()) {
      await updateDoc(ref, dadosConexao);
    } else {
      await setDoc(ref, {
        ...dadosConexao,
        agenteAtivo: true,
        ultimaConexaoEm: null,
        criadoEm: serverTimestamp(),
      });
    }
  },

  /** MOCK: simula a leitura do QR Code e a conexão bem-sucedida. */
  async simularConexaoConcluida(empresaId, numero = '+55 11 91234-5678') {
    return updateDoc(resolverDoc(empresaId), {
      status: 'conectado',
      qrCode: null,
      numeroConectado: numero,
      ultimaConexaoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  },

  async desconectar(empresaId) {
    return updateDoc(resolverDoc(empresaId), {
      status: 'desconectado',
      qrCode: null,
      numeroConectado: null,
      atualizadoEm: serverTimestamp(),
    });
  },

  async setAgenteAtivo(empresaId, ativo) {
    return updateDoc(resolverDoc(empresaId), {
      agenteAtivo: ativo,
      atualizadoEm: serverTimestamp(),
    });
  },

  /**
   * Consulta o status REAL da instância na Evolution API, por meio do
   * backend próprio (server/) — nunca fala com a Evolution diretamente
   * do navegador. Backend também persiste o resultado neste documento.
   */
  async consultarStatusReal() {
    const backendUrl = import.meta.env.VITE_WHATSAPP_BACKEND_URL;
    if (!backendUrl) {
      throw new Error('VITE_WHATSAPP_BACKEND_URL não configurada no .env.');
    }

    const idToken = await auth.currentUser.getIdToken();
    const resp = await fetch(`${backendUrl}/whatsapp/status`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!resp.ok) {
      const corpo = await resp.json().catch(() => ({}));
      throw new Error(corpo.erro || 'Erro ao consultar status real do WhatsApp.');
    }

    return resp.json(); // { evolutionInstance, status, statusBruto, numeroConectado }
  },

  /**
   * Cria (empresa nova) ou reconecta (empresa já com instância) o WhatsApp
   * da empresa logada, via backend próprio — nunca fala com a Evolution
   * direto do navegador. Pode devolver um qrCode para escanear.
   */
  async conectar() {
    const backendUrl = import.meta.env.VITE_WHATSAPP_BACKEND_URL;
    if (!backendUrl) {
      throw new Error('VITE_WHATSAPP_BACKEND_URL não configurada no .env.');
    }

    const idToken = await auth.currentUser.getIdToken();
    const resp = await fetch(`${backendUrl}/whatsapp/conectar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!resp.ok) {
      const corpo = await resp.json().catch(() => ({}));
      throw new Error(corpo.erro || 'Erro ao conectar o WhatsApp.');
    }

    return resp.json(); // { evolutionInstance, status, statusBruto, numeroConectado, qrCode }
  },
};
