import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaPen } from 'react-icons/fa';
import ImagePreview from '../components/ImagePreview';
import Toast from '../components/Toast';
import AnnotationCanvas from '../components/AnnotationCanvas';
import AnnotationToolbar from '../components/AnnotationToolbar';
import { jsPDF } from 'jspdf';
import { gradingAPI } from '../services/api';
import './GradingDashboard.css';

const GradingDashboard = () => {
  const { testId, questionNumber } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gradingProgress, setGradingProgress] = useState({ graded: 0, total: 0 });
  const [previewImage, setPreviewImage] = useState(null);
  const [toast, setToast] = useState(null);
  const [savingIds, setSavingIds] = useState(new Set());

  // Annotation state
  const [canvasMode, setCanvasMode] = useState(false);
  const [activeCanvasId, setActiveCanvasId] = useState(null); // last-touched canvas for toolbar
  const [, setAnnotationDirty] = useState(false);
  const [annotationSaving, setAnnotationSaving] = useState(false);
  const [canvasTool, setCanvasTool] = useState('pen');
  const [canvasColor, setCanvasColor] = useState('#ff0000');
  const [, setToolbarTick] = useState(0); // forces toolbar re-render after drawing
  const canvasRefs = useRef({});

  // Draggable split state (percentage for image side)
  const [imageSplit, setImageSplit] = useState(() => {
    const saved = localStorage.getItem('gd-split');
    return saved ? parseFloat(saved) : 65;
  });
  const isDragging = useRef(false);
  const rowRef = useRef(null);

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, questionNumber]);

  const loadSession = async () => {
    try {
      setLoading(true);
      const data = await gradingAPI.startSession(testId, parseInt(questionNumber));
      setSession(data.session);
      setAnswers(data.answers);
      updateProgress(data.answers);
      setLoading(false);
    } catch (err) {
      setError('Failed to load grading session: ' + err.message);
      setLoading(false);
    }
  };

  const updateProgress = (answersData) => {
    const graded = answersData.filter(a => a.already_graded).length;
    setGradingProgress({ graded, total: answersData.length });
  };

  const handleMarkClick = useCallback(async (answer, mark) => {
    if (savingIds.has(answer.answer_id)) return;

    // Optimistic UI update
    const previousMark = answer.marks_awarded;
    const wasGraded = answer.already_graded;

    setAnswers(prev =>
      prev.map(a =>
        a.answer_id === answer.answer_id
          ? { ...a, marks_awarded: mark, already_graded: true }
          : a
      )
    );

    setGradingProgress(prev => ({
      ...prev,
      graded: wasGraded ? prev.graded : prev.graded + 1
    }));

    setSavingIds(prev => new Set(prev).add(answer.answer_id));

    try {
      await gradingAPI.submitGrades(session.session_id, [{
        answer_id: answer.answer_id,
        marks_awarded: mark,
      }]);
      setToast({ message: `${answer.anonymous_code}: ${mark} marks saved`, type: 'success' });
    } catch (err) {
      // Revert on error
      setAnswers(prev =>
        prev.map(a =>
          a.answer_id === answer.answer_id
            ? { ...a, marks_awarded: previousMark, already_graded: wasGraded }
            : a
        )
      );
      setGradingProgress(prev => ({
        ...prev,
        graded: wasGraded ? prev.graded : prev.graded - 1
      }));
      setToast({ message: 'Failed to save grade: ' + err.message, type: 'error' });
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(answer.answer_id);
        return next;
      });
    }
  }, [savingIds, session]);

  // --- Annotation handlers ---
  const handleCanvasModeToggle = useCallback(() => {
    if (canvasMode) {
      setCanvasMode(false);
      setActiveCanvasId(null);
      setAnnotationDirty(false);
    } else {
      setCanvasMode(true);
      setCanvasTool('pen');
    }
  }, [canvasMode]);

  const handleAnnotationSave = useCallback(async () => {
    if (!session) return;

    setAnnotationSaving(true);
    try {
      let savedCount = 0;
      // Save ALL canvases that have strokes
      for (const answer of answers) {
        const canvasRef = canvasRefs.current[answer.answer_id];
        if (!canvasRef || !canvasRef.hasStrokes()) continue;

        const data = canvasRef.getAnnotationData();
        await gradingAPI.saveAnnotation(session.session_id, answer.answer_id, data);
        // Update local answer state
        setAnswers(prev => prev.map(a =>
          a.answer_id === answer.answer_id ? { ...a, annotation_data: data } : a
        ));
        savedCount++;
      }
      setAnnotationDirty(false);
      setToast({ message: `Annotations saved (${savedCount} answer${savedCount !== 1 ? 's' : ''})`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to save annotations: ' + err.message, type: 'error' });
    } finally {
      setAnnotationSaving(false);
    }
  }, [session, answers]);

  const handleAnnotationSaveExport = useCallback(async () => {
    await handleAnnotationSave();
    setToast({ message: 'Generating PDF...', type: 'success' });

    const MAX_PX_WIDTH = 1200;
    const JPEG_QUALITY = 0.6;

    // Downscale + convert to JPEG
    const compressImage = (srcCanvas) => {
      let w = srcCanvas.width;
      let h = srcCanvas.height;
      if (w > MAX_PX_WIDTH) {
        h = Math.round(h * (MAX_PX_WIDTH / w));
        w = MAX_PX_WIDTH;
      }
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      out.getContext('2d').drawImage(srcCanvas, 0, 0, w, h);
      return { dataUrl: out.toDataURL('image/jpeg', JPEG_QUALITY), width: w, height: h };
    };

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableW = pageW - margin * 2;
    const headerH = 8;
    const gap = 6;
    let cursorY = margin;
    let hasContent = false;

    for (const answer of answers) {
      if (!answer.image_url) continue;

      // Build source canvas (with annotations if any)
      let srcCanvas = null;
      const canvasRef = canvasRefs.current[answer.answer_id];

      if (canvasRef && canvasRef.hasStrokes()) {
        const blob = await canvasRef.exportMergedImage();
        if (blob) {
          const bmp = await createImageBitmap(blob);
          srcCanvas = document.createElement('canvas');
          srcCanvas.width = bmp.width;
          srcCanvas.height = bmp.height;
          srcCanvas.getContext('2d').drawImage(bmp, 0, 0);
        }
      }

      if (!srcCanvas) {
        const img = document.querySelector(`img[alt="${answer.anonymous_code}"]`);
        if (img) {
          // Wait for lazy-loaded images to finish loading
          if (!img.complete || !img.naturalWidth) {
            await new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
              setTimeout(resolve, 3000); // timeout fallback
            });
          }
          if (img.naturalWidth && img.naturalHeight) {
            srcCanvas = document.createElement('canvas');
            srcCanvas.width = img.naturalWidth;
            srcCanvas.height = img.naturalHeight;
            srcCanvas.getContext('2d').drawImage(img, 0, 0);
          }
        }
      }

      if (!srcCanvas) continue;

      const { dataUrl, width: pxW, height: pxH } = compressImage(srcCanvas);
      const imgHMm = usableW * (pxH / pxW);
      const blockH = headerH + imgHMm + gap;

      // New page if this block doesn't fit
      if (hasContent && cursorY + blockH > pageH - margin) {
        pdf.addPage();
        cursorY = margin;
      }

      hasContent = true;

      // Header
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      const label = answer.already_graded
        ? `${answer.anonymous_code}  -  ${answer.marks_awarded} / ${session.max_marks}`
        : answer.anonymous_code;
      pdf.text(label, margin, cursorY + 5);
      cursorY += headerH;

      // Image
      pdf.addImage(dataUrl, 'JPEG', margin, cursorY, usableW, imgHMm);
      cursorY += imgHMm + gap;
    }

    if (!hasContent) {
      setToast({ message: 'No images to export', type: 'error' });
      return;
    }

    pdf.save(`${session.test_name}_Q${session.question_number}_annotated.pdf`);
    setToast({ message: 'PDF downloaded', type: 'success' });
  }, [handleAnnotationSave, answers, session]);

  const handleAnnotationClose = useCallback(() => {
    setCanvasMode(false);
    setActiveCanvasId(null);
    setAnnotationDirty(false);
  }, []);

  // Keyboard shortcuts for annotation mode
  useEffect(() => {
    if (!canvasMode || !activeCanvasId) return;
    const handler = (e) => {
      const canvasRef = canvasRefs.current[activeCanvasId];
      if (!canvasRef) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        canvasRef.undo();
        setAnnotationDirty(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        canvasRef.redo();
        setAnnotationDirty(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleAnnotationSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canvasMode, activeCanvasId, handleAnnotationSave]);

  const handleNextQuestion = () => {
    const nextQ = parseInt(questionNumber) + 1;
    if (nextQ <= session.total_questions) {
      navigate(`/grade/${testId}/${nextQ}`, { state: location.state });
    } else {
      setToast({ message: 'All questions graded! Returning to test selection.', type: 'success' });
      setTimeout(() => {
        navigate('/', {
          state: {
            returnToClass: location.state?.returnToClass,
            returnToTest: location.state?.returnToTest
          }
        });
      }, 2000);
    }
  };

  const goBack = () => {
    navigate('/', {
      state: {
        returnToClass: location.state?.returnToClass,
        returnToTest: location.state?.returnToTest
      }
    });
  };

  // --- Drag-to-resize handlers ---
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleDragMove = (e) => {
      if (!isDragging.current || !rowRef.current) return;
      const rect = rowRef.current.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const pct = Math.min(85, Math.max(30, (x / rect.width) * 100));
      setImageSplit(pct);
    };

    const handleDragEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setImageSplit(prev => {
        localStorage.setItem('gd-split', prev);
        return prev;
      });
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, []);

  const scoreSplit = 100 - imageSplit;
  const isVerticalMarks = scoreSplit < 25;

  if (loading) {
    return <div className="gd-loading">Loading grading session...</div>;
  }

  if (error) {
    return <div className="gd-error">{error}</div>;
  }

  if (!session || answers.length === 0) {
    return (
      <div className="gd-empty">
        <h2>No answers found</h2>
        <p>There are no student submissions for this question yet.</p>
        <button onClick={goBack}>Back to Tests</button>
      </div>
    );
  }

  const progressPct = (gradingProgress.graded / gradingProgress.total) * 100;
  const allGraded = gradingProgress.graded === gradingProgress.total;

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="gd-page">
        {/* Topbar */}
        <div className="gd-topbar">
          <button className="gd-back" onClick={goBack}>← Back</button>
          <div className="gd-topbar-title">{session.test_name}</div>
          <div className="gd-topbar-right">
            <button
              className={`gd-canvas-mode-btn ${canvasMode ? 'gd-canvas-mode-btn--active' : ''}`}
              onClick={handleCanvasModeToggle}
              title={canvasMode ? 'Exit annotation mode' : 'Enter annotation mode'}
            >
              <FaPen size={12} />
              <span>{canvasMode ? 'Canvas ON' : 'Canvas'}</span>
            </button>
            <div className="gd-topbar-badge">
              Q{session.question_number} · {gradingProgress.graded}/{gradingProgress.total}
            </div>
          </div>
        </div>

        {/* Annotation Toolbar */}
        {canvasMode && (
          <AnnotationToolbar
            tool={canvasTool}
            color={canvasColor}
            onToolChange={setCanvasTool}
            onColorChange={setCanvasColor}
            onUndo={() => {
              canvasRefs.current[activeCanvasId]?.undo();
              setAnnotationDirty(true);
            }}
            onRedo={() => {
              canvasRefs.current[activeCanvasId]?.redo();
              setAnnotationDirty(true);
            }}
            onSave={handleAnnotationSave}
            onSaveExport={handleAnnotationSaveExport}
            onClose={handleAnnotationClose}
            canUndo={canvasRefs.current[activeCanvasId]?.canUndo?.() || false}
            canRedo={canvasRefs.current[activeCanvasId]?.canRedo?.() || false}
            hasStrokes={canvasRefs.current[activeCanvasId]?.hasStrokes?.() || false}
            saving={annotationSaving}
          />
        )}

        {/* Question Info */}
        <div className="gd-question-card">
          <div className="gd-question-header">
            <span className="gd-question-label">Question {session.question_number}</span>
            <span className="gd-question-dot">·</span>
            <span className="gd-question-marks">{session.max_marks} marks</span>
          </div>
          <div className="gd-question-text">
            {session.question_text || 'No question text provided'}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="gd-progress">
          <div className="gd-progress-bar">
            <div className="gd-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="gd-progress-label">
            {allGraded
              ? '✓ All students graded!'
              : `${progressPct.toFixed(0)}% · ${gradingProgress.graded} / ${gradingProgress.total} graded`}
          </div>
        </div>

        {/* Student Rows */}
        <div className="gd-rows">
          {answers.map((answer, index) => {
            const isGraded = answer.already_graded;
            const isSaving = savingIds.has(answer.answer_id);

            return (
              <div
                key={answer.answer_id}
                className={`gd-row ${isGraded ? 'gd-row--graded' : ''}`}
                ref={index === 0 ? rowRef : undefined}
              >
                {/* Left: Student code + image */}
                <div className="gd-row-left" style={{ flex: `0 0 ${imageSplit}%` }}>
                  <span className="gd-student-code">{answer.anonymous_code}</span>
                  <div
                    className="gd-image-wrap"
                    onClick={() => {
                      if (canvasMode) return; // drawing mode, don't open preview
                      if (answer.image_url) setPreviewImage(answer);
                    }}
                    title={canvasMode ? '' : (answer.image_url ? 'Click to enlarge' : '')}
                  >
                    {answer.image_url ? (
                      <img
                        src={`http://localhost:8002${answer.image_url}`}
                        alt={answer.anonymous_code}
                        className="gd-image"
                        loading="lazy"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="gd-no-image">No image available</div>
                    )}
                    <AnnotationCanvas
                      ref={(el) => { canvasRefs.current[answer.answer_id] = el; }}
                      imageUrl={answer.image_url ? `http://localhost:8002${answer.image_url}` : null}
                      active={canvasMode}
                      tool={canvasTool}
                      color={canvasColor}
                      initialData={answer.annotation_data}
                      onStrokeChange={() => {
                        setActiveCanvasId(answer.answer_id);
                        setAnnotationDirty(true);
                        setToolbarTick(t => t + 1);
                      }}
                    />
                  </div>
                </div>

                {/* Drag Handle */}
                <div
                  className="gd-drag-handle"
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                  title="Drag to resize"
                />

                {/* Right: Mark buttons + status */}
                <div className={`gd-row-right ${isVerticalMarks ? 'gd-row-right--vertical' : ''}`}
                  style={{ flex: `0 0 calc(${scoreSplit}% - 10px)` }}
                >
                  <div className={`gd-marks-grid ${isVerticalMarks ? 'gd-marks-grid--vertical' : ''}`}>
                    {session.marking_grid.map((mark) => (
                      <button
                        key={mark}
                        className={`gd-mark-btn ${
                          answer.marks_awarded === mark
                            ? isGraded ? 'gd-mark-btn--awarded' : 'gd-mark-btn--selected'
                            : ''
                        }`}
                        onClick={() => handleMarkClick(answer, mark)}
                        disabled={isSaving}
                      >
                        {mark}
                      </button>
                    ))}
                  </div>
                  <div className="gd-grade-status">
                    {isSaving && <span className="gd-saving">Saving...</span>}
                    {isGraded && !isSaving && (
                      <span className="gd-graded-label">✓ Graded: {answer.marks_awarded}</span>
                    )}
                    {!isGraded && !isSaving && (
                      <span className="gd-ungraded-label">Click to grade</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: Continue button */}
        {allGraded && (
          <div className="gd-footer">
            <button className="gd-continue-btn" onClick={handleNextQuestion}>
              {parseInt(questionNumber) < session.total_questions
                ? `Continue to Question ${parseInt(questionNumber) + 1} →`
                : 'Finish Grading →'}
            </button>
          </div>
        )}

        {/* Image Preview Modal */}
        {previewImage && (
          <ImagePreview
            imageUrl={`http://localhost:8002${previewImage.image_url}`}
            studentCode={previewImage.anonymous_code}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </div>
    </>
  );
};

export default GradingDashboard;
