import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { empresaService } from '../services/empresaService';

const EmpresaContext = createContext(null);

export function EmpresaProvider({ children }) {
  const [user, setUser] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [assinatura, setAssinatura] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const resetar = useCallback(() => {
    setUser(null);
    setEmpresa(null);
    setAssinatura(null);
    setEmpresaId(null);
    setRole(null);
    setNeedsSetup(false);
    setLoading(false);
  }, []);

  const carregarEmpresa = useCallback(async (user) => {
    if (!user) {
      resetar();
      return;
    }

    try {
      const userData = await empresaService.buscarUsuario(user.uid);

      // Usuário sem documento em users/{uid} ou sem empresaId → precisa de setup
      if (!userData?.empresaId) {
        setNeedsSetup(true);
        setLoading(false);
        return;
      }

      // Carrega empresa e assinatura em paralelo
      const [dadosEmpresa, dadosAssinatura] = await Promise.all([
        empresaService.buscarPorId(userData.empresaId),
        empresaService.buscarAssinatura(userData.empresaId),
      ]);

      if (dadosEmpresa) {
        setEmpresa(dadosEmpresa);
        setAssinatura(dadosAssinatura);
        setEmpresaId(userData.empresaId);
        setRole(userData.role ?? 'staff');
        setNeedsSetup(false);
      } else {
        // Documento da empresa foi removido — trata como setup pendente
        setNeedsSetup(true);
      }
    } catch (err) {
      console.error('Erro ao carregar empresa:', err);
      resetar();
    } finally {
      setLoading(false);
    }
  }, [resetar]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(true);
      carregarEmpresa(firebaseUser);
    });
    return unsubscribe;
  }, [carregarEmpresa]);

  const refreshEmpresa = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      setLoading(true);
      await carregarEmpresa(user);
    }
  }, [carregarEmpresa]);

  return (
    <EmpresaContext.Provider
      value={{
        // Usuário autenticado
        user,

        // Empresa
        empresa,
        empresaId,
        ativo: empresa?.ativo ?? false,
        configuracoes: empresa?.configuracoes ?? null,

        // Plano (funcional — sem preço)
        planoId: empresa?.planoId ?? 'starter',
        versaoPlano: empresa?.versaoPlano ?? null,

        // Assinatura (desacoplada)
        assinatura,
        status: assinatura?.status ?? null,
        trialExpiresAt: assinatura?.trialExpiresAt ?? null,

        // Usuário
        role,

        // Estado
        loading,
        needsSetup,
        refreshEmpresa,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider');
  return ctx;
}
