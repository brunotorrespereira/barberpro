import { useState, useEffect, useCallback } from 'react';
import { useEmpresa } from './useEmpresa';
import { agendamentoService } from '../services/agendamentoService';

export function useAgendamentos() {
  const { empresaId } = useEmpresa();
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agendamentoService.listar(empresaId);
      setAgendamentos(data);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { agendamentos, loading, recarregar: carregar };
}
