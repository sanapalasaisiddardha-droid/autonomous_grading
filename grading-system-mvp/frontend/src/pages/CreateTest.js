import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gradingAPI } from '../services/api';
import Toast from '../components/Toast';
import useFileUpload from '../hooks/useFileUpload';
import {
  HiArrowLeft, HiUpload, HiDocumentText, HiX, HiCheckCircle,
  HiInformationCircle, HiCloudUpload, HiClipboardCheck, HiBookOpen,
  HiAcademicCap, HiCalendar, HiPencil
} from 'react-icons/hi';
import './CreateTest.css';

const CreateTest = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [createdTest, setCreatedTest] = useState(null);
  const [students, setStudents] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const handleToast = useCallback((t) => setToast(t), []);

  const {
    uploadedFiles,
    dragActive,
    handleFileSelect,
    handleDrag,
    handleDrop,
    handleRemoveFile,
  } = useFileUpload({
    students,
    grade: createdTest?.grade || '',
    onToast: handleToast,
  });

  const [testData, setTestData] = useState({
    test_name: '',
    subject: '',
    grade: '',
    total_questions: 5,
    test_date: new Date().toISOString().split('T')[0],
  });
  const [questions, setQuestions] = useState([
    { question_number: 1, question_text: '', max_marks: 2, marking_grid: [0, 0.5, 1, 1.5, 2] },
  ]);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const studentsData = await gradingAPI.getStudents();
      setStudents(studentsData.results || studentsData);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  };

  const handleTestChange = (e) => {
    const { name, value } = e.target;
    setTestData(prev => ({
      ...prev,
      [name]: name === 'total_questions' ? parseInt(value) : value,
    }));

    if (name === 'total_questions') {
      const newCount = parseInt(value);
      const currentCount = questions.length;
      if (newCount > currentCount) {
        const newQuestions = [...questions];
        for (let i = currentCount; i < newCount; i++) {
          newQuestions.push({
            question_number: i + 1,
            question_text: '',
            max_marks: 2,
            marking_grid: [0, 0.5, 1, 1.5, 2],
          });
        }
        setQuestions(newQuestions);
      } else if (newCount < currentCount) {
        setQuestions(questions.slice(0, newCount));
      }
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions];
    if (field === 'max_marks') {
      const maxMarks = parseFloat(value);
      newQuestions[index][field] = maxMarks;
      newQuestions[index].marking_grid = generateMarkingGrid(maxMarks);
    } else {
      newQuestions[index][field] = value;
    }
    setQuestions(newQuestions);
  };

  const generateMarkingGrid = (maxMarks) => {
    const grid = [];
    const s = maxMarks <= 5 ? 0.5 : 1;
    for (let i = 0; i <= maxMarks; i += s) {
      grid.push(parseFloat(i.toFixed(1)));
    }
    return grid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!testData.test_name || !testData.subject || !testData.grade) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      const createdTestData = await gradingAPI.createTest(testData);
      for (const question of questions) {
        await gradingAPI.createQuestion({
          test: createdTestData.test_id,
          ...question,
        });
      }

      setCreatedTest(createdTestData);
      setToast({ message: 'Test created successfully! Now upload answer sheets.', type: 'success' });
      setStep(2);
    } catch (err) {
      console.error('Failed to create test:', err);
      setError(err.response?.data?.message || 'Failed to create test. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAnswers = async () => {
    if (uploadedFiles.length === 0) {
      setToast({ message: 'Please upload at least one answer sheet', type: 'error' });
      return;
    }
    setUploadLoading(true);
    try {
      let successCount = 0;
      let failedCount = 0;
      for (let { file, student, rollNumber } of uploadedFiles) {
        try {
          const formData = new FormData();
          formData.append('test_id', createdTest.test_id);
          if (!student.isNew && student.student_id) {
            formData.append('student_id', student.student_id);
          }
          formData.append('roll_number', rollNumber);
          formData.append('answer_sheet', file);
          await gradingAPI.uploadAnswers(formData);
          successCount++;
        } catch (err) {
          console.error(`Failed to upload for ${rollNumber}:`, err);
          failedCount++;
        }
      }
      if (successCount > 0) {
        setToast({
          message: `Successfully uploaded ${successCount} answer sheet(s)!${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
          type: 'success'
        });
        setTimeout(() => { navigate('/'); }, 2000);
      }
    } catch (err) {
      console.error('Failed to upload answers:', err);
      setToast({ message: 'Failed to upload answer sheets. Please try again.', type: 'error' });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSkipUpload = () => {
    navigate('/', { state: location.state });
  };

  const totalMarks = questions.reduce((sum, q) => sum + (q.max_marks || 0), 0);

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="ct-page">
        {/* Top bar */}
        <div className="ct-topbar">
          <button className="ct-back" onClick={() => step === 1 ? navigate('/', { state: location.state }) : setStep(1)}>
            <HiArrowLeft />
            <span>{step === 1 ? 'Back' : 'Back to Details'}</span>
          </button>

          <div className="ct-stepper">
            <div className={`ct-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
              <div className="ct-step-dot">{step > 1 ? <HiCheckCircle /> : '1'}</div>
              <span>Test Details</span>
            </div>
            <div className="ct-step-line" />
            <div className={`ct-step ${step >= 2 ? 'active' : ''}`}>
              <div className="ct-step-dot">2</div>
              <span>Upload Sheets</span>
            </div>
          </div>

          <div className="ct-topbar-actions">
            {step === 2 && (
              <>
                <button className="ct-btn-outline" onClick={handleSkipUpload}>Skip</button>
                {uploadedFiles.length > 0 && (
                  <button
                    className="ct-btn-primary"
                    onClick={handleUploadAnswers}
                    disabled={uploadLoading}
                  >
                    <HiUpload />
                    {uploadLoading ? 'Uploading...' : `Upload (${uploadedFiles.length})`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {step === 1 ? (
          <div className="ct-content">
            <div className="ct-content-grid">
              {/* Left column: Form */}
              <div className="ct-form-col">
                <form onSubmit={handleSubmit}>
                  {error && (
                    <div className="ct-error">
                      <HiInformationCircle />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="ct-card">
                    <div className="ct-card-header">
                      <HiPencil className="ct-card-icon" />
                      <h2>Test Information</h2>
                    </div>

                    <div className="ct-field">
                      <label>Test Name <span className="ct-required">*</span></label>
                      <input
                        type="text"
                        name="test_name"
                        value={testData.test_name}
                        onChange={handleTestChange}
                        placeholder="e.g., Weekly Math Test #1"
                        required
                      />
                    </div>

                    <div className="ct-field">
                      <label>Subject <span className="ct-required">*</span></label>
                      <input
                        type="text"
                        name="subject"
                        value={testData.subject}
                        onChange={handleTestChange}
                        placeholder="e.g., Mathematics, Science, English"
                        required
                      />
                    </div>

                    <div className="ct-field-row">
                      <div className="ct-field">
                        <label>Grade / Class <span className="ct-required">*</span></label>
                        <input
                          type="text"
                          name="grade"
                          value={testData.grade}
                          onChange={handleTestChange}
                          placeholder="e.g., 10-A"
                          required
                        />
                      </div>
                      <div className="ct-field">
                        <label>Test Date</label>
                        <input
                          type="date"
                          name="test_date"
                          value={testData.test_date}
                          onChange={handleTestChange}
                        />
                      </div>
                    </div>

                    <div className="ct-field">
                      <label>Total Questions</label>
                      <input
                        type="number"
                        name="total_questions"
                        value={testData.total_questions}
                        onChange={handleTestChange}
                        min="1"
                        max="20"
                      />
                    </div>
                  </div>

                  <div className="ct-card">
                    <div className="ct-card-header">
                      <HiClipboardCheck className="ct-card-icon" />
                      <h2>Questions</h2>
                      <span className="ct-card-badge">{questions.length} total</span>
                    </div>

                    <div className="ct-questions">
                      {questions.map((question, index) => (
                        <div key={index} className="ct-question">
                          <div className="ct-question-header">
                            <span className="ct-question-num">Q{question.question_number}</span>
                            <span className="ct-question-marks">{question.max_marks} marks</span>
                          </div>

                          <div className="ct-field">
                            <label>Question Text</label>
                            <textarea
                              value={question.question_text}
                              onChange={(e) => handleQuestionChange(index, 'question_text', e.target.value)}
                              placeholder="Enter the question (e.g., Solve for x: 2x + 5 = 15)"
                              rows="3"
                            />
                          </div>

                          <div className="ct-field-row">
                            <div className="ct-field">
                              <label>Max Marks</label>
                              <input
                                type="number"
                                step="0.5"
                                value={question.max_marks}
                                onChange={(e) => handleQuestionChange(index, 'max_marks', e.target.value)}
                                min="0.5"
                                max="20"
                              />
                            </div>
                            <div className="ct-field ct-field-grow">
                              <label>Marking Grid</label>
                              <div className="ct-marks-grid">
                                {question.marking_grid.map((mark, i) => (
                                  <span key={i} className="ct-mark-chip">{mark}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </form>
              </div>

              {/* Right column: Preview */}
              <div className="ct-preview-col">
                <div className="ct-preview-card ct-sticky">
                  <h3>Test Preview</h3>
                  <div className="ct-preview-item">
                    <HiPencil />
                    <div>
                      <span className="ct-preview-label">Name</span>
                      <span className="ct-preview-value">{testData.test_name || '—'}</span>
                    </div>
                  </div>
                  <div className="ct-preview-item">
                    <HiBookOpen />
                    <div>
                      <span className="ct-preview-label">Subject</span>
                      <span className="ct-preview-value">{testData.subject || '—'}</span>
                    </div>
                  </div>
                  <div className="ct-preview-item">
                    <HiAcademicCap />
                    <div>
                      <span className="ct-preview-label">Grade / Class</span>
                      <span className="ct-preview-value">{testData.grade || '—'}</span>
                    </div>
                  </div>
                  <div className="ct-preview-item">
                    <HiCalendar />
                    <div>
                      <span className="ct-preview-label">Date</span>
                      <span className="ct-preview-value">{testData.test_date || '—'}</span>
                    </div>
                  </div>
                  <div className="ct-preview-divider" />
                  <div className="ct-preview-stats">
                    <div className="ct-stat">
                      <span className="ct-stat-num">{questions.length}</span>
                      <span className="ct-stat-label">Questions</span>
                    </div>
                    <div className="ct-stat">
                      <span className="ct-stat-num">{totalMarks}</span>
                      <span className="ct-stat-label">Total Marks</span>
                    </div>
                  </div>
                  <div className="ct-preview-divider" />
                  <div className="ct-preview-actions">
                    <button type="button" className="ct-btn-outline ct-btn-full" onClick={() => navigate('/', { state: location.state })}>
                      Cancel
                    </button>
                    <button type="button" className="ct-btn-primary ct-btn-full" disabled={loading} onClick={handleSubmit}>
                      {loading ? 'Creating...' : 'Create Test & Continue'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="ct-content">
            {/* Created test summary */}
            {createdTest && (
              <div className="ct-created-summary">
                <HiCheckCircle className="ct-created-icon" />
                <div>
                  <strong>{createdTest.test_name}</strong>
                  <span>{createdTest.subject} — {createdTest.grade}</span>
                </div>
              </div>
            )}

            {/* Students panel */}
            {students.length > 0 && (
              <div className="ct-students-panel">
                <details>
                  <summary>
                    <HiDocumentText />
                    <span>Available Students ({students.filter(s => s.grade === createdTest?.grade).length})</span>
                  </summary>
                  <div className="ct-students-list">
                    {students
                      .filter(s => s.grade === createdTest?.grade)
                      .map(student => (
                        <span key={student.student_id} className="ct-student-chip">
                          <strong>{student.roll_number}</strong>
                          {student.name}
                        </span>
                      ))}
                    {students.filter(s => s.grade === createdTest?.grade).length === 0 && (
                      <div className="ct-no-students">
                        <HiInformationCircle />
                        <span>No students for grade "{createdTest?.grade}". New students will be auto-created.</span>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* Upload zone */}
            <div
              className={`ct-upload-zone ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input-create').click()}
            >
              <HiCloudUpload className="ct-upload-icon" />
              <h3>Drop files here or click to browse</h3>
              <p>PDF, JPG, PNG — Filename must be the student's roll number</p>
              <input
                id="file-input-create"
                type="file"
                multiple
                accept="image/*,application/pdf,.pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button type="button" className="ct-btn-primary ct-upload-browse" onClick={(e) => {
                e.stopPropagation();
                document.getElementById('file-input-create').click();
              }}>
                <HiUpload /> Browse Files
              </button>
            </div>

            {/* Uploaded files */}
            {uploadedFiles.length > 0 && (
              <div className="ct-files-section">
                <h3>Uploaded Files ({uploadedFiles.length})</h3>
                <div className="ct-files-list">
                  {uploadedFiles.map((item, index) => (
                    <div key={index} className={`ct-file-row ${item.student.isNew ? 'new' : ''}`}>
                      <HiDocumentText className="ct-file-icon" />
                      <div className="ct-file-info">
                        <span className="ct-file-name">{item.file.name}</span>
                        <span className="ct-file-meta">
                          Roll: {item.rollNumber} — {item.student.name} ({item.student.grade})
                          {item.student.isNew && <span className="ct-new-tag"><HiCheckCircle /> New</span>}
                        </span>
                      </div>
                      <span className="ct-file-size">{(item.file.size / 1024).toFixed(0)}KB</span>
                      <button className="ct-file-remove" onClick={() => handleRemoveFile(index)} title="Remove">
                        <HiX />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CreateTest;
