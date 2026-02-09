# Fix: Improve question extraction for 01_maths-style sheets

## Root Cause
On ruled notebook paper with short answers (like Q2="c)", Q3="b)"), ALL whitespace gaps between ruled lines are the same height (~80-90px). The gap-based splitting (Strategy 2) cannot distinguish "empty space after a short answer" from "boundary between questions." The only reliable approach is OCR-based detection (Strategy 1), but it currently has issues:

1. **False positives** — the left 20% margin crop captures answer text digits (e.g., "8" from "8m+5m+...") which get misidentified as question numbers at wrong y-positions, corrupting the ascending-order validation
2. **Threshold too high** — Strategy 1 requires 75% detection, but even 30-40% + interpolation gives accurate results. When it falls below 75%, the code falls to the broken gap-based strategy

## Changes (3 files, all in `backend/apps/uploads/image_processor.py`)

### Fix 1: X-position filtering in `_detect_question_numbers_vision` (~line 310-331)
- After getting bounding box vertices, compute x_center
- Only accept detections where `x_center < left_width * 0.60` (leftmost 60% of the margin crop = leftmost 12% of full page)
- This eliminates false positives from answer text bleeding into the margin crop

### Fix 2: Expand regex patterns in `_detect_question_numbers_vision` (~line 304)
- Add pattern for answer-choice format: `r'^(\d{1,2})\s?[a-eA-E][)\].]?$'` — catches "2c)", "3b)"
- Add pattern for "Ans" format: `r'^(\d{1,2})\.?\s?[Aa]ns'` — catches "1.Ans", "2 Ans"

### Fix 3: Lower Strategy 1 acceptance threshold (~line 687)
- Change from `num_questions * 0.75` to `num_questions * 0.50`
- Since interpolation fills gaps well from just 2-3 anchor detections, this ensures OCR is preferred over gap-based splitting

### Fix 4: Same x-position + pattern fixes in Tesseract fallback (~line 500-524)
- Add x-position check: `ocr_data['left'][i] < left_width * 0.60`
- Add same expanded patterns

## Files NOT changed
- Frontend — no changes
- Views, models, other backend files — no changes

## Verification
- Re-upload 01_maths.pdf and check that questions 1-13 (or however many) are correctly split
- Re-upload 02_maths.pdf and 03_maths.pdf to verify they still work (85-90% accuracy preserved)
