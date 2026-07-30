import {
  collection,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { VERSAO_PLANOS_ATUAL } from '../config/planos';

// ---------------------------------------------------------------------------
// Utilitários internos
// ---------------------------------------------------------------------------

function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function calcularTrialExpiracao(dias = 14) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return Timestamp.fromDate(data);
}

/** Estrutura inicial de configurações da empresa (preparada para futuro). */
function configuracoesPadrao() {
  return {
    logo: null,
    corPrimaria: null,
    endereco: {
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      estado: null,
      cep: null,
    },
    telefone: null,
    whatsapp: null,
    email: null,
    redesSociais: {
      instagram: null,
      facebook: null,
      tiktok: null,
    },
    pix: {
      tipo: null,   // "cpf" | "cnpj" | "email" | "telefone" | "aleatoria"
      chave: null,
    },
    horarioFuncionamento: {
      segunda: { aberto: true,  abertura: '09:00', fechamento: '19:00' },
      terca:   { aberto: true,  abertura: '09:00', fechamento: '19:00' },
      quarta:  { aberto: true,  abertura: '09:00', fechamento: '19:00' },
      quinta:  { aberto: true,  abertura: '09:00', fechamento: '19:00' },
      sexta:   { aberto: true,  abertura: '09:00', fechamento: '19:00' },
      sabado:  { aberto: true,  abertura: '09:00', fechamento: '17:00' },
      domingo: { aberto: false, abertura: null,     fechamento: null    },
    },
  };
}

/** Estrutura inicial da assinatura (desacoplada da empresa). */
function assinaturaPadrao(empresaId) {
  return {
    empresaId,
    status: 'trial',                        // "trial" | "ativo" | "inadimplente" | "cancelado" | "suspenso"
    trialExpiresAt: calcularTrialExpiracao(14),
    gateway: null,                          // "stripe" | "mercadopago" | "asaas" | null
    customerId: null,
    subscriptionId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  };
}

// ---------------------------------------------------------------------------
// empresaService
// ---------------------------------------------------------------------------

export const empresaService = {
  /** Busca o documento do usuário em users/{uid}. */
  async buscarUsuario(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data(); // { empresaId, role, nome, email }
  },

  /** Busca a empresa pelo ID (sem assinatura). */
  async buscarPorId(empresaId) {
    const snap = await getDoc(doc(db, 'empresas', empresaId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  },

  /**
   * Busca a assinatura desacoplada da empresa.
   * Documento em assinaturas/{empresaId} — mesmo ID da empresa.
   */
  async buscarAssinatura(empresaId) {
    const snap = await getDoc(doc(db, 'assinaturas', empresaId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  },

  /**
   * Cria a empresa, a assinatura e registra o usuário administrador.
   * Chamado no fluxo "Criar minha barbearia".
   *
   * Coleções criadas:
   *   - empresas/{empresaId}
   *   - assinaturas/{empresaId}   ← mesmo ID, desacoplada
   *   - users/{uid}
   *
   * @param {string} uid - UID do usuário autenticado
   * @param {object} data - { nome, nomeProprietario, email }
   */
  async criar(uid, { nome, nomeProprietario, email }) {
    // Gera a referência da empresa antecipadamente para usar o ID no batch
    const empresaRef = doc(collection(db, 'empresas'));
    const empresaId = empresaRef.id;

    const batch = writeBatch(db);

    // 1. Empresa (sem dados de assinatura)
    batch.set(empresaRef, {
      nome,
      slug: gerarSlug(nome),
      proprietarioUid: uid,
      ativo: true,
      planoId: 'starter',
      versaoPlano: VERSAO_PLANOS_ATUAL,
      configuracoes: configuracoesPadrao(),
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });

    // 2. Assinatura desacoplada (mesmo ID da empresa)
    batch.set(doc(db, 'assinaturas', empresaId), assinaturaPadrao(empresaId));

    // 3. Usuário administrador
    batch.set(doc(db, 'users', uid), {
      empresaId,
      role: 'admin',
      nome: nomeProprietario,
      email,
      criadoEm: serverTimestamp(),
    });

    // Commit atômico — ou tudo é criado, ou nada
    await batch.commit();

    return empresaRef;
  },

  async atualizar(empresaId, data) {
    return updateDoc(doc(db, 'empresas', empresaId), {
      ...data,
      atualizadoEm: serverTimestamp(),
    });
  },

  async atualizarConfiguracoes(empresaId, configuracoes) {
    return updateDoc(doc(db, 'empresas', empresaId), {
      configuracoes,
      atualizadoEm: serverTimestamp(),
    });
  },

  async atualizarAssinatura(empresaId, data) {
    return updateDoc(doc(db, 'assinaturas', empresaId), {
      ...data,
      atualizadoEm: serverTimestamp(),
    });
  },

  remover() {
    throw new Error(
      '[empresaService.remover] A exclusão de empresas não pode ser realizada pelo cliente. ' +
      'Este processo deve ser executado por um fluxo administrativo seguro no backend, ' +
      'garantindo a remoção consistente de empresas, assinaturas, usuários e subcoleções.'
    );
  },
};
