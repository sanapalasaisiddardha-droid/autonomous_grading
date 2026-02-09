import { useState, useCallback } from 'react';

/**
 * Shared hook for file upload validation, drag-and-drop, and file management.
 *
 * @param {Object} options
 * @param {Array}    options.students  - Known students list (to match roll numbers)
 * @param {string}   options.grade     - Grade string assigned to new (unrecognized) students
 * @param {Function} options.onToast   - Callback to show toast: ({ message, type }) => void
 */
const useFileUpload = ({ students = [], grade = '', onToast }) => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  const extractRollNumber = (filename) => {
    const nameWithoutExt = filename.split('.')[0];
    return nameWithoutExt.trim();
  };

  const validateAndAddFiles = useCallback((files) => {
    const validFiles = [];
    const errors = [];

    Array.from(files).forEach(file => {
      // Validate file type (images and PDFs)
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (!isImage && !isPDF) {
        errors.push(`${file.name}: Only image files (JPG, PNG) and PDF files are allowed`);
        return;
      }

      // Validate file size (max 20MB for PDFs, 10MB for images)
      const maxSize = isPDF ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        errors.push(`${file.name}: File size exceeds ${isPDF ? '20MB' : '10MB'}`);
        return;
      }

      const rollNumber = extractRollNumber(file.name);

      // Check if roll number is valid
      if (!rollNumber || rollNumber.length === 0) {
        errors.push(`${file.name}: Invalid filename. Use roll number as filename (e.g., 101.pdf)`);
        return;
      }

      validFiles.push({ file, rollNumber });
    });

    // We need the current uploadedFiles for duplicate checking, so we use a
    // functional state update that has access to the latest state.
    setUploadedFiles(prev => {
      const finalValid = [];

      for (const { file, rollNumber } of validFiles) {
        const isDuplicate =
          prev.some(f => extractRollNumber(f.file.name) === rollNumber) ||
          finalValid.some(f => extractRollNumber(f.file.name) === rollNumber);

        if (isDuplicate) {
          errors.push(`${file.name}: Duplicate file for roll number "${rollNumber}"`);
          continue;
        }

        const student = students.find(s => s.roll_number === rollNumber);

        finalValid.push({
          file,
          rollNumber,
          student: student || {
            name: `Student ${rollNumber}`,
            grade: grade,
            roll_number: rollNumber,
            isNew: true,
          },
        });
      }

      if (errors.length > 0) {
        onToast?.({
          message: `Some files were skipped: ${errors.join(', ')}`,
          type: 'error',
        });
      }

      if (finalValid.length > 0) {
        onToast?.({
          message: `Added ${finalValid.length} file(s) successfully`,
          type: 'success',
        });
      }

      return [...prev, ...finalValid];
    });
  }, [students, grade, onToast]);

  const handleFileSelect = useCallback((e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndAddFiles(files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [validateAndAddFiles]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  }, [validateAndAddFiles]);

  const handleRemoveFile = useCallback((index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  return {
    uploadedFiles,
    dragActive,
    handleFileSelect,
    handleDrag,
    handleDrop,
    handleRemoveFile,
    clearFiles,
  };
};

export default useFileUpload;
