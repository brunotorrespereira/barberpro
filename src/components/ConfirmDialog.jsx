export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">🗑️</div>
        <div className="confirm-title">{title || 'Confirmar ação'}</div>
        <div className="confirm-message">{message || 'Tem certeza que deseja continuar? Esta ação não pode ser desfeita.'}</div>
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            Confirmar exclusão
          </button>
        </div>
      </div>
    </div>
  );
}
