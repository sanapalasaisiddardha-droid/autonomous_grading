import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { gradingAPI } from '../services/api';
import Toast from '../components/Toast';
import useFileUpload from '../hooks/useFileUpload';
import {
  HiArrowLeft, HiUpload, HiDocumentText, HiX, HiCheckCircle,
  HiInformationCircle, HiCloudUpload, HiBookOpen, HiAcademicCap,
  HiCalendar, HiClipboardList
} from 'react-icons/hi';
import './UploadAnswers.css';

const UploadAnswers = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tests, setTests] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedTest, setSelectedTest] = useState('');
  const [toast, setToast] = useState(null);

  const getSelectedTestDetails = () => {
    return tests.find(t => t.test_id === selectedTest);
  };

  const testDetails = getSelectedTestDetails();

  const handleToast = useCallback((t) => setToast(t), []);

  const {
    uploadedFiles,
    dragActive,
    handleFileSelect,
    handleDrag,
    handleDrop,
    handleRemoveFile,
    clearFiles,
  } = useFileUpload({
    students,
    grade: testDetails?.grade || '',
    onToast: handleToast,
  });

  useEffect(() => {
    loadData();

    const testId = searchParams.get('testId');
    if (testId) {
      setSelectedTest(testId);
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      const [testsData, studentsData] = await Promise.all([
        gradingAPI.getTests(),
        gradingAPI.getStudents(),
      ]);
      setTests(testsData.results || testsData);
      setStudents(studentsData.results || studentsData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load tests and students');
    }
  };

  const handleTestChange = async (e) => {
    setSelectedTest(e.target.value);
    clearFiles();
    setError('');
    // Reload students so newly auto-created students from previous uploads appear
    try {
      const studentsData = await gradingAPI.getStudents();
      setStudents(studentsData.results || studentsData);
    } catch (err) {
      console.error('Failed to reload students:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedTest) {
      setError('Please select a test');
      return;
    }

    if (uploadedFiles.length === 0) {
      setError('Please upload at least one answer sheet');
      return;
    }

    setLoading(true);

    try {
      let successCount = 0;
      let failedCount = 0;

      for (let { file, student, rollNumber } of uploadedFiles) {
        try {
          const formData = new FormData();
          formData.append('test_id', selectedTest);

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
          type: successCount === uploadedFiles.length ? 'success' : 'info'
        });
      }

      if (successCount === uploadedFiles.length) {
        setSelectedTest('');
        clearFiles();
      }
    } catch (err) {
      console.error('Failed to upload answers:', err);
      setToast({
        message: err.response?.data?.message || 'Failed to upload answer sheets. Please try again.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const matchedStudents = students.filter(s => s.grade === testDetails?.grade);

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="ua-page">
        {/* Top bar */}
        <div className="ua-topbar">
          <button className="ua-back" onClick={() => navigate('/', { state: location.state })}>
            <HiArrowLeft />
            <span>Back to Tests</span>
          </button>

          <div className="ua-topbar-title">
            <h1>Upload Answer Sheets</h1>
            <p>Submit student answer sheets for anonymous grading</p>
          </div>

          <div className="ua-topbar-actions">
            {uploadedFiles.length > 0 && (
              <>
                <button className="ua-btn-outline" onClick={() => navigate('/', { state: location.state })}>
                  Cancel
                </button>
                <button
                  className="ua-btn-primary"
                  onClick={handleSubmit}
                  disabled={loading || !selectedTest}
                >
                  <HiUpload />
                  {loading ? 'Uploading...' : `Upload (${uploadedFiles.length})`}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="ua-content">
          {error && (
            <div className="ua-error">
              <HiInformationCircle />
              <span>{error}</span>
            </div>
          )}

          <div className="ua-content-grid">
            {/* Left column: Form */}
            <div className="ua-form-col">
              {/* Test Selector */}
              <div className="ua-card">
                <div className="ua-card-header">
                  <HiClipboardList className="ua-card-icon" />
                  <h2>Select Test</h2>
                </div>
                <div className="ua-field">
                  <label>Choose a test to upload answer sheets for</label>
                  <select
                    value={selectedTest}
                    onChange={handleTestChange}
                    required
                  >
                    <option value="">-- Select a test --</option>
                    {tests.map(test => (
                      <option key={test.test_id} value={test.test_id}>
                        {test.test_name} ({test.grade}) - {test.test_date}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {testDetails && (
                <>
                  {/* Students panel */}
                  {matchedStudents.length > 0 && (
                    <div className="ua-students-panel">
                      <details>
                        <summary>
                          <HiDocumentText />
                          <span>Available Students ({matchedStudents.length})</span>
                        </summary>
                        <div className="ua-students-list">
                          {matchedStudents.map(student => (
                            <span key={student.student_id} className="ua-student-chip">
                              <strong>{student.roll_number}</strong>
                              {student.name}
                            </span>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Upload Zone */}
                  <div
                    className={`ua-upload-zone ${dragActive ? 'drag-active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-input').click()}
                  >
                    <HiCloudUpload className="ua-upload-icon" />
                    <h3>Drop files here or click to browse</h3>
                    <p>PDF, JPG, PNG — Filename must be the student's roll number</p>

                    <input
                      id="file-input"
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.pdf"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />

                    <button type="button" className="ua-btn-primary ua-browse-btn" onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('file-input').click();
                    }}>
                      <HiUpload /> Browse Files
                    </button>
                  </div>

                  {/* Uploaded Files */}
                  {uploadedFiles.length > 0 && (
                    <div className="ua-card">
                      <div className="ua-card-header">
                        <HiDocumentText className="ua-card-icon" />
                        <h2>Uploaded Files</h2>
                        <span className="ua-card-badge">{uploadedFiles.length} files</span>
                      </div>

                      <div className="ua-files-list">
                        {uploadedFiles.map((item, index) => (
                          <div key={index} className={`ua-file-row ${item.student.isNew ? 'new' : ''}`}>
                            <HiDocumentText className="ua-file-icon" />
                            <div className="ua-file-info">
                              <span className="ua-file-name">{item.file.name}</span>
                              <span className="ua-file-meta">
                                Roll: {item.rollNumber} — {item.student.name} ({item.student.grade})
                                {item.student.isNew && <span className="ua-new-tag"><HiCheckCircle /> New</span>}
                              </span>
                            </div>
                            <span className="ua-file-size">{(item.file.size / 1024).toFixed(0)}KB</span>
                            <button
                              type="button"
                              className="ua-file-remove"
                              onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }}
                              title="Remove"
                            >
                              <HiX />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right column: Info sidebar */}
            <div className="ua-info-col">
              <div className="ua-info-card ua-sticky">
                {testDetails ? (
                  <>
                    <h3>Test Details</h3>
                    <div className="ua-info-item">
                      <HiClipboardList />
                      <div>
                        <span className="ua-info-label">Test Name</span>
                        <span className="ua-info-value">{testDetails.test_name}</span>
                      </div>
                    </div>
                    {testDetails.subject && (
                      <div className="ua-info-item">
                        <HiBookOpen />
                        <div>
                          <span className="ua-info-label">Subject</span>
                          <span className="ua-info-value">{testDetails.subject}</span>
                        </div>
                      </div>
                    )}
                    <div className="ua-info-item">
                      <HiAcademicCap />
                      <div>
                        <span className="ua-info-label">Grade / Class</span>
                        <span className="ua-info-value">{testDetails.grade}</span>
                      </div>
                    </div>
                    <div className="ua-info-item">
                      <HiCalendar />
                      <div>
                        <span className="ua-info-label">Date</span>
                        <span className="ua-info-value">{testDetails.test_date}</span>
                      </div>
                    </div>

                    <div className="ua-info-divider" />

                    <div className="ua-info-stats">
                      <div className="ua-stat">
                        <span className="ua-stat-num">{testDetails.total_questions}</span>
                        <span className="ua-stat-label">Questions</span>
                      </div>
                      <div className="ua-stat">
                        <span className="ua-stat-num">{uploadedFiles.length}</span>
                        <span className="ua-stat-label">Files Ready</span>
                      </div>
                    </div>

                    <div className="ua-info-divider" />

                    {/* Filename format notice */}
                    <div className="ua-notice">
                      <HiInformationCircle className="ua-notice-icon" />
                      <div>
                        <strong>Filename Format</strong>
                        <p>Each filename must equal the Student Roll Number (e.g., 2024001.pdf, STU12345.pdf)</p>
                      </div>
                    </div>

                    {/* File types */}
                    <div className="ua-file-types">
                      <span className="ua-type-badge"><HiDocumentText /> PDF</span>
                      <span className="ua-type-badge"><HiDocumentText /> JPG, PNG</span>
                      <span className="ua-type-badge"><HiDocumentText /> Multi-page</span>
                    </div>
                  </>
                ) : (
                  <div className="ua-info-empty">
                    <HiClipboardList className="ua-info-empty-icon" />
                    <h3>No Test Selected</h3>
                    <p>Select a test from the dropdown to see details and start uploading answer sheets.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UploadAnswers;
