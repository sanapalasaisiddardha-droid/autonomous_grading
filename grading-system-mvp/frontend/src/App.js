import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import TestSelection from './pages/TestSelection';
import GradingDashboard from './pages/GradingDashboard';
import CreateTest from './pages/CreateTest';
import UploadAnswers from './pages/UploadAnswers';
import TestResults from './pages/TestResults';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Grading page - no sidebar */}
          <Route path="/grade/:testId/:questionNumber" element={<GradingDashboard />} />

          {/* All other pages - with sidebar layout */}
          <Route path="/" element={<Layout><TestSelection /></Layout>} />
          <Route path="/create-test" element={<Layout><CreateTest /></Layout>} />
          <Route path="/upload-answers" element={<Layout><UploadAnswers /></Layout>} />
          <Route path="/results/:testId" element={<Layout><TestResults /></Layout>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
