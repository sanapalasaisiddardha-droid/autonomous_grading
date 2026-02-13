import React, { useRef } from 'react';
import { FaPen, FaHighlighter, FaEraser, FaUndo, FaRedo, FaSave, FaDownload, FaTimes } from 'react-icons/fa';
import './AnnotationToolbar.css';

const PRESET_COLORS = ['#ff0000', '#0066ff', '#16a34a', '#f59e0b', '#8b5cf6', '#000000'];

const AnnotationToolbar = ({
  tool,
  color,
  onToolChange,
  onColorChange,
  onUndo,
  onRedo,
  onSave,
  onSaveExport,
  onClose,
  canUndo,
  canRedo,
  hasStrokes,
  saving,
}) => {
  const colorInputRef = useRef(null);

  return (
    <div className="annotation-toolbar">
      {/* Tool buttons */}
      <div className="at-group">
        <button
          className={`at-btn ${tool === 'pen' ? 'at-btn--active' : ''}`}
          onClick={() => onToolChange('pen')}
          title="Pen (thin)"
        >
          <FaPen />
        </button>
        <button
          className={`at-btn ${tool === 'highlighter' ? 'at-btn--active' : ''}`}
          onClick={() => onToolChange('highlighter')}
          title="Highlighter"
        >
          <FaHighlighter />
        </button>
        <button
          className={`at-btn ${tool === 'eraser' ? 'at-btn--active' : ''}`}
          onClick={() => onToolChange('eraser')}
          title="Eraser (click stroke to remove)"
        >
          <FaEraser />
        </button>
      </div>

      <div className="at-divider" />

      {/* Color presets */}
      <div className="at-group at-colors">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            className={`at-color-btn ${color === c ? 'at-color-btn--active' : ''}`}
            style={{ background: c }}
            onClick={() => onColorChange(c)}
            title={c}
          />
        ))}
        <button
          className="at-color-btn at-color-btn--custom"
          onClick={() => colorInputRef.current?.click()}
          title="Custom color"
        >
          <span style={{ fontSize: 12 }}>+</span>
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          className="at-color-input"
        />
      </div>

      <div className="at-divider" />

      {/* Undo / Redo */}
      <div className="at-group">
        <button
          className="at-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <FaUndo />
        </button>
        <button
          className="at-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <FaRedo />
        </button>
      </div>

      <div className="at-divider" />

      {/* Save / Export / Close */}
      <div className="at-group">
        <button
          className="at-btn at-btn--save"
          onClick={onSave}
          disabled={saving}
          title="Save annotations (Ctrl+S)"
        >
          <FaSave />
          <span>{saving ? 'Saving...' : 'Save'}</span>
        </button>
        <button
          className="at-btn at-btn--export"
          onClick={onSaveExport}
          disabled={saving}
          title="Save & download merged image"
        >
          <FaDownload />
          <span>Export</span>
        </button>
        <button
          className="at-btn at-btn--close"
          onClick={onClose}
          title="Close annotation mode"
        >
          <FaTimes />
        </button>
      </div>
    </div>
  );
};

export default AnnotationToolbar;
