import { useState, useEffect, useCallback } from 'react';
import { useEmpresa } from './useEmpresa';
import { barbeiroService } from '../services/barbeiroService';

export function useBarbeiros() {
  const { empresaId } = useEmpresa();
  const [barbeiros, setBarbeiros] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await barbeiroService.listar(empresaId);
      setBarbeiros(data);
    } catch (err) {
      console.error('Erro ao carregar barbeiros:', err);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { barbeiros, loading, recarregar: carregar };
}
