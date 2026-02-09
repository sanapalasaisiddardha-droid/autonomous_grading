import React, { useState } from 'react';
import GradingGrid from './GradingGrid';
import './AnswerCard.css';

const AnswerCard = ({ answer, markingGrid, onGradeSubmit, onImageClick }) => {
  const [selectedMark, setSelectedMark] = useState(answer.marks_awarded || null);
  const [flagRescan, setFlagRescan] = useState(false);

  const handleSubmit = () => {
    if (selectedMark !== null) {
      onGradeSubmit({
        answer_id: answer.answer_id,
        marks_awarded: selectedMark,
        flag_for_rescan: flagRescan,
      });
    }
  };

  const getQualityBadge = () => {
    const level = answer.confidence_level;
    if (!level) return null;
    
    const badges = {
      high: { text: '✓ High Quality', color: '#4CAF50' },
      medium: { text: '⚠ Medium Quality', color: '#FF9800' },
      low: { text: '✗ Low Quality', color: '#F44336' },
    };

    const badge = badges[level];
    return (
      <span className="quality-badge" style={{ backgroundColor: badge.color }}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className={`answer-card ${answer.already_graded ? 'graded' : ''}`}>
      <div className="answer-header">
        <h3>{answer.anonymous_code}</h3>
        {getQualityBadge()}
        {answer.already_graded && <span className="graded-badge">✓ Graded</span>}
      </div>

      <div
        className="answer-image"
        onClick={() => answer.image_url && onImageClick && onImageClick(answer)}
        style={{ cursor: answer.image_url ? 'pointer' : 'default' }}
        title={answer.image_url ? 'Click to view larger image' : ''}
      >
        {answer.image_url ? (
          <img src={`http://localhost:8002${answer.image_url}`} alt={answer.anonymous_code} />
        ) : (
          <div className="no-image">No image available</div>
        )}
        {answer.image_url && (
          <div className="image-overlay">
            <span className="zoom-icon">🔍 Click to enlarge</span>
          </div>
        )}
      </div>

      {answer.confidence_level === 'low' && (
        <div className="warning-message">
          ⚠️ Poor image quality detected. Please review carefully or request rescan.
        </div>
      )}

      {!answer.already_graded && (
        <div className="grading-section">
          <label>Assign Marks:</label>
          <GradingGrid
            markingGrid={markingGrid}
            onSelectMark={setSelectedMark}
            selectedMark={selectedMark}
          />

          <div className="rescan-option">
            <label>
              <input
                type="checkbox"
                checked={flagRescan}
                onChange={(e) => setFlagRescan(e.target.checked)}
              />
              Flag for rescan
            </label>
          </div>

          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={selectedMark === null}
          >
            Submit Grade
          </button>
        </div>
      )}

      {answer.already_graded && (
        <div className="graded-info">
          <strong>Marks Awarded:</strong> {answer.marks_awarded}
        </div>
      )}
    </div>
  );
};

export default AnswerCard;
