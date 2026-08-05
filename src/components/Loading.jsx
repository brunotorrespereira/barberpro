import { Scissors } from 'lucide-react';

export default function Loading() {
  return (
    <div className="loading-screen">
      <div className="loading-logo"><Scissors size={48} /></div>
      <div className="loading-title">BarberPro</div>
      <div className="loading-spinner"></div>
      <div className="loading-text">Carregando...</div>
    </div>
  );
}
