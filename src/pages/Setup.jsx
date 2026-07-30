import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEmpresa } from '../hooks/useEmpresa';
import { empresaService } from '../services/empresaService';

const errorMessages = {
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
};

export default function Setup() {
  const { user } = useAuth();
  const { refreshEmpresa } = useEmpresa();
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [nomeBarbearia, setNomeBarbearia] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Cria empresa + assinatura + users/{uid} atomicamente
      await empresaService.criar(user.uid, {
        nome: nomeBarbearia,
        nomeProprietario: nome,
        email: user.email,
      });

      // Atualiza o contexto com os dados recém-criados
      await refreshEmpresa();

      navigate('/');
    } catch (err) {
      const msg = errorMessages[err.code] || 'Ocorreu um erro ao criar sua barbearia. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-hero-icon">✂️</div>
        <h1 className="login-hero-title">BarberPro</h1>
        <p className="login-hero-subtitle">
          Vamos configurar sua barbearia
        </p>
        <div className="login-hero-features">
          <div className="login-hero-feature">
            <div className="login-hero-feature-dot"></div>
            Leva menos de 1 minuto
          </div>
          <div className="login-hero-feature">
            <div className="login-hero-feature-dot"></div>
            14 dias grátis, sem cartão
          </div>
          <div className="login-hero-feature">
            <div className="login-hero-feature-dot"></div>
            Cancele quando quiser
          </div>
        </div>
      </div>

      <div className="login-form-section">
        <div className="login-form-card">
          <h2 className="login-form-title">Configure sua barbearia</h2>
          <p className="login-form-subtitle">
            Sua conta foi criada. Agora informe os dados da sua barbearia para continuar.
          </p>

          {error && (
            <div className="login-error">⚠️ {error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="label">Seu nome completo</label>
              <input
                className="input"
                type="text"
                placeholder="Como você se chama?"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
                autoComplete="name"
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="label">Nome da barbearia</label>
              <input
                className="input"
                type="text"
                placeholder="Ex: Barbearia do João"
                value={nomeBarbearia}
                onChange={e => setNomeBarbearia(e.target.value)}
                required
                autoComplete="organization"
              />
            </div>

            <div className="input-group">
              <label className="label">E-mail</label>
              <input
                className="input"
                type="email"
                value={user?.email ?? ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
                  Criando sua barbearia...
                </>
              ) : (
                '🚀 Criar minha barbearia'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
