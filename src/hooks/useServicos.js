import { useState, useEffect, useCallback } from 'react';
import { useEmpresa } from './useEmpresa';
import { servicoService } from '../services/servicoService';

export function useServicos() {
  const { empresaId } = useEmpresa();
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await servicoService.listar(empresaId);
      setServicos(data);
    } catch (err) {
      console.error('Erro ao carregar serviços:', err);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { servicos, loading, recarregar: carregar };
}
