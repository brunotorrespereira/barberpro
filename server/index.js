import { readFileSync } from 'fs';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';

/**
 * Servidor mínimo — SOMENTE LEITURA — para consultar o status real de uma
 * instância da Evolution API sem expor a API key no frontend do BarberPro.
 *
 * Nunca chama endpoints de escrita da Evolution API (criar, conectar/QR,
 * logout ou deletar instância) — apenas GET /instance/fetchInstances.
 */

const {
  PORT = 3001,
  ALLOWED_ORIGIN,
  EVOLUTION_API_URL,
  EVOLUTION_API_KEY,
  EVOLUTION_DEFAULT_INSTANCE = 'barberpro',
  FIREBASE_SERVICE_ACCOUNT_PATH,
} = process.env;

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  throw new Error('EVOLUTION_API_URL e EVOLUTION_API_KEY são obrigatórios (ver server/.env.example).');
}
if (!FIREBASE_SERVICE_ACCOUNT_PATH) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH é obrigatório (ver server/.env.example).');
}

const serviceAccount = JSON.parse(readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN || false }));

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

app.get('/whatsapp/status', autenticar, carregarUsuarioAdmin, async (req, res) => {
  try {
    const integracaoRef = db.collection('integracoes_whatsapp').doc(req.empresaId);
    const integracaoSnap = await integracaoRef.get();
    const instanceName =
      (integracaoSnap.exists && integracaoSnap.data().evolutionInstance) || EVOLUTION_DEFAULT_INSTANCE;

    // Único endpoint chamado, e é de LEITURA: fetchInstances filtrado pela instância.
    const resp = await fetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
      { headers: { apikey: EVOLUTION_API_KEY } }
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

    await integracaoRef.set(
      {
        evolutionInstance: instanceName,
        status,
        statusBruto: estadoBruto,
        numeroConectado,
        ultimaConsultaEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ evolutionInstance: instanceName, status, statusBruto: estadoBruto, numeroConectado });
  } catch (err) {
    console.error('[whatsapp/status] erro:', err);
    res.status(502).json({ erro: 'Não foi possível consultar a Evolution API.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de status do WhatsApp ouvindo na porta ${PORT}`);
});
