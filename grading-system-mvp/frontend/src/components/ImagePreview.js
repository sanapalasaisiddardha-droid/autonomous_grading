import React, { useEffect } from 'react';
import './ImagePreview.css';

const ImagePreview = ({ imageUrl, studentCode, onClose }) => {
  useEffect(() => {
    // Close modal on ESC key press
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop, not the image
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="image-preview-modal" onClick={handleBackdropClick}>
      <div className="image-preview-content">
        <div className="image-preview-header">
          <h3>{studentCode}</h3>
          <button className="close-button" onClick={onClose} title="Close (ESC)">
            ×
          </button>
        </div>
        <div className="image-preview-body">
          <img src={imageUrl} alt={studentCode} />
        </div>
        <div className="image-preview-footer">
          <button className="download-button" onClick={() => {
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = `${studentCode}_answer.jpg`;
            link.click();
          }}>
            📥 Download
          </button>
          <span className="close-hint">Click outside or press ESC to close</span>
        </div>
      </div>
    </div>
  );
};

export default ImagePreview;
