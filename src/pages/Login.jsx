import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Eye, EyeOff, LogIn, Rocket } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useEmpresa } from '../hooks/useEmpresa';
import { empresaService } from '../services/empresaService';

const errorMessages = {
  'auth/user-not-found': 'E-mail não encontrado.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/email-already-in-use': 'Este e-mail já está em uso.',
  'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/invalid-credential': 'Credenciais inválidas. Verifique e-mail e senha.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
};

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nomeBarbearia, setNomeBarbearia] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register } = useAuth();
  const { refreshEmpresa } = useEmpresa();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        // 1. Cria o usuário no Firebase Authentication
        const { user } = await register(email, password);

        // 2. Cria empresa + assinatura + users/{uid} atomicamente
        await empresaService.criar(user.uid, {
          nome: nomeBarbearia,
          nomeProprietario: name,
          email,
        });

        // 3. Força o contexto a reler users/{uid} já criado antes de navegar
        await refreshEmpresa();

        // 4. Firebase já faz login automático — redireciona ao Dashboard
        navigate('/');
      } else {
        await login(email, password);
        navigate('/');
      }
    } catch (err) {
      const msg = errorMessages[err.code] || 'Ocorreu um erro. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(prev => !prev);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
    setNomeBarbearia('');
  };

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-hero-icon"><Scissors size={48} /></div>
        <h1 className="login-hero-title">BarberPro</h1>
        <p className="login-hero-subtitle">
          Sistema de Gestão Completo para Barbearias Modernas
        </p>
        <div className="login-hero-features">
          <div className="login-hero-feature">
            <div className="login-hero-feature-dot"></div>
            Gestão de clientes e histórico
          </div>
          <div className="login-hero-feature">
            <div className="login-hero-feature-dot"></div>
            Agendamentos em tempo real
          </div>
          <div className="login-hero-feature">
            <div className="login-hero-feature-dot"></div>
            Controle de barbeiros e serviços
          </div>
          <div className="login-hero-feature">
            <div className="login-hero-feature-dot"></div>
            Dashboard com métricas e relatórios
          </div>
        </div>
      </div>

      <div className="login-form-section">
        <div className="login-form-card">
          <h2 className="login-form-title">
            {isRegister ? 'Criar minha barbearia' : 'Bem-vindo de volta'}
          </h2>
          <p className="login-form-subtitle">
            {isRegister
              ? 'Preencha os dados para começar gratuitamente'
              : 'Faça login para acessar o sistema'}
          </p>

          {error && (
            <div className="login-error">⚠️ {error}</div>
          )}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div className="input-group">
                  <label className="label">Seu nome completo</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Como você se chama?"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoComplete="name"
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
              </>
            )}

            <div className="input-group">
              <label className="label">E-mail</label>
              <input
                className="input"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="input-group">
              <label className="label">Senha</label>
              <div className="input-password-wrapper">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isRegister ? 'Mínimo 6 caracteres' : '••••••••'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(prev => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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
                  {isRegister ? 'Criando sua barbearia...' : 'Entrando...'}
                </>
              ) : (
                isRegister
                  ? <><Rocket size={16} /> Criar minha barbearia</>
                  : <><LogIn size={16} /> Entrar</>

              )}
            </button>
          </form>

          <div className="login-toggle">
            {isRegister ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}
            <button onClick={toggleMode}>
              {isRegister ? 'Fazer login' : 'Criar minha barbearia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
