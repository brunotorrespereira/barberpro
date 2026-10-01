import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  MessageCircle,
  Smartphone,
  Bot,
  Info,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/Toast';
import { useEmpresa } from '../hooks/useEmpresa';
import { useWhatsapp } from '../hooks/useWhatsapp';
import { whatsappService } from '../services/whatsappService';

// A Evolution API devolve o mesmo QR em cache se pedido cedo demais depois
// do anterior — esse é o tempo mínimo de espera antes de pedir um QR novo.
const COOLDOWN_NOVO_QR_SEG = 30;

const statusConfig = {
  nao_configurado:    { label: 'Não conectado',            cls: 'badge-secondary' },
  gerando_qr:         { label: 'Gerando QR Code...',        cls: 'badge-warning'   },
  aguardando_leitura: { label: 'Aguardando leitura do QR',  cls: 'badge-warning'   },
  conectado:          { label: 'Conectado',                 cls: 'badge-success'   },
  desconectado:       { label: 'Desconectado',               cls: 'badge-danger'    },
  erro:               { label: 'Erro na conexão',            cls: 'badge-danger'    },
};

export default function Integracoes() {
  const { empresaId, role } = useEmpresa();
  const { integracao, loading, recarregar } = useWhatsapp();
  const toast = useToast();

  const [consultando, setConsultando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [cooldownQr, setCooldownQr] = useState(0);

  if (role !== 'admin') return <Navigate to="/" replace />;

  const status = integracao?.status ?? 'nao_configurado';
  const cfg = statusConfig[status] || statusConfig.nao_configurado;
  const conectado = status === 'conectado';
  const aguardandoLeitura = status === 'aguardando_leitura';

  // Enquanto o QR estiver na tela, consulta o status real periodicamente
  // até a conexão ser confirmada (ou o usuário sair da tela).
  useEffect(() => {
    if (!aguardandoLeitura) return;

    const intervalo = setInterval(async () => {
      try {
        await whatsappService.consultarStatusReal();
        await recarregar();
      } catch (err) {
        console.error('Erro no polling de status:', err);
      }
    }, 4000);

    return () => clearInterval(intervalo);
  }, [aguardandoLeitura, recarregar]);

  // Contagem regressiva do cooldown de "Gerar novo QR Code".
  useEffect(() => {
    if (cooldownQr <= 0) return;
    const t = setTimeout(() => setCooldownQr((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldownQr]);

  const handleConectar = async () => {
    setConectando(true);
    try {
      const resultado = await whatsappService.conectar();
      if (resultado.status === 'conectado') {
        toast.success('WhatsApp já está conectado!');
      } else if (resultado.qrCode) {
        toast.info('QR Code gerado. Escaneie para conectar.');
        // Evita pedir outro QR cedo demais e receber o mesmo QR em cache da Evolution.
        setCooldownQr(COOLDOWN_NOVO_QR_SEG);
      }
      await recarregar();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Erro ao conectar o WhatsApp.');
    } finally {
      setConectando(false);
    }
  };

  const handleConsultarReal = async () => {
    setConsultando(true);
    try {
      const resultado = await whatsappService.consultarStatusReal();
      const label = statusConfig[resultado.status]?.label || resultado.status;
      toast.success(`Status real consultado: ${label}`);
      await recarregar();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Erro ao consultar status real.');
    } finally {
      setConsultando(false);
    }
  };

  const handleToggleAgente = async () => {
    if (!conectado) return;
    try {
      await whatsappService.setAgenteAtivo(empresaId, !integracao?.agenteAtivo);
      toast.success(integracao?.agenteAtivo ? 'Agente Sebastião desativado.' : 'Agente Sebastião ativado!');
      await recarregar();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar o agente.');
    }
  };

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageCircle size={22} /> Integrações · WhatsApp
          </h1>
        </div>

        <div className="card" style={{ borderColor: 'var(--accent)', marginBottom: '1.5rem' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <Info size={16} /> Esta conexão é real, feita diretamente com a Evolution API. Desconectar
            pelo painel ainda não está disponível nesta etapa.
          </p>
        </div>

        {loading ? (
          <div className="card">
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <div style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Carregando integração...</div>
            </div>
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Smartphone size={18} /> Conexão com o WhatsApp
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Conecte o número de WhatsApp da sua barbearia para que o assistente virtual{' '}
                <strong style={{ color: 'var(--text-primary)' }}>Sebastião</strong> possa atender seus
                clientes automaticamente.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                {integracao?.evolutionInstance && (
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    instância: {integracao.evolutionInstance}
                  </span>
                )}
                {integracao?.statusBruto && (
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    (estado bruto Evolution: {integracao.statusBruto})
                  </span>
                )}
              </div>

              <button
                className="btn btn-secondary"
                onClick={handleConsultarReal}
                disabled={consultando}
                style={{ marginBottom: '1.5rem' }}
              >
                {consultando ? (
                  <>
                    <span className="loading-spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />
                    Consultando Evolution API...
                  </>
                ) : (
                  <><RefreshCw size={15} /> Consultar status real (Evolution)</>
                )}
              </button>

              {conectado ? (
                <p>
                  Número conectado:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{integracao?.numeroConectado || '-'}</strong>
                </p>
              ) : aguardandoLeitura && integracao?.qrCode ? (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1.5rem',
                      marginBottom: '1.25rem',
                      border: '1px dashed var(--border)',
                      borderRadius: 'var(--radius, 8px)',
                    }}
                  >
                    <img
                      src={integracao.qrCode}
                      alt="QR Code para conectar o WhatsApp"
                      style={{ width: 220, height: 220, imageRendering: 'pixelated' }}
                    />
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 320 }}>
                      No WhatsApp do celular da empresa: Mais opções → Aparelhos conectados → Conectar um
                      aparelho, e escaneie o QR Code acima. A tela atualiza sozinha quando conectar.
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={handleConectar}
                    disabled={conectando || cooldownQr > 0}
                  >
                    {conectando ? (
                      <>
                        <span className="loading-spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />
                        Gerando novo QR Code...
                      </>
                    ) : cooldownQr > 0 ? (
                      <>Aguarde {cooldownQr}s para gerar um novo QR Code</>
                    ) : (
                      <><RefreshCw size={15} /> Gerar novo QR Code</>
                    )}
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary" onClick={handleConectar} disabled={conectando}>
                  {conectando ? (
                    <>
                      <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Conectando...
                    </>
                  ) : (
                    <><QrCode size={16} /> Conectar WhatsApp</>
                  )}
                </button>
              )}
            </div>

            <div className="card">
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bot size={18} /> Agente Sebastião
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Quando ativo, o Sebastião responde automaticamente os contatos do WhatsApp conectado
                desta barbearia.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span>Atendimento automático via WhatsApp</span>
                <span
                  className={`badge ${integracao?.agenteAtivo ? 'badge-success' : 'badge-secondary'}`}
                  style={{
                    cursor: conectado ? 'pointer' : 'not-allowed',
                    opacity: conectado ? 1 : 0.6,
                  }}
                  onClick={handleToggleAgente}
                  title={conectado ? 'Clique para alternar' : 'Conecte o WhatsApp para ativar o agente'}
                >
                  {integracao?.agenteAtivo ? '● Ativo' : '● Inativo'}
                </span>
              </div>

              {!conectado && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                  O agente só pode ser ativado quando a instância estiver conectada.
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
