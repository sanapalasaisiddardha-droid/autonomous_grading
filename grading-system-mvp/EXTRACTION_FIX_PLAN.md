# Fix Question Extraction from Handwritten Answer Sheet PDFs

## Context

When uploading 2-page PDF answer sheets (Section A: Q1-9, Section B: Q10-16), the image processor splits at wrong points. The root cause is threefold:

1. **OCR finds 0 questions** - Tesseract can't read handwritten numbers on ruled notebook paper
2. **43 whitespace gaps detected** - Every inter-line space on ruled paper qualifies as a gap (76-481px)
3. **Equal-spacing assumption is wrong** - The fallback picks gaps closest to evenly-spaced ideal positions, but Q7 is 1 line while Q14 is 5+ lines

## Approach: Page-Aware Gap Classification

All changes are in one file: `backend/apps/uploads/image_processor.py`

### Step 1: Return page boundaries from PDF conversion
**Method:** `convert_pdf_to_image` (line 439)

Return `(image_path, page_heights)` instead of just `image_path`. This preserves where page 2 starts so we can process pages independently.

### Step 2: Add `_classify_gaps` method (new)
Distinguish question-boundary gaps from ruled-line gaps using **median-based thresholding**:
- Compute median gap height (~100px for ruled lines)
- Gaps taller than `median * 1.3` are question boundary candidates (~130px+, which catches the 140-180px between-question gaps)
- Exclude image margins and the page-boundary gap

### Step 3: Rewrite `extract_question_sections` Strategy 2 (line 249)
Replace the equal-spacing algorithm with **page-aware, tallest-gap selection**:

1. **Detect page boundary** - from `page_heights` or the single largest mid-image gap
2. **Split questions per page** - distribute proportionally by page height (or accept explicit `[9, 7]`)
3. **Process each page independently:**
   - Run `_find_whitespace_gaps` on just that page
   - Run `_classify_gaps` to filter to question-boundary candidates
   - Select the **N-1 tallest** gaps (not nearest-to-ideal) as split points
   - Fallback: supplement with next-tallest gaps if not enough candidates
4. **Sanity check** - no two splits closer than `page_height / (questions * 3)`

### Step 4: Update `process_answer_sheet` (line 505)
Unpack the new tuple from `convert_pdf_to_image` and pass `page_heights` through to `extract_question_sections`.

### Step 5: Replace Tesseract with Google Cloud Vision for question detection
- Use Vision API `text_detection` instead of Tesseract (much better at handwriting)
- Credentials already available at `credentials/google-cloud-vision-credentials.json`
- Vision API returns bounding boxes with positions - use these to locate question numbers
- Binarize margin crop before sending to remove ruled lines

## Files to Modify

| File | Changes |
|------|---------|
| `backend/apps/uploads/image_processor.py` | All extraction logic (~120 lines modified/added) |

No model changes, no frontend changes, no new dependencies.

## Verification

1. Run extraction on all 3 test PDFs (`015_eng.pdf`, `84_eng.pdf`, `082_eng.pdf`) with `num_questions=16`
2. Verify 16 sections extracted with correct split points
3. Save extracted sections as images for visual inspection
4. Test via the upload API endpoint to confirm end-to-end flow works
