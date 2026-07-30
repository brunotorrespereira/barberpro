import { useState, useEffect, useCallback } from 'react';
import { useEmpresa } from './useEmpresa';
import { clienteService } from '../services/clienteService';

export function useClientes() {
  const { empresaId } = useEmpresa();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clienteService.listar(empresaId);
      setClientes(data);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { clientes, loading, recarregar: carregar };
}
