import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ImagePreview from '../components/ImagePreview';
import Toast from '../components/Toast';
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
          <div className="gd-topbar-badge">
            Q{session.question_number} · {gradingProgress.graded}/{gradingProgress.total}
          </div>
        </div>

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
          {answers.map((answer) => {
            const isGraded = answer.already_graded;
            const isSaving = savingIds.has(answer.answer_id);

            return (
              <div
                key={answer.answer_id}
                className={`gd-row ${isGraded ? 'gd-row--graded' : ''}`}
              >
                {/* Left: Student code + image */}
                <div className="gd-row-left">
                  <span className="gd-student-code">{answer.anonymous_code}</span>
                  <div
                    className="gd-image-wrap"
                    onClick={() => answer.image_url && setPreviewImage(answer)}
                    title={answer.image_url ? 'Click to enlarge' : ''}
                  >
                    {answer.image_url ? (
                      <img
                        src={`http://localhost:8002${answer.image_url}`}
                        alt={answer.anonymous_code}
                        className="gd-image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="gd-no-image">No image available</div>
                    )}
                  </div>
                </div>

                {/* Right: Mark buttons + status */}
                <div className="gd-row-right">
                  <div className="gd-marks-grid">
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
