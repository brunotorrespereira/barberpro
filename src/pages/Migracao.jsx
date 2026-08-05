import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, CheckCircle, Rocket } from 'lucide-react';
import { useEmpresa } from '../hooks/useEmpresa';
import { migrarDados } from '../utils/migrarDados';
import Sidebar from '../components/Sidebar';

const COLECOES = ['clientes', 'barbeiros', 'agendamentos'];

const estadoInicial = () =>
  Object.fromEntries(COLECOES.map(c => [c, { status: 'aguardando', migrados: 0, total: 0, erros: 0 }]));

export default function Migracao() {
  const { empresaId, empresa, role } = useEmpresa();

  const [colecoes, setColecoes] = useState(estadoInicial);
  const [rodando, setRodando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erroGeral, setErroGeral] = useState('');

  if (role !== 'admin') return <Navigate to="/" replace />;

  const atualizarColecao = (nome, patch) =>
    setColecoes(prev => ({ ...prev, [nome]: { ...prev[nome], ...patch } }));

  const iniciarMigracao = async () => {
    setConfirmando(false);
    setRodando(true);
    setConcluido(false);
    setErroGeral('');
    setColecoes(estadoInicial());

    try {
      await migrarDados(empresaId, {
        onColecaoInicio(nome, total) {
          atualizarColecao(nome, { status: 'migrando', total, migrados: 0 });
        },
        onDocMigrado(nome, migrados, total) {
          atualizarColecao(nome, { migrados, total });
        },
        onColecaoConcluida(nome, rel) {
          atualizarColecao(nome, {
            status: rel.erros > 0 ? 'erro_parcial' : 'concluido',
            migrados: rel.migrados,
            total: rel.total,
            erros: rel.erros,
          });
        },
      });

      setConcluido(true);
    } catch (err) {
      setErroGeral(err.message || 'Erro inesperado durante a migração.');
    } finally {
      setRodando(false);
    }
  };

  const statusLabel = {
    aguardando:    { texto: 'Aguardando',   cor: 'var(--text-secondary)' },
    migrando:      { texto: 'Migrando...',  cor: 'var(--accent)'         },
    concluido:     { texto: 'Concluído',    cor: 'var(--success)'        },
    erro_parcial:  { texto: 'Erros',        cor: 'var(--danger)'         },
  };

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><RefreshCw size={22} /> Migração de Dados</h1>
        </div>

        {/* Aviso */}
        <div className="card" style={{ borderColor: 'var(--accent)', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><AlertTriangle size={16} /> Leia antes de continuar</p>
          <ul style={{ color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: '1.2rem' }}>
            <li>Esta operação copia dados das coleções legadas para a sua empresa.</li>
            <li>É <strong style={{ color: 'var(--text-primary)' }}>idempotente</strong> — pode ser executada mais de uma vez sem duplicar registros.</li>
            <li>As coleções originais <strong style={{ color: 'var(--text-primary)' }}>não serão apagadas</strong> e continuam como backup.</li>
            <li>Novos dados gravados após a migração já vão direto para a estrutura correta.</li>
          </ul>
        </div>

        {/* Empresa destino */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Empresa destino</p>
          <p style={{ fontWeight: 600 }}>{empresa?.nome ?? '—'}</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{empresaId}</p>
        </div>

        {/* Status por coleção */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Coleção</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Migrados</th>
                <th>Erros</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {COLECOES.map(nome => {
                const c = colecoes[nome];
                const cfg = statusLabel[c.status];
                return (
                  <tr key={nome}>
                    <td style={{ fontWeight: 500 }}>{nome}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      /{nome}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      /empresas/{empresaId?.slice(0, 8)}…/{nome}
                    </td>
                    <td>
                      {c.status === 'aguardando' ? '—' : `${c.migrados} / ${c.total}`}
                    </td>
                    <td style={{ color: c.erros > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {c.status === 'aguardando' ? '—' : c.erros}
                    </td>
                    <td>
                      <span style={{ color: cfg.cor, fontWeight: 500 }}>
                        {cfg.texto}
                        {c.status === 'migrando' && (
                          <span className="loading-spinner" style={{ width: 12, height: 12, borderWidth: 2, marginLeft: 8, display: 'inline-block' }} />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Erro geral */}
        {erroGeral && (
          <div className="login-error" style={{ marginBottom: '1rem' }}>
            ⚠️ {erroGeral}
          </div>
        )}

        {/* Sucesso */}
        {concluido && (
          <div className="card" style={{ borderColor: 'var(--success)', marginBottom: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--success)', fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <CheckCircle size={20} /> Migração concluída com sucesso!
            </p>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              As coleções originais foram preservadas como backup no Firestore.
            </p>
          </div>
        )}

        {/* Botões */}
        {!confirmando ? (
          <button
            className="btn btn-primary"
            onClick={() => setConfirmando(true)}
            disabled={rodando}
          >
            {rodando ? (
              <>
                <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Migrando...
              </>
            ) : (
              concluido
                ? <><RefreshCw size={16} /> Executar novamente</>
                : <><Rocket size={16} /> Iniciar migração</>

            )}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Confirma a migração para <strong style={{ color: 'var(--text-primary)' }}>{empresa?.nome}</strong>?</span>
            <button className="btn btn-primary" onClick={iniciarMigracao}>Sim, migrar</button>
            <button className="btn btn-secondary" onClick={() => setConfirmando(false)}>Cancelar</button>
          </div>
        )}
      </main>
    </div>
  );
}
