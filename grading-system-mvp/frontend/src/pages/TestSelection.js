import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gradingAPI } from '../services/api';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import {
  HiPlus, HiTrash, HiUpload, HiChartBar,
  HiClipboardList, HiCalendar, HiDocumentText, HiChevronRight,
  HiArrowLeft, HiBookOpen, HiAcademicCap, HiSearch, HiX
} from 'react-icons/hi';
import './TestSelection.css';

const CLASS_COLORS = [
  { bg: '#6366f1', light: '#eef2ff' },
  { bg: '#06b6d4', light: '#ecfeff' },
  { bg: '#f59e0b', light: '#fffbeb' },
  { bg: '#10b981', light: '#ecfdf5' },
  { bg: '#ef4444', light: '#fef2f2' },
  { bg: '#ec4899', light: '#fdf2f8' },
  { bg: '#8b5cf6', light: '#f5f3ff' },
  { bg: '#14b8a6', light: '#f0fdfa' },
];

const TestSelection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const [currentView, setCurrentView] = useState('classes');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTests();
  }, []);

  useEffect(() => {
    if (location.state?.returnToClass) {
      const className = location.state.returnToClass;
      setSelectedClass(className);
      if (location.state.returnToTest) {
        setSelectedTest(location.state.returnToTest);
        setCurrentView('testDetail');
      } else if (location.state.returnToTestId && tests.length > 0) {
        const found = tests.find(t => t.test_id === location.state.returnToTestId);
        if (found) {
          setSelectedTest(found);
          setCurrentView('testDetail');
        } else {
          setCurrentView('tests');
        }
      } else if (!location.state.returnToTestId) {
        setCurrentView('tests');
      }
    }
  }, [location.state, tests]);

  const loadTests = async () => {
    try {
      const data = await gradingAPI.getTests();
      setTests(data.results || data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load tests:', err);
      setLoading(false);
    }
  };

  const getClassGroups = () => {
    const groups = {};
    tests.forEach(test => {
      const grade = test.grade || 'Unassigned';
      if (!groups[grade]) groups[grade] = [];
      groups[grade].push(test);
    });
    return groups;
  };

  const handleClassClick = (className) => {
    setSelectedClass(className);
    setCurrentView('tests');
  };

  const handleTestClick = (test) => {
    setSelectedTest(test);
    setCurrentView('testDetail');
  };

  const handleBackToClasses = () => {
    setSelectedClass(null);
    setSelectedTest(null);
    setSelectedSubject(null);
    setSearchQuery('');
    setCurrentView('classes');
  };

  const handleBackToTests = () => {
    setSelectedTest(null);
    setSearchQuery('');
    setCurrentView('tests');
  };

  const handleStartGrading = (testId, questionNumber) => {
    navigate(`/grade/${testId}/${questionNumber}`, {
      state: { returnToClass: selectedClass, returnToTest: selectedTest }
    });
  };

  const handleDeleteTest = (e, testId, testName) => {
    e.stopPropagation();
    setDeleteTarget({ testId, testName });
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await gradingAPI.deleteTest(deleteTarget.testId);
      const updatedTests = tests.filter(test => test.test_id !== deleteTarget.testId);
      setTests(updatedTests);
      setModalOpen(false);
      setDeleteTarget(null);
      setToast({ message: 'Test deleted successfully!', type: 'success' });

      if (selectedTest && selectedTest.test_id === deleteTarget.testId) {
        handleBackToTests();
      }
      const classGroups = {};
      updatedTests.forEach(t => {
        const g = t.grade || 'Unassigned';
        if (!classGroups[g]) classGroups[g] = [];
        classGroups[g].push(t);
      });
      if (selectedClass && !classGroups[selectedClass]) {
        handleBackToClasses();
      }
    } catch (err) {
      console.error('Failed to delete test:', err);
      setModalOpen(false);
      setDeleteTarget(null);
      setToast({ message: 'Failed to delete test. Please try again.', type: 'error' });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setDeleteTarget(null);
  };

  // Get topbar back button based on current view
  const renderBackButton = () => {
    if (currentView === 'tests') {
      return (
        <button className="ts-back" onClick={handleBackToClasses}>
          <HiArrowLeft />
          <span>All Classes</span>
        </button>
      );
    }
    if (currentView === 'testDetail') {
      return (
        <button className="ts-back" onClick={handleBackToTests}>
          <HiArrowLeft />
          <span>Back to {selectedClass}</span>
        </button>
      );
    }
    return null;
  };

  // Get topbar title based on current view
  const renderTitle = () => {
    if (currentView === 'classes') {
      return (
        <div className="ts-topbar-title">
          <h1>Classes</h1>
          <p>Select a class to view tests</p>
        </div>
      );
    }
    if (currentView === 'tests') {
      return (
        <div className="ts-topbar-title">
          <h1>{selectedClass}</h1>
          <p>Tests for this class</p>
        </div>
      );
    }
    if (currentView === 'testDetail' && selectedTest) {
      return (
        <div className="ts-topbar-title">
          <h1>{selectedTest.test_name}</h1>
          <p>{selectedClass} — {selectedTest.subject || 'No subject'}</p>
        </div>
      );
    }
    return null;
  };

  // Get matching tests across all classes for search
  const getSearchMatchingTests = (query) => {
    const matches = [];
    tests.forEach(t => {
      if (t.test_name.toLowerCase().includes(query) || (t.subject && t.subject.toLowerCase().includes(query))) {
        matches.push(t);
      }
    });
    return matches;
  };

  const handleSearchTestClick = (test) => {
    const grade = test.grade || 'Unassigned';
    setSelectedClass(grade);
    setSelectedTest(test);
    setSearchQuery('');
    setCurrentView('testDetail');
  };

  // Classes View
  const ClassesView = () => {
    const classGroups = getClassGroups();
    const query = searchQuery.toLowerCase().trim();

    if (Object.keys(classGroups).length === 0) {
      return (
        <div className="ts-empty">
          <HiClipboardList className="ts-empty-icon" />
          <h2>No tests available</h2>
          <p>Create your first test to get started</p>
          <button className="ts-btn-primary" onClick={() => navigate('/create-test')}>
            <HiPlus /> Create New Test
          </button>
        </div>
      );
    }

    // If searching, show matching tests directly as a flat list
    if (query) {
      const matchingTests = getSearchMatchingTests(query);

      if (matchingTests.length === 0) {
        return (
          <div className="ts-empty-filtered">
            <p>No classes or tests matching "{searchQuery}"</p>
            <button className="ts-btn-outline" onClick={() => setSearchQuery('')}>
              Clear search
            </button>
          </div>
        );
      }

      return (
        <div className="ts-tests-list">
          {matchingTests.map((test) => (
            <div
              key={test.test_id}
              className="ts-test-card"
              onClick={() => handleSearchTestClick(test)}
            >
              <div className="ts-test-card-left">
                <div className="ts-test-icon">
                  <HiDocumentText />
                </div>
                <div className="ts-test-info">
                  <h3>{test.test_name}</h3>
                  <div className="ts-test-meta">
                    <span><HiAcademicCap /> {test.grade}</span>
                    {test.subject && (
                      <span className="ts-subject-tag"><HiBookOpen /> {test.subject}</span>
                    )}
                    <span><HiCalendar /> {test.test_date}</span>
                    <span><HiClipboardList /> {test.total_questions} questions</span>
                  </div>
                </div>
              </div>
              <div className="ts-test-card-right">
                <HiChevronRight className="ts-test-arrow" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    // No search — show class cards
    const classNames = Object.keys(classGroups).sort();

    return (
      <div className="ts-classes-grid">
        {classNames.map((className, index) => {
          const color = CLASS_COLORS[index % CLASS_COLORS.length];
          const testCount = classGroups[className].length;
          const subjects = [...new Set(classGroups[className].map(t => t.subject).filter(Boolean))];

          return (
            <div
              key={className}
              className="ts-class-card"
              onClick={() => handleClassClick(className)}
            >
              <div className="ts-class-card-accent" style={{ background: color.bg }} />
              <div className="ts-class-card-body">
                <div className="ts-class-card-top">
                  <div className="ts-class-icon-wrap" style={{ background: color.light, color: color.bg }}>
                    <HiAcademicCap />
                  </div>
                  <HiChevronRight className="ts-class-arrow" />
                </div>
                <span className="ts-class-label">Grade</span>
                <h2 className="ts-class-name">{className}</h2>
                <div className="ts-class-meta">
                  <span className="ts-class-stat">
                    <HiDocumentText />
                    {testCount} {testCount === 1 ? 'test' : 'tests'}
                  </span>
                  {subjects.length > 0 && (
                    <span className="ts-class-stat">
                      <HiBookOpen />
                      {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Tests View
  const TestsView = () => {
    const classGroups = getClassGroups();
    const classTests = classGroups[selectedClass] || [];
    const subjects = [...new Set(classTests.map(t => t.subject).filter(Boolean))].sort();
    const queryLower = searchQuery.toLowerCase().trim();
    const filteredTests = classTests.filter(t => {
      if (selectedSubject && t.subject !== selectedSubject) return false;
      if (queryLower && !t.test_name.toLowerCase().includes(queryLower) && !(t.subject && t.subject.toLowerCase().includes(queryLower))) return false;
      return true;
    });

    return (
      <>
        {/* Subject Filter */}
        {subjects.length > 0 && (
          <div className="ts-card ts-subject-filter">
            <div className="ts-subject-label">
              <HiBookOpen />
              <span>Filter by Subject</span>
            </div>
            <div className="ts-subject-pills">
              <button
                className={`ts-pill ${!selectedSubject ? 'active' : ''}`}
                onClick={() => setSelectedSubject(null)}
              >
                All ({classTests.length})
              </button>
              {subjects.map(subject => (
                <button
                  key={subject}
                  className={`ts-pill ${selectedSubject === subject ? 'active' : ''}`}
                  onClick={() => setSelectedSubject(selectedSubject === subject ? null : subject)}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Test List */}
        <div className="ts-tests-list">
          {filteredTests.map((test) => (
            <div
              key={test.test_id}
              className="ts-test-card"
              onClick={() => handleTestClick(test)}
            >
              <div className="ts-test-card-left">
                <div className="ts-test-icon">
                  <HiDocumentText />
                </div>
                <div className="ts-test-info">
                  <h3>{test.test_name}</h3>
                  <div className="ts-test-meta">
                    {test.subject && (
                      <span className="ts-subject-tag"><HiBookOpen /> {test.subject}</span>
                    )}
                    <span><HiCalendar /> {test.test_date}</span>
                    <span><HiClipboardList /> {test.total_questions} questions</span>
                  </div>
                </div>
              </div>
              <div className="ts-test-card-right">
                <button
                  className="ts-delete-btn"
                  onClick={(e) => handleDeleteTest(e, test.test_id, test.test_name)}
                  title="Delete test"
                >
                  <HiTrash />
                </button>
                <HiChevronRight className="ts-test-arrow" />
              </div>
            </div>
          ))}
          {filteredTests.length === 0 && (selectedSubject || searchQuery) && (
            <div className="ts-empty-filtered">
              <p>No tests found{selectedSubject ? ` for "${selectedSubject}"` : ''}{searchQuery ? ` matching "${searchQuery}"` : ''}</p>
              <button className="ts-btn-outline" onClick={() => { setSelectedSubject(null); setSearchQuery(''); }}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  // Test Detail View
  const TestDetailView = () => {
    if (!selectedTest) return null;

    return (
      <div className="ts-detail-grid">
        {/* Left column: Questions */}
        <div className="ts-detail-main">
          <div className="ts-card">
            <div className="ts-card-header">
              <HiClipboardList className="ts-card-icon" />
              <h2>Select Question to Grade</h2>
              <span className="ts-card-badge">{selectedTest.total_questions} total</span>
            </div>
            <div className="ts-questions-grid">
              {Array.from({ length: selectedTest.total_questions }, (_, i) => i + 1).map((qNum) => (
                <button
                  key={qNum}
                  className="ts-question-btn"
                  onClick={() => handleStartGrading(selectedTest.test_id, qNum)}
                >
                  <span className="ts-q-num">Q{qNum}</span>
                  <span className="ts-q-label">Grade</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="ts-detail-actions">
            <button
              className="ts-action-btn ts-action-upload"
              onClick={() => navigate(`/upload-answers?testId=${selectedTest.test_id}`)}
            >
              <HiUpload />
              Upload Answers
            </button>
            <button
              className="ts-action-btn ts-action-results"
              onClick={() => navigate(`/results/${selectedTest.test_id}`)}
            >
              <HiChartBar />
              View Results
            </button>
          </div>
        </div>

        {/* Right column: Test Info */}
        <div className="ts-detail-sidebar">
          <div className="ts-info-card ts-sticky">
            <h3>Test Details</h3>
            <div className="ts-info-item">
              <HiDocumentText />
              <div>
                <span className="ts-info-label">Test Name</span>
                <span className="ts-info-value">{selectedTest.test_name}</span>
              </div>
            </div>
            {selectedTest.subject && (
              <div className="ts-info-item">
                <HiBookOpen />
                <div>
                  <span className="ts-info-label">Subject</span>
                  <span className="ts-info-value">{selectedTest.subject}</span>
                </div>
              </div>
            )}
            <div className="ts-info-item">
              <HiAcademicCap />
              <div>
                <span className="ts-info-label">Grade / Class</span>
                <span className="ts-info-value">{selectedTest.grade}</span>
              </div>
            </div>
            <div className="ts-info-item">
              <HiCalendar />
              <div>
                <span className="ts-info-label">Date</span>
                <span className="ts-info-value">{selectedTest.test_date}</span>
              </div>
            </div>

            <div className="ts-info-divider" />

            <div className="ts-info-stats">
              <div className="ts-stat">
                <span className="ts-stat-num">{selectedTest.total_questions}</span>
                <span className="ts-stat-label">Questions</span>
              </div>
              <div className="ts-stat">
                <span className="ts-stat-num">{selectedTest.student_count || 0}</span>
                <span className="ts-stat-label">Students</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="ts-page">
        <div className="ts-loading">
          <div className="ts-spinner" />
          <p>Loading tests...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        onConfirm={confirmDelete}
        title="Delete Test"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.testName}"? This action cannot be undone.` : ''}
        type="confirm"
      />

      <div className="ts-page">
        {/* Top bar */}
        <div className="ts-topbar">
          {renderBackButton() || <div />}
          {renderTitle()}
          <div className="ts-topbar-actions">
            {currentView !== 'testDetail' && (
              <div className="ts-search">
                <HiSearch className="ts-search-icon" />
                <input
                  type="text"
                  className="ts-search-input"
                  placeholder={currentView === 'classes' ? 'Search classes or tests...' : 'Search tests...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="ts-search-clear" onClick={() => setSearchQuery('')}>
                    <HiX />
                  </button>
                )}
              </div>
            )}
            <button className="ts-btn-primary" onClick={() => navigate('/create-test')}>
              <HiPlus />
              New Test
            </button>
          </div>
        </div>

        <div className="ts-content">
          {currentView === 'classes' && <ClassesView />}
          {currentView === 'tests' && <TestsView />}
          {currentView === 'testDetail' && <TestDetailView />}
        </div>
      </div>
    </>
  );
};

export default TestSelection;
