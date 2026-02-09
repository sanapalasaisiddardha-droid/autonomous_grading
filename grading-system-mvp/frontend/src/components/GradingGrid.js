import React from 'react';
import './GradingGrid.css';

const GradingGrid = ({ markingGrid, onSelectMark, selectedMark }) => {
  return (
    <div className="grading-grid">
      {markingGrid.map((mark) => (
        <button
          key={mark}
          className={`grid-button ${selectedMark === mark ? 'selected' : ''}`}
          onClick={() => onSelectMark(mark)}
        >
          {mark}
        </button>
      ))}
    </div>
  );
};

export default GradingGrid;
