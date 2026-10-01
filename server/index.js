import { readFileSync } from 'fs';
import { timingSafeEqual } from 'crypto';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';

/**
 * Backend BarberPro — Firestore + Evolution API + agenda do n8n.
 *
 * Duas chaves distintas para a Evolution API:
 *   - EVOLUTION_API_KEY: escopada à instância (hoje só "barberpro"), usada
 *     em /whatsapp/status para leitura (GET /instance/fetchInstances).
 *   - EVOLUTION_ADMIN_API_KEY: chave GLOBAL do servidor Evolution, única
 *     com permissão para criar instâncias. Usada só em /whatsapp/conectar.
 *     Nunca substitui nem se mistura com EVOLUTION_API_KEY.
 *
 * N8N_EVOLUTION_WEBHOOK_URL: URL de produção do webhook do n8n (node
 * "Webhook Evolution API"). Usada só em /whatsapp/conectar, pra configurar
 * automaticamente o webhook de CADA instância nova/reconectada — nenhuma
 * instância específica fica hardcoded aqui, o nome (bp_<empresaId>) já é
 * calculado dinamicamente mais abaixo.
 */

const {
  PORT = 3001,
  ALLOWED_ORIGIN,
  EVOLUTION_API_URL,
  EVOLUTION_API_KEY,
  EVOLUTION_ADMIN_API_KEY,
  EVOLUTION_DEFAULT_INSTANCE = 'barberpro',
  FIREBASE_SERVICE_ACCOUNT_PATH,
  N8N_SERVICE_TOKEN,
  N8N_EVOLUTION_WEBHOOK_URL,
} = process.env;

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  throw new Error('EVOLUTION_API_URL e EVOLUTION_API_KEY são obrigatórios (ver server/.env.example).');
}
if (!FIREBASE_SERVICE_ACCOUNT_PATH) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH é obrigatório (ver server/.env.example).');
}
if (!N8N_SERVICE_TOKEN) {
  throw new Error('N8N_SERVICE_TOKEN é obrigatório (ver server/.env.example).');
}
// EVOLUTION_ADMIN_API_KEY e N8N_EVOLUTION_WEBHOOK_URL NÃO são exigidas no
// boot de propósito: só são usadas por /whatsapp/conectar. Faltando, só
// essa rota falha (checagem dentro dela) — não derruba o resto do backend
// (/agenda/*, /whatsapp/status) que já funciona.

const serviceAccount = JSON.parse(readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN || false }));
app.use(express.json());

/** Exige um ID Token válido do Firebase Auth no header Authorization. */
async function autenticar(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ erro: 'Token não informado.' });

  try {
    req.uid = (await admin.auth().verifyIdToken(idToken)).uid;
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

/** Exige que o usuário autenticado seja admin de uma empresa. */
async function carregarUsuarioAdmin(req, res, next) {
  const userSnap = await db.collection('users').doc(req.uid).get();
  const userData = userSnap.exists ? userSnap.data() : null;

  if (!userData?.empresaId) return res.status(403).json({ erro: 'Usuário sem empresa vinculada.' });
  if (userData.role !== 'admin') return res.status(403).json({ erro: 'Apenas administradores podem consultar o WhatsApp.' });

  req.empresaId = userData.empresaId;
  next();
}

/**
 * Exige o token de serviço do n8n no header Authorization.
 * Uso: chamadas máquina-a-máquina do workflow do Sebastião (não é login de usuário).
 */
function autenticarServico(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const esperado = Buffer.from(N8N_SERVICE_TOKEN);
  const recebido = Buffer.from(token || '');
  const valido = token && esperado.length === recebido.length && timingSafeEqual(esperado, recebido);

  if (!valido) return res.status(401).json({ erro: 'Token de serviço inválido.' });
  next();
}

/**
 * Resolve empresaId exclusivamente a partir do instanceName da Evolution —
 * nunca aceita empresaId vindo do chamador. Busca em integracoes_whatsapp
 * o documento cujo evolutionInstance bate com a instância recebida (o ID
 * do documento é o próprio empresaId). Sem fallback: instância não mapeada
 * é erro, não deve cair silenciosamente em nenhuma empresa "padrão".
 */
async function carregarEmpresaPorInstancia(req, res, next) {
  const instance = req.query.instance;
  if (!instance) return res.status(400).json({ erro: 'Parâmetro "instance" é obrigatório.' });

  try {
    const snap = await db
      .collection('integracoes_whatsapp')
      .where('evolutionInstance', '==', instance)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ erro: `Instância "${instance}" não está associada a nenhuma empresa.` });
    }

    req.empresaId = snap.docs[0].id;
    next();
  } catch (err) {
    console.error('[carregarEmpresaPorInstancia] erro:', err);
    res.status(500).json({ erro: 'Não foi possível resolver a empresa da instância.' });
  }
}

/** Traduz o estado bruto da Evolution API para o vocabulário já usado no painel. */
function mapearStatus(estadoBruto) {
  const mapa = { open: 'conectado', close: 'desconectado', connecting: 'aguardando_leitura' };
  return mapa[estadoBruto] || 'erro';
}

function extrairNumero(info) {
  if (info?.ownerJid) return info.ownerJid.split('@')[0];
  if (info?.number) return info.number;
  return null;
}

/**
 * Garante que a instância informada tenha o webhook configurado pro n8n
 * (evento MESSAGES_UPSERT). Idempotente — reenviar o mesmo payload não tem
 * efeito colateral, então pode ser chamada em toda passagem por
 * /whatsapp/conectar (criação, reconexão, ou empresa já conectada), sem
 * nunca desconectar a sessão, gerar QR ou criar outra instância. Nenhum
 * nome de instância fica hardcoded aqui — quem chama decide qual instância.
 */
async function configurarWebhookInstancia(instanceName) {
  const resp = await fetch(`${EVOLUTION_API_URL}/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    headers: { apikey: EVOLUTION_ADMIN_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: N8N_EVOLUTION_WEBHOOK_URL,
        events: ['MESSAGES_UPSERT'],
        byEvents: false,
        base64: false,
      },
    }),
  });
  if (!resp.ok) {
    throw new Error(`Evolution API respondeu ${resp.status} em /webhook/set/${instanceName}`);
  }
}

app.get('/whatsapp/status', autenticar, carregarUsuarioAdmin, async (req, res) => {
  try {
    const integracaoRef = db.collection('integracoes_whatsapp').doc(req.empresaId);
    const integracaoSnap = await integracaoRef.get();
    const instanceName = integracaoSnap.exists ? integracaoSnap.data().evolutionInstance : null;

    // SEM fallback para EVOLUTION_DEFAULT_INSTANCE: cada empresa só pode ver
    // a instância que ela mesma tem salva. Sem evolutionInstance próprio,
    // não há nada a consultar — nunca herdar dados de "barberpro" ou de
    // qualquer outra empresa.
    if (!instanceName) {
      return res.json({ evolutionInstance: null, status: 'nao_configurado', statusBruto: null, numeroConectado: null });
    }

    // Único endpoint chamado, e é de LEITURA: fetchInstances filtrado pela instância.
    // Usa a chave GLOBAL (EVOLUTION_ADMIN_API_KEY) — EVOLUTION_API_KEY é
    // escopada só à instância "barberpro" e falha (401) para qualquer outra.
    const resp = await fetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
      { headers: { apikey: EVOLUTION_ADMIN_API_KEY } }
    );

    if (!resp.ok) {
      throw new Error(`Evolution API respondeu ${resp.status} em /instance/fetchInstances`);
    }

    const corpo = await resp.json();
    const lista = Array.isArray(corpo) ? corpo : corpo?.instances || [];
    const info = lista.find(i => (i.name || i.instanceName) === instanceName) || lista[0] || null;

    if (!info) {
      throw new Error(`Instância "${instanceName}" não encontrada na resposta da Evolution API.`);
    }

    const estadoBruto = info.connectionStatus || info.state || null;
    const status = mapearStatus(estadoBruto);
    const numeroConectado = extrairNumero(info);

    const dadosAtualizados = {
      evolutionInstance: instanceName,
      status,
      statusBruto: estadoBruto,
      numeroConectado,
      ultimaConsultaEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Conexão confirmada: não há mais QR pra mostrar — limpa o resíduo,
    // se houver. Fora desse caso, não mexe no campo (merge preserva).
    if (status === 'conectado') {
      dadosAtualizados.qrCode = null;
    }

    await integracaoRef.set(dadosAtualizados, { merge: true });

    res.json({ evolutionInstance: instanceName, status, statusBruto: estadoBruto, numeroConectado });
  } catch (err) {
    console.error('[whatsapp/status] erro:', err);
    res.status(502).json({ erro: 'Não foi possível consultar a Evolution API.' });
  }
});

/**
 * Cria (empresa nova) ou reconecta (empresa já com instância) o WhatsApp da
 * empresa logada. Admin-only (ID Token) — nunca usa N8N_SERVICE_TOKEN.
 *
 * Proteções obrigatórias:
 *   - "barberpro" nunca é criada/recriada/reconectada por esta rota — é a
 *     instância de teste fixa, gerenciada manualmente, fora deste fluxo.
 *   - Se já estiver "conectado", não cria instância, não reconecta e não
 *     gera QR novo — só garante (idempotente) que o webhook da instância
 *     está configurado pro n8n, e devolve o cache.
 *   - Se a empresa já tiver evolutionInstance, reaproveita (nunca cria outra).
 */
app.post('/whatsapp/conectar', autenticar, carregarUsuarioAdmin, async (req, res) => {
  if (!EVOLUTION_ADMIN_API_KEY) {
    return res.status(500).json({ erro: 'EVOLUTION_ADMIN_API_KEY não configurada no backend.' });
  }
  if (!N8N_EVOLUTION_WEBHOOK_URL) {
    return res.status(500).json({ erro: 'N8N_EVOLUTION_WEBHOOK_URL não configurada no backend.' });
  }

  try {
    const integracaoRef = db.collection('integracoes_whatsapp').doc(req.empresaId);
    const integracaoSnap = await integracaoRef.get();
    const dadosAtuais = integracaoSnap.exists ? integracaoSnap.data() : null;

    const instanceName = dadosAtuais?.evolutionInstance || `bp_${req.empresaId}`;

    if (instanceName === EVOLUTION_DEFAULT_INSTANCE) {
      return res.status(403).json({
        erro: 'Esta instância é reservada para testes e não pode ser conectada por este fluxo.',
      });
    }

    if (dadosAtuais?.status === 'conectado') {
      // Já conectado — não mexe na sessão (sem create/connect/QR), mas
      // garante que o webhook desta instância esteja configurado. Cobre o
      // caso de uma instância que ficou conectada antes de existir esta
      // configuração automática, ou que perdeu o webhook num restart da
      // Evolution — sem exigir desconectar/reconectar o número.
      await configurarWebhookInstancia(instanceName);

      return res.json({
        evolutionInstance: dadosAtuais.evolutionInstance,
        status: dadosAtuais.status,
        statusBruto: dadosAtuais.statusBruto ?? null,
        numeroConectado: dadosAtuais.numeroConectado ?? null,
        qrCode: null,
      });
    }

    const instanciaJaCriada = !!dadosAtuais?.evolutionInstance;
    let qrCode = null;

    if (!instanciaJaCriada) {
      // Empresa nova — cria a instância (chave global de admin).
      const criarResp = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: { apikey: EVOLUTION_ADMIN_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
      });
      if (!criarResp.ok) {
        throw new Error(`Evolution API respondeu ${criarResp.status} em /instance/create`);
      }
      const corpoCriar = await criarResp.json();
      qrCode = corpoCriar?.qrcode?.base64 || null;
    } else {
      // Instância já existe — só busca um QR novo (reconectar), sem criar outra.
      const conectarResp = await fetch(
        `${EVOLUTION_API_URL}/instance/connect/${encodeURIComponent(instanceName)}`,
        { headers: { apikey: EVOLUTION_ADMIN_API_KEY } }
      );
      if (!conectarResp.ok) {
        throw new Error(`Evolution API respondeu ${conectarResp.status} em /instance/connect`);
      }
      const corpoConectar = await conectarResp.json();
      qrCode = corpoConectar?.base64 || null;
    }

    // Configura o webhook desta instância pra apontar pro n8n — tanto em
    // criação quanto em reconexão (idempotente, e também AUTOCURA o caso
    // da Evolution API perder a configuração de webhook num restart do
    // container). Nenhum nome de instância fica hardcoded: instanceName já
    // foi calculado dinamicamente acima (bp_<empresaId>, ou reaproveitado
    // se a empresa já tinha uma).
    await configurarWebhookInstancia(instanceName);

    // Confirma o estado real após criar/conectar (mesmo mapeamento de /whatsapp/status).
    const statusResp = await fetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
      { headers: { apikey: EVOLUTION_ADMIN_API_KEY } }
    );
    if (!statusResp.ok) {
      throw new Error(`Evolution API respondeu ${statusResp.status} em /instance/fetchInstances`);
    }
    const corpoStatus = await statusResp.json();
    const listaStatus = Array.isArray(corpoStatus) ? corpoStatus : corpoStatus?.instances || [];
    const info = listaStatus.find((i) => (i.name || i.instanceName) === instanceName) || listaStatus[0] || null;

    const estadoBruto = info?.connectionStatus || info?.state || null;
    const status = mapearStatus(estadoBruto);
    const numeroConectado = extrairNumero(info);

    await integracaoRef.set(
      {
        evolutionInstance: instanceName,
        status,
        statusBruto: estadoBruto,
        numeroConectado,
        qrCode,
        ultimaConsultaEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ evolutionInstance: instanceName, status, statusBruto: estadoBruto, numeroConectado, qrCode });
  } catch (err) {
    console.error('[whatsapp/conectar] erro:', err);
    res.status(502).json({ erro: 'Não foi possível conectar a instância na Evolution API.' });
  }
});

/**
 * Endpoints de agenda para o agente Sebastião (n8n) consultar dados reais
 * da empresa. Autenticação por token de serviço (não é o fluxo de admin).
 * Só leitura — nada aqui cria, edita ou remove agendamentos.
 */

app.get('/agenda/servicos', autenticarServico, carregarEmpresaPorInstancia, async (req, res) => {
  try {
    const snap = await db
      .collection('empresas')
      .doc(req.empresaId)
      .collection('servicos')
      .where('ativo', '==', true)
      .get();

    const servicos = snap.docs.map((d) => ({
      id: d.id,
      nome: d.data().nome,
      preco: d.data().preco,
      duracao: d.data().duracao,
    }));

    res.json(servicos);
  } catch (err) {
    console.error('[agenda/servicos] erro:', err);
    res.status(500).json({ erro: 'Não foi possível consultar os serviços.' });
  }
});

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const GRANULARIDADE_MIN = 15;
const ANTECEDENCIA_MINIMA_MIN = 30;

function paraMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function paraHHMM(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Resolve o dia da semana a partir de "YYYY-MM-DD" usando componentes
 * locais (evita o bug clássico de `new Date("YYYY-MM-DD")` interpretar
 * como UTC e "voltar" um dia dependendo do fuso do servidor).
 */
function resolverDiaDaSemana(dataStr) {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return DIAS_SEMANA[new Date(ano, mes - 1, dia).getDay()];
}

app.get('/agenda/disponibilidade', autenticarServico, carregarEmpresaPorInstancia, async (req, res) => {
  try {
    const { data, barbeiro, servico } = req.query;

    if (!data || !barbeiro || !servico) {
      return res.status(400).json({ erro: 'Parâmetros "data", "barbeiro" e "servico" são obrigatórios.' });
    }
    if (!REGEX_DATA.test(data)) {
      return res.status(400).json({ erro: 'Parâmetro "data" deve estar no formato YYYY-MM-DD.' });
    }

    const empresaRef = db.collection('empresas').doc(req.empresaId);

    const [servicoSnap, barbeiroSnap, empresaSnap] = await Promise.all([
      empresaRef.collection('servicos').doc(servico).get(),
      empresaRef.collection('barbeiros').doc(barbeiro).get(),
      empresaRef.get(),
    ]);

    if (!servicoSnap.exists || servicoSnap.data().ativo !== true) {
      return res.status(404).json({ erro: 'Serviço não encontrado.' });
    }
    if (!barbeiroSnap.exists || barbeiroSnap.data().ativo !== true) {
      return res.status(404).json({ erro: 'Barbeiro não encontrado.' });
    }

    const duracaoMinutos = Number(servicoSnap.data().duracao) || 0;

    const diaDaSemana = resolverDiaDaSemana(data);
    const horarioFuncionamento = empresaSnap.data()?.configuracoes?.horarioFuncionamento?.[diaDaSemana];

    if (!horarioFuncionamento?.aberto) {
      return res.json({ data, barbeiroId: barbeiro, servicoId: servico, duracaoMinutos, horariosDisponiveis: [] });
    }

    const aberturaMin = paraMinutos(horarioFuncionamento.abertura);
    const fechamentoMin = paraMinutos(horarioFuncionamento.fechamento);

    const agendamentosSnap = await empresaRef
      .collection('agendamentos')
      .where('data', '==', data)
      .where('barbeiroId', '==', barbeiro)
      .get();

    // Só "cancelado" libera o horário — pendente/confirmado/concluido bloqueiam.
    const ocupados = agendamentosSnap.docs
      .map((d) => d.data())
      .filter((a) => a.status !== 'cancelado')
      .map((a) => {
        const inicio = paraMinutos(a.horario);
        return { inicio, fim: inicio + (Number(a.duracao) || 0) };
      });

    // NOTA: depende do fuso horário do processo Node (TZ). Se o container
    // do Easypanel rodar em UTC e a barbearia for em outro fuso, "hoje" e
    // a antecedência de 30 min podem ficar incorretos — configurar TZ no
    // ambiente do backend (ex: America/Sao_Paulo) resolve isso.
    const agora = new Date();
    const hojeStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

    let inicioMin = aberturaMin;
    if (data === hojeStr) {
      const limiteMin = agora.getHours() * 60 + agora.getMinutes() + ANTECEDENCIA_MINIMA_MIN;
      const limiteArredondado = Math.ceil(limiteMin / GRANULARIDADE_MIN) * GRANULARIDADE_MIN;
      inicioMin = Math.max(aberturaMin, limiteArredondado);
    }

    const horariosDisponiveis = [];
    for (let candidato = inicioMin; candidato + duracaoMinutos <= fechamentoMin; candidato += GRANULARIDADE_MIN) {
      const fimCandidato = candidato + duracaoMinutos;
      const conflito = ocupados.some((o) => candidato < o.fim && fimCandidato > o.inicio);
      if (!conflito) horariosDisponiveis.push(paraHHMM(candidato));
    }

    res.json({ data, barbeiroId: barbeiro, servicoId: servico, duracaoMinutos, horariosDisponiveis });
  } catch (err) {
    console.error('[agenda/disponibilidade] erro:', err);
    res.status(500).json({ erro: 'Não foi possível consultar a disponibilidade.' });
  }
});

const REGEX_HORARIO = /^\d{2}:\d{2}$/;

/** Erro interno usado só para abortar a transação com uma causa identificável. */
class ConflitoDeHorarioError extends Error {}

app.post('/agenda/agendamentos', autenticarServico, carregarEmpresaPorInstancia, async (req, res) => {
  try {
    const { barbeiroId, servicoId, data, horario, clienteNome, mensagemId } = req.body || {};
    const clienteTelefone = (req.body?.clienteTelefone || '').replace(/\D/g, '');

    if (!barbeiroId || !servicoId || !data || !horario || !clienteTelefone || !clienteNome) {
      return res.status(400).json({
        erro: 'Campos obrigatórios: barbeiroId, servicoId, data, horario, clienteTelefone, clienteNome.',
      });
    }
    if (!REGEX_DATA.test(data)) {
      return res.status(400).json({ erro: 'Parâmetro "data" deve estar no formato YYYY-MM-DD.' });
    }
    if (!REGEX_HORARIO.test(horario)) {
      return res.status(400).json({ erro: 'Parâmetro "horario" deve estar no formato HH:MM.' });
    }

    const empresaRef = db.collection('empresas').doc(req.empresaId);

    const [servicoSnap, barbeiroSnap, empresaSnap] = await Promise.all([
      empresaRef.collection('servicos').doc(servicoId).get(),
      empresaRef.collection('barbeiros').doc(barbeiroId).get(),
      empresaRef.get(),
    ]);

    if (!servicoSnap.exists || servicoSnap.data().ativo !== true) {
      return res.status(404).json({ erro: 'Serviço não encontrado.' });
    }
    if (!barbeiroSnap.exists || barbeiroSnap.data().ativo !== true) {
      return res.status(404).json({ erro: 'Barbeiro não encontrado.' });
    }

    const servicoData = servicoSnap.data();
    const barbeiroData = barbeiroSnap.data();
    const duracaoMinutos = Number(servicoData.duracao) || 0;

    const diaDaSemana = resolverDiaDaSemana(data);
    const horarioFuncionamento = empresaSnap.data()?.configuracoes?.horarioFuncionamento?.[diaDaSemana];

    if (!horarioFuncionamento?.aberto) {
      return res.status(400).json({ erro: 'A empresa não funciona nesse dia da semana.' });
    }

    const aberturaMin = paraMinutos(horarioFuncionamento.abertura);
    const fechamentoMin = paraMinutos(horarioFuncionamento.fechamento);
    const inicioMin = paraMinutos(horario);
    const fimMin = inicioMin + duracaoMinutos;

    if (inicioMin < aberturaMin || fimMin > fechamentoMin) {
      return res.status(400).json({ erro: 'Horário fora do expediente da empresa.' });
    }

    // Mesma antecedência mínima usada em /agenda/disponibilidade, para nunca
    // criar um horário que a consulta de disponibilidade não teria oferecido.
    const agora = new Date();
    const hojeStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
    if (data === hojeStr) {
      const limiteMin = agora.getHours() * 60 + agora.getMinutes() + ANTECEDENCIA_MINIMA_MIN;
      if (inicioMin < limiteMin) {
        return res.status(400).json({ erro: 'Horário não respeita a antecedência mínima de 30 minutos.' });
      }
    }

    const agendamentosCol = empresaRef.collection('agendamentos');
    const clientesCol = empresaRef.collection('clientes');

    const agendamentoRef = mensagemId
      ? agendamentosCol.doc(`wa_${mensagemId}`)
      : agendamentosCol.doc();

    const resultado = await db.runTransaction(async (transaction) => {
      // 1) Idempotência: se esse mensagemId já gerou um agendamento, devolve o que já existe.
      const agendamentoExistenteSnap = await transaction.get(agendamentoRef);
      if (mensagemId && agendamentoExistenteSnap.exists) {
        return { repetido: true, id: agendamentoRef.id, dados: agendamentoExistenteSnap.data() };
      }

      // 2) Resolve cliente por telefone (busca; cria se não existir).
      const clienteQuerySnap = await transaction.get(
        clientesCol.where('telefone', '==', clienteTelefone).limit(1)
      );

      let clienteId;
      let clienteNomeFinal;
      let novoClienteRef = null;

      if (!clienteQuerySnap.empty) {
        const doc = clienteQuerySnap.docs[0];
        clienteId = doc.id;
        clienteNomeFinal = doc.data().nome || clienteNome;
      } else {
        novoClienteRef = clientesCol.doc();
        clienteId = novoClienteRef.id;
        clienteNomeFinal = clienteNome;
      }

      // 3) Checagem final de conflito, atômica (revalida mesmo que /agenda/disponibilidade
      //    tenha sido consultada segundos antes).
      const agendamentosSnap = await transaction.get(
        agendamentosCol.where('data', '==', data).where('barbeiroId', '==', barbeiroId)
      );
      const conflito = agendamentosSnap.docs
        .map((d) => d.data())
        .filter((a) => a.status !== 'cancelado')
        .some((a) => {
          const ini = paraMinutos(a.horario);
          const fim = ini + (Number(a.duracao) || 0);
          return inicioMin < fim && fimMin > ini;
        });

      if (conflito) {
        throw new ConflitoDeHorarioError();
      }

      // 4) Grava (cliente novo, se houver, e o agendamento).
      if (novoClienteRef) {
        transaction.set(novoClienteRef, {
          nome: clienteNome,
          telefone: clienteTelefone,
          servico: '',
          observacoes: '',
          criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      const dadosAgendamento = {
        clienteId,
        clienteNome: clienteNomeFinal,
        barbeiroId,
        barbeiroNome: barbeiroData.nome,
        servicoId,
        servicoNome: servicoData.nome,
        valorCobrado: Number(servicoData.preco) || 0,
        duracao: duracaoMinutos,
        data,
        horario,
        status: 'confirmado',
        origem: 'agente_whatsapp',
        origemMensagemId: mensagemId || null,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.set(agendamentoRef, dadosAgendamento);

      return { repetido: false, id: agendamentoRef.id, dados: dadosAgendamento };
    });

    const corpoResposta = {
      id: resultado.id,
      clienteId: resultado.dados.clienteId,
      clienteNome: resultado.dados.clienteNome,
      barbeiroId: resultado.dados.barbeiroId,
      barbeiroNome: resultado.dados.barbeiroNome,
      servicoId: resultado.dados.servicoId,
      servicoNome: resultado.dados.servicoNome,
      valorCobrado: resultado.dados.valorCobrado,
      duracao: resultado.dados.duracao,
      data: resultado.dados.data,
      horario: resultado.dados.horario,
      status: resultado.dados.status,
      idempotente: resultado.repetido,
    };

    res.status(resultado.repetido ? 200 : 201).json(corpoResposta);
  } catch (err) {
    if (err instanceof ConflitoDeHorarioError) {
      return res.status(409).json({ erro: 'Horário já ocupado por outro agendamento.' });
    }
    console.error('[agenda/agendamentos] erro:', err);
    res.status(500).json({ erro: 'Não foi possível criar o agendamento.' });
  }
});

app.get('/agenda/barbeiros', autenticarServico, carregarEmpresaPorInstancia, async (req, res) => {
  try {
    const snap = await db
      .collection('empresas')
      .doc(req.empresaId)
      .collection('barbeiros')
      .where('ativo', '==', true)
      .get();

    const barbeiros = snap.docs.map((d) => ({
      id: d.id,
      nome: d.data().nome,
      especialidade: d.data().especialidade || null,
    }));

    res.json(barbeiros);
  } catch (err) {
    console.error('[agenda/barbeiros] erro:', err);
    res.status(500).json({ erro: 'Não foi possível consultar os barbeiros.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de status do WhatsApp ouvindo na porta ${PORT}`);
});
