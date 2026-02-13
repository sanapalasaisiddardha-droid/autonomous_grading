import axios from 'axios';

const API_BASE_URL = 'http://localhost:8002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const gradingAPI = {
  // Start a grading session
  startSession: async (testId, questionNumber) => {
    const response = await api.post('/grading/sessions/start_session/', {
      test_id: testId,
      question_number: questionNumber,
    });
    return response.data;
  },

  // Get anonymized answers for a session
  getSessionAnswers: async (sessionId) => {
    const response = await api.get(`/grading/sessions/${sessionId}/get_answers/`);
    return response.data;
  },

  // Submit grades
  submitGrades: async (sessionId, grades) => {
    const response = await api.post(`/grading/sessions/${sessionId}/submit_grades/`, {
      grades,
    });
    return response.data;
  },

  // Get all tests
  getTests: async () => {
    const response = await api.get('/tests/tests/');
    return response.data;
  },

  // Get test details
  getTestDetails: async (testId) => {
    const response = await api.get(`/tests/tests/${testId}/`);
    return response.data;
  },

  // Create a new test
  createTest: async (testData) => {
    const response = await api.post('/tests/tests/', testData);
    return response.data;
  },

  // Create a question
  createQuestion: async (questionData) => {
    const response = await api.post('/tests/questions/', questionData);
    return response.data;
  },

  // Delete a test
  deleteTest: async (testId) => {
    const response = await api.delete(`/tests/tests/${testId}/`);
    return response.data;
  },

  // Get all students
  getStudents: async () => {
    const response = await api.get('/students/');
    return response.data;
  },

  // Create a student
  createStudent: async (studentData) => {
    const response = await api.post('/students/', studentData);
    return response.data;
  },

  // Upload answer sheets
  uploadAnswers: async (formData) => {
    const response = await api.post('/uploads/submissions/upload_answers/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get test results
  getTestResults: async (testId) => {
    const response = await api.get(`/grading/sessions/test_results/?test_id=${testId}`);
    return response.data;
  },

  // Save annotation data for an answer
  saveAnnotation: async (sessionId, answerId, annotationData) => {
    const response = await api.post(`/grading/sessions/${sessionId}/save_annotation/`, {
      answer_id: answerId,
      annotation_data: annotationData,
    });
    return response.data;
  },

  // Get all annotations for a session
  getAnnotations: async (sessionId) => {
    const response = await api.get(`/grading/sessions/${sessionId}/get_annotations/`);
    return response.data;
  },
};

export default api;
