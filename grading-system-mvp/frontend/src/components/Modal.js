import React from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, onConfirm, title, message, type = 'confirm' }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          {type === 'confirm' ? (
            <>
              <button className="modal-button cancel" onClick={onClose}>
                Cancel
              </button>
              <button className="modal-button confirm" onClick={onConfirm}>
                Delete
              </button>
            </>
          ) : (
            <button className="modal-button confirm" onClick={onClose}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
