import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { gradingAPI } from '../services/api';
import Toast from '../components/Toast';
import {
  HiArrowLeft, HiDownload, HiUsers, HiClipboardList,
  HiChartBar, HiDocumentText, HiBookOpen, HiAcademicCap, HiCalendar
} from 'react-icons/hi';
import './TestResults.css';

const TestResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { testId } = useParams();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (testId) {
      loadResults();
    }
  }, [testId]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const data = await gradingAPI.getTestResults(testId);
      setResults(data);
    } catch (err) {
      console.error('Failed to load results:', err);
      setToast({ message: 'Failed to load results. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const escapeCSVField = (value) => {
    const str = String(value);
    let safe = str;
    if (/^[=+\-@]/.test(safe)) {
      safe = "'" + safe;
    }
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
      safe = '"' + safe.replace(/"/g, '""') + '"';
    }
    return safe;
  };

  const exportToCSV = () => {
    if (!results || !results.results) return;

    const questions = results.results[0]?.questions
      ? Object.keys(results.results[0].questions).sort()
      : [];

    const headers = ['Roll Number', ...questions, 'Total', 'Max Total', 'Percentage'];
    let csv = headers.map(escapeCSVField).join(',') + '\n';

    results.results.forEach(student => {
      const percentage = ((student.total / student.max_total) * 100).toFixed(2) + '%';
      const row = [
        student.roll_number,
        ...questions.map(q => student.questions[q] ? student.questions[q].marks : 0),
        student.total,
        student.max_total,
        percentage
      ];
      csv += row.map(escapeCSVField).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${results.test_name}_results.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    setToast({ message: 'Results exported successfully!', type: 'success' });
  };

  if (loading) {
    return (
      <div className="tr-page">
        <div className="tr-loading">
          <div className="tr-spinner" />
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  if (!results || !results.results || results.results.length === 0) {
    return (
      <div className="tr-page">
        <div className="tr-topbar">
          <button className="tr-back" onClick={() => navigate('/', { state: { returnToClass: results?.grade, returnToTestId: testId } })}>
            <HiArrowLeft />
            <span>Back to Tests</span>
          </button>
          <div className="tr-topbar-title">
            <h1>Test Results</h1>
            <p>No data available</p>
          </div>
          <div className="tr-topbar-actions" />
        </div>
        <div className="tr-content">
          <div className="tr-empty">
            <HiChartBar className="tr-empty-icon" />
            <h2>No results available</h2>
            <p>No grades have been submitted for this test yet.</p>
            <button className="tr-btn-outline" onClick={() => navigate('/', { state: { returnToClass: results?.grade, returnToTestId: testId } })}>
              Back to Tests
            </button>
          </div>
        </div>
      </div>
    );
  }

  const questions = results.results[0]?.questions
    ? Object.keys(results.results[0].questions).sort((a, b) => {
        const numA = parseInt(a.substring(1));
        const numB = parseInt(b.substring(1));
        return numA - numB;
      })
    : [];

  const avgScore = (results.results.reduce((sum, s) => sum + (s.total / s.max_total), 0) / results.total_students * 100).toFixed(1);

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="tr-page">
        {/* Top bar */}
        <div className="tr-topbar">
          <button className="tr-back" onClick={() => navigate('/', { state: { returnToClass: results?.grade, returnToTestId: testId } })}>
            <HiArrowLeft />
            <span>Back to Tests</span>
          </button>
          <div className="tr-topbar-title">
            <h1>{results.test_name}</h1>
            <p>{results.grade} — {results.test_date}</p>
          </div>
          <div className="tr-topbar-actions">
            <button className="tr-btn-export" onClick={exportToCSV}>
              <HiDownload />
              Export CSV
            </button>
          </div>
        </div>

        <div className="tr-content">
          <div className="tr-layout">
            {/* Main column */}
            <div className="tr-main">
              {/* Summary cards */}
              <div className="tr-summary">
                <div className="tr-summary-card">
                  <div className="tr-summary-icon tr-icon-indigo">
                    <HiUsers />
                  </div>
                  <div>
                    <span className="tr-summary-num">{results.total_students}</span>
                    <span className="tr-summary-label">Students</span>
                  </div>
                </div>
                <div className="tr-summary-card">
                  <div className="tr-summary-icon tr-icon-cyan">
                    <HiClipboardList />
                  </div>
                  <div>
                    <span className="tr-summary-num">{questions.length}</span>
                    <span className="tr-summary-label">Questions</span>
                  </div>
                </div>
                <div className="tr-summary-card">
                  <div className="tr-summary-icon tr-icon-green">
                    <HiChartBar />
                  </div>
                  <div>
                    <span className="tr-summary-num">{avgScore}%</span>
                    <span className="tr-summary-label">Average</span>
                  </div>
                </div>
              </div>

              {/* Results Table */}
              <div className="tr-card">
                <div className="tr-card-header">
                  <HiDocumentText className="tr-card-icon" />
                  <h2>Results</h2>
                  <span className="tr-card-badge">{results.total_students} students</span>
                </div>
                <div className="tr-table-wrap">
                  <table className="tr-table">
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        {questions.map(q => (
                          <th key={q} className="tr-th-center">{q}</th>
                        ))}
                        <th className="tr-th-center">Total</th>
                        <th className="tr-th-center">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.results.map((student, index) => {
                        const percentage = ((student.total / student.max_total) * 100).toFixed(1);
                        return (
                          <tr key={student.student_id}>
                            <td className="tr-cell-roll">{student.roll_number}</td>
                            {questions.map(q => {
                              const qData = student.questions[q];
                              return (
                                <td key={q} className="tr-cell-marks">
                                  {qData ? `${qData.marks}/${qData.max_marks}` : '-'}
                                </td>
                              );
                            })}
                            <td className="tr-cell-total">{student.total}/{student.max_total}</td>
                            <td className="tr-cell-pct">
                              <span className={`tr-pct-badge ${percentage >= 75 ? 'high' : percentage >= 50 ? 'mid' : 'low'}`}>
                                {percentage}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="tr-sidebar">
              <div className="tr-info-card tr-sticky">
                <h3>Test Info</h3>
                <div className="tr-info-item">
                  <HiDocumentText />
                  <div>
                    <span className="tr-info-label">Test Name</span>
                    <span className="tr-info-value">{results.test_name}</span>
                  </div>
                </div>
                <div className="tr-info-item">
                  <HiAcademicCap />
                  <div>
                    <span className="tr-info-label">Grade / Class</span>
                    <span className="tr-info-value">{results.grade}</span>
                  </div>
                </div>
                <div className="tr-info-item">
                  <HiCalendar />
                  <div>
                    <span className="tr-info-label">Date</span>
                    <span className="tr-info-value">{results.test_date}</span>
                  </div>
                </div>

                <div className="tr-info-divider" />

                <div className="tr-info-stats">
                  <div className="tr-stat">
                    <span className="tr-stat-num">{results.total_students}</span>
                    <span className="tr-stat-label">Students</span>
                  </div>
                  <div className="tr-stat">
                    <span className="tr-stat-num">{questions.length}</span>
                    <span className="tr-stat-label">Questions</span>
                  </div>
                </div>

                <div className="tr-info-divider" />

                <button className="tr-btn-export tr-btn-full" onClick={exportToCSV}>
                  <HiDownload />
                  Export to CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TestResults;
