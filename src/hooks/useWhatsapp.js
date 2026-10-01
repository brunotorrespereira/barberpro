import { useState, useEffect, useCallback } from 'react';
import { useEmpresa } from './useEmpresa';
import { whatsappService } from '../services/whatsappService';

export function useWhatsapp() {
  const { empresaId } = useEmpresa();
  const [integracao, setIntegracao] = useState(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await whatsappService.buscar(empresaId);
      setIntegracao(data);
    } catch (err) {
      console.error('Erro ao carregar integração do WhatsApp:', err);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { integracao, loading, recarregar: carregar };
}
