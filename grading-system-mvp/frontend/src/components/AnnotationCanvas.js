import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import './AnnotationCanvas.css';

const AnnotationCanvas = forwardRef(({
  imageUrl,
  active,
  tool = 'pen',
  color = '#ff0000',
  initialData = null,
  onStrokeChange,
}, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [strokes, setStrokes] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const isDrawing = useRef(false);
  const currentStroke = useRef(null);
  const onStrokeChangeRef = useRef(onStrokeChange);
  onStrokeChangeRef.current = onStrokeChange;

  const notifyParent = useCallback(() => {
    if (onStrokeChangeRef.current) onStrokeChangeRef.current();
  }, []);

  // Load initial data
  useEffect(() => {
    if (initialData && initialData.strokes && initialData.strokes.length > 0) {
      setStrokes(initialData.strokes);
      setRedoStack([]);
    }
  }, [initialData]);

  // Get tool properties
  const getToolProps = useCallback(() => {
    switch (tool) {
      case 'highlighter':
        return { width: 20, opacity: 0.4 };
      case 'eraser':
        return { width: 20, opacity: 1.0 };
      default: // pen
        return { width: 2, opacity: 1.0 };
    }
  }, [tool]);

  // Convert mouse/touch position to normalized [0-1] coordinates
  const getNormalizedPoint = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [
      (clientX - rect.left) / rect.width,
      (clientY - rect.top) / rect.height,
    ];
  }, []);

  // Draw a single stroke on a canvas context
  const drawStroke = useCallback((ctx, stroke, canvasWidth, canvasHeight) => {
    if (!stroke.points || stroke.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * (canvasWidth / 800); // scale relative to a reference width
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const [x0, y0] = stroke.points[0];
    ctx.moveTo(x0 * canvasWidth, y0 * canvasHeight);
    for (let i = 1; i < stroke.points.length; i++) {
      const [x, y] = stroke.points[i];
      ctx.lineTo(x * canvasWidth, y * canvasHeight);
    }
    ctx.stroke();
    ctx.restore();
  }, []);

  // Redraw all strokes on the canvas
  const redrawAll = useCallback((strokeList) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const list = strokeList || strokes;
    list.forEach(s => drawStroke(ctx, s, canvas.width, canvas.height));
  }, [strokes, drawStroke]);

  // Helper to find sibling <img> in parent .gd-image-wrap
  const getImageElement = useCallback(() => {
    const container = containerRef.current;
    if (!container) return null;
    // The img is a sibling inside the parent .gd-image-wrap
    return container.parentElement?.querySelector('img') || null;
  }, []);

  // Resize canvas to match image and redraw
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = getImageElement();
    if (img && img.complete && img.naturalHeight > 0) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
    } else {
      const container = containerRef.current;
      if (container) {
        canvas.width = container.parentElement?.clientWidth || container.clientWidth;
        canvas.height = container.parentElement?.clientHeight || container.clientHeight;
      }
    }
    redrawAll();
  }, [redrawAll, getImageElement]);

  // ResizeObserver to track container size changes
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const parent = container.parentElement;

    resizeCanvas();

    const observer = new ResizeObserver(() => resizeCanvas());
    if (parent) observer.observe(parent);

    // Also resize when image loads
    const img = getImageElement();
    if (img) {
      img.addEventListener('load', resizeCanvas);
    }

    return () => {
      observer.disconnect();
      if (img) img.removeEventListener('load', resizeCanvas);
    };
  }, [active, resizeCanvas, getImageElement]);

  // Redraw when strokes change
  useEffect(() => {
    if (active) redrawAll();
  }, [strokes, active, redrawAll]);

  // Find stroke at a point (for eraser)
  const findStrokeAtPoint = useCallback((point, strokeList) => {
    const threshold = 0.03; // normalized distance threshold
    for (let i = strokeList.length - 1; i >= 0; i--) {
      const stroke = strokeList[i];
      for (const [px, py] of stroke.points) {
        const dx = px - point[0];
        const dy = py - point[1];
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          return i;
        }
      }
    }
    return -1;
  }, []);

  // Mouse/touch handlers
  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    if (tool === 'eraser') {
      const idx = findStrokeAtPoint(pt, strokes);
      if (idx >= 0) {
        const newStrokes = [...strokes];
        newStrokes.splice(idx, 1);
        setStrokes(newStrokes);
        setRedoStack([]);
        notifyParent();
      }
      return;
    }

    isDrawing.current = true;
    const { width, opacity } = getToolProps();
    currentStroke.current = {
      tool,
      color,
      width,
      opacity,
      points: [pt],
    };
  }, [tool, color, getNormalizedPoint, getToolProps, findStrokeAtPoint, strokes, notifyParent]);

  const handlePointerMove = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (tool === 'eraser') {
      if (e.buttons === 1 || (e.touches && e.touches.length > 0)) {
        const pt = getNormalizedPoint(e);
        if (!pt) return;
        const idx = findStrokeAtPoint(pt, strokes);
        if (idx >= 0) {
          const newStrokes = [...strokes];
          newStrokes.splice(idx, 1);
          setStrokes(newStrokes);
          setRedoStack([]);
          notifyParent();
        }
      }
      return;
    }

    if (!isDrawing.current || !currentStroke.current) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    currentStroke.current.points.push(pt);

    // Draw the current in-progress stroke
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(s => drawStroke(ctx, s, canvas.width, canvas.height));
    drawStroke(ctx, currentStroke.current, canvas.width, canvas.height);
  }, [tool, getNormalizedPoint, findStrokeAtPoint, strokes, drawStroke, notifyParent]);

  const handlePointerUp = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDrawing.current || !currentStroke.current) return;
    isDrawing.current = false;

    // Capture the completed stroke before nulling the ref,
    // otherwise React's batched updater will see null
    const completedStroke = currentStroke.current;
    currentStroke.current = null;

    if (completedStroke.points.length >= 2) {
      setStrokes(prev => [...prev, completedStroke]);
      setRedoStack([]);
      notifyParent();
    }
  }, [notifyParent]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getAnnotationData: () => ({
      version: 1,
      strokes,
    }),
    hasStrokes: () => strokes.length > 0,
    undo: () => {
      if (strokes.length === 0) return;
      const last = strokes[strokes.length - 1];
      setStrokes(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, last]);
      notifyParent();
    },
    redo: () => {
      if (redoStack.length === 0) return;
      const last = redoStack[redoStack.length - 1];
      setRedoStack(prev => prev.slice(0, -1));
      setStrokes(prev => [...prev, last]);
      notifyParent();
    },
    canUndo: () => strokes.length > 0,
    canRedo: () => redoStack.length > 0,
    exportMergedImage: () => {
      return new Promise((resolve) => {
        const img = getImageElement();
        if (!img) { resolve(null); return; }

        const offscreen = document.createElement('canvas');
        offscreen.width = img.naturalWidth;
        offscreen.height = img.naturalHeight;
        const ctx = offscreen.getContext('2d');

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Draw all strokes at natural resolution
        strokes.forEach(s => drawStroke(ctx, s, offscreen.width, offscreen.height));

        offscreen.toBlob((blob) => resolve(blob), 'image/png');
      });
    },
  }), [strokes, redoStack, drawStroke, getImageElement, notifyParent]);

  if (!active) return null;

  return (
    <div className="annotation-canvas-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="annotation-canvas"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        style={{ cursor: tool === 'eraser' ? 'crosshair' : 'crosshair' }}
      />
    </div>
  );
});

AnnotationCanvas.displayName = 'AnnotationCanvas';

export default AnnotationCanvas;
