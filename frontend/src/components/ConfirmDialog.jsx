import React from 'react';

export default function ConfirmDialog({ message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button className="confirm-btn confirm-btn--cancel" onClick={onCancel}>Cancel</button>
          <button
            className={`confirm-btn ${danger ? 'confirm-btn--danger' : 'confirm-btn--ok'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
