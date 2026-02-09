"""
Image Processing Service for Answer Sheet Extraction
Uses Google Cloud Vision API and OpenCV to extract individual questions from answer sheets
Supports both image files (JPG, PNG) and PDF files
"""
import os
import re
import cv2
import numpy as np
from google.cloud import vision
from django.conf import settings
from PIL import Image
from pdf2image import convert_from_path
from PyPDF2 import PdfReader
import pytesseract
import io
import tempfile


class ImageProcessor:
    """
    Process answer sheet images to extract individual question sections
    """

    def __init__(self):
        """Initialize Vision API client"""
        try:
            # Set credentials from settings
            credentials_path = getattr(settings, 'GOOGLE_APPLICATION_CREDENTIALS', None)
            if credentials_path and os.path.exists(credentials_path):
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path
                self.client = vision.ImageAnnotatorClient()
            else:
                print("Warning: Google Cloud Vision credentials not found. Image processing disabled.")
                self.client = None
        except Exception as e:
            print(f"Error initializing Vision API: {e}")
            self.client = None

    def analyze_image_quality(self, image_path):
        """
        Analyze image quality using Google Cloud Vision API

        Args:
            image_path: Path to the image file

        Returns:
            tuple: (quality_score, confidence_level, ocr_text)
        """
        if not self.client:
            # Return mock data if Vision API not available
            return 0.85, 'high', ''

        try:
            with io.open(image_path, 'rb') as image_file:
                content = image_file.read()

            image = vision.Image(content=content)

            # Perform text detection
            response = self.client.text_detection(image=image)
            texts = response.text_annotations
            ocr_text = texts[0].description if texts else ""

            # Perform image properties detection
            properties_response = self.client.image_properties(image=image)
            dominant_colors = properties_response.image_properties_annotation.dominant_colors.colors

            # Calculate quality score based on:
            # - Text detection confidence
            # - Image brightness and contrast
            # - Color distribution
            quality_score = self._calculate_quality_score(response, properties_response)
            confidence_level = 'high' if quality_score > 0.75 else 'medium' if quality_score > 0.5 else 'low'

            return quality_score, confidence_level, ocr_text

        except Exception as e:
            print(f"Error analyzing image: {e}")
            return 0.70, 'medium', ''

    def _calculate_quality_score(self, text_response, properties_response):
        """
        Calculate quality score based on Vision API responses

        Returns:
            float: Quality score between 0 and 1
        """
        score = 0.5  # Base score

        # Check text detection
        if text_response.text_annotations:
            # More text detected = better quality
            text_length = len(text_response.text_annotations[0].description)
            text_score = min(text_length / 500, 0.3)  # Max 0.3 from text
            score += text_score

        # Check color distribution (good contrast = better quality)
        if properties_response.image_properties_annotation.dominant_colors.colors:
            colors = properties_response.image_properties_annotation.dominant_colors.colors
            if len(colors) >= 2:
                # Good contrast if multiple distinct colors
                score += 0.2

        return min(score, 1.0)

    def _find_whitespace_gaps(self, gray_image, min_gap_height=20):
        """
        Find horizontal whitespace gaps in a grayscale image.
        These gaps are natural boundaries between questions.

        Args:
            gray_image: Grayscale numpy array
            min_gap_height: Minimum number of consecutive near-white rows
                            to count as a gap

        Returns:
            list of (gap_center_y, gap_height) tuples sorted by y position
        """
        height = gray_image.shape[0]

        # For each row compute the fraction of near-white pixels (>230)
        row_whiteness = np.mean(gray_image > 230, axis=1)

        # A row is "blank" if >95 % of its pixels are near-white
        is_blank = row_whiteness > 0.95

        # Walk through rows and collect contiguous blank runs
        gaps = []
        in_gap = False
        gap_start = 0

        for y in range(height):
            if is_blank[y] and not in_gap:
                in_gap = True
                gap_start = y
            elif not is_blank[y] and in_gap:
                in_gap = False
                gap_h = y - gap_start
                if gap_h >= min_gap_height:
                    gaps.append((gap_start + gap_h // 2, gap_h))

        # Handle gap that reaches the bottom
        if in_gap:
            gap_h = height - gap_start
            if gap_h >= min_gap_height:
                gaps.append((gap_start + gap_h // 2, gap_h))

        return gaps

    def _classify_gaps(self, gaps, image_height, page_boundaries=None,
                       margin_fraction=0.02, min_candidates=0):
        """
        Classify whitespace gaps as question-boundary candidates vs ruled-line gaps.

        Uses progressive median-based thresholding: starts at median * 1.3 and
        lowers the multiplier in steps until enough candidates are found.

        Args:
            gaps: list of (gap_center_y, gap_height) from _find_whitespace_gaps
            image_height: total height of the image
            page_boundaries: list of y-positions where pages meet (from stitching)
            margin_fraction: fraction of image height to exclude at top/bottom margins
            min_candidates: minimum number of candidates needed; the threshold will
                            be progressively lowered until this many are found.

        Returns:
            list of (gap_center_y, gap_height) that are question-boundary candidates,
            sorted by y position.
        """
        if not gaps:
            return []

        margin_px = int(image_height * margin_fraction)
        gap_heights = [g[1] for g in gaps]
        median_h = float(np.median(gap_heights))

        # Build a set of y-zones to exclude: top/bottom margins and page boundaries
        exclude_zones = []
        exclude_zones.append((0, margin_px))
        exclude_zones.append((image_height - margin_px, image_height))
        if page_boundaries:
            for pb in page_boundaries:
                zone_margin = int(image_height * 0.03)
                exclude_zones.append((pb - zone_margin, pb + zone_margin))

        def in_exclude_zone(y):
            for lo, hi in exclude_zones:
                if lo <= y <= hi:
                    return True
            return False

        # Filter gaps that are not in exclude zones
        valid_gaps = [(cy, ch) for cy, ch in gaps if not in_exclude_zone(cy)]

        # Progressive threshold: start at 1.3x median, lower to 1.05x
        # This catches boundary gaps that are only slightly larger than ruled lines
        candidates = []
        multiplier = 1.3
        while multiplier >= 1.05:
            threshold = median_h * multiplier
            candidates = [(cy, ch) for cy, ch in valid_gaps if ch >= threshold]
            if len(candidates) >= min_candidates:
                break
            multiplier -= 0.05

        print(f"Gap classification: {len(gaps)} total gaps, median={median_h:.0f}px, "
              f"multiplier={multiplier:.2f}, threshold={median_h * multiplier:.0f}px, "
              f"{len(candidates)} candidates (needed {min_candidates})")

        return candidates

    def _remove_ruled_lines(self, gray_image):
        """
        Remove horizontal ruled lines from a grayscale image using morphology.

        Ruled lines on notebook paper are long horizontal structures. We detect
        them with a wide horizontal kernel and subtract, leaving only the
        handwritten ink (numbers, text).

        Args:
            gray_image: Grayscale numpy array

        Returns:
            Cleaned binary image (white background, black ink, no ruled lines)
        """
        # Binarize: ink is dark, paper+lines are light
        # Use Otsu's method for automatic threshold
        _, binary = cv2.threshold(gray_image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Detect horizontal lines with a wide kernel
        # Lines span the full width, so use a kernel ~1/3 of image width
        h_kernel_len = max(40, gray_image.shape[1] // 3)
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_kernel_len, 1))
        detected_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)

        # Dilate lines slightly to catch line edges
        detected_lines = cv2.dilate(detected_lines, np.ones((3, 3), np.uint8), iterations=1)

        # Subtract lines from the binary image
        clean = cv2.subtract(binary, detected_lines)

        # Invert back: white background, black text
        clean = cv2.bitwise_not(clean)

        return clean

    def _detect_question_numbers_vision(self, image_path, num_questions):
        """
        Use Google Cloud Vision API document_text_detection() to find
        handwritten question numbers in the left margin of the image.

        Vision API is far more accurate than Tesseract for handwriting on
        ruled notebook paper.

        After detection, interpolates positions for any missing question
        numbers so that all num_questions are represented.

        Args:
            image_path: Path to the stitched answer sheet image
            num_questions: Expected number of questions

        Returns:
            list of (question_number, y_position) tuples sorted by y,
            or empty list if detection fails.
        """
        try:
            full_image = cv2.imread(image_path)
            if full_image is None:
                return []

            height, width = full_image.shape[:2]

            # Crop left 20% margin — question numbers live here.
            # Slightly wider than Tesseract's 15% to catch indented numbers.
            left_width = int(width * 0.20)
            left_margin = full_image[0:height, 0:left_width]

            # Encode the cropped margin as PNG bytes for the Vision API
            success, encoded = cv2.imencode('.png', left_margin)
            if not success:
                print("Vision API: failed to encode left margin image", flush=True)
                return []

            image_bytes = encoded.tobytes()
            vision_image = vision.Image(content=image_bytes)

            # Use document_text_detection — optimized for handwriting
            response = self.client.document_text_detection(image=vision_image)

            if response.error.message:
                print(f"Vision API error: {response.error.message}", flush=True)
                return []

            # Use text_annotations (flat list, simpler to work with).
            # First entry is the full text; subsequent entries are individual words.
            annotations = response.text_annotations
            if not annotations or len(annotations) < 2:
                print("Vision API: no text detected in left margin", flush=True)
                return []

            # Patterns for question numbers: "1.", "2.", "10.", "Q1", "Q2",
            # or bare "1", "2", "10", also "1)", "2]", etc.
            number_pattern = re.compile(r'^(\d{1,2})\.?[)\]:]?$')
            q_pattern = re.compile(r'^[Qq]\.?(\d{1,2})\.?$')

            detections = []  # (question_number, y_center)

            # Skip index 0 (full text block); iterate individual word annotations
            for annotation in annotations[1:]:
                text = annotation.description.strip()
                if not text:
                    continue

                q_num = None
                m = number_pattern.match(text)
                if m:
                    q_num = int(m.group(1))
                else:
                    m = q_pattern.match(text)
                    if m:
                        q_num = int(m.group(1))

                if q_num is not None and 1 <= q_num <= num_questions:
                    # Get y-position from bounding box vertices.
                    # Vertices are relative to the cropped image, which has the
                    # same vertical extent as the full image (full height crop).
                    vertices = annotation.bounding_poly.vertices
                    y_coords = [v.y for v in vertices]
                    y_center = (min(y_coords) + max(y_coords)) // 2
                    detections.append((q_num, y_center))

            if not detections:
                print("Vision API: no question numbers matched in left margin", flush=True)
                return []

            # For each question number, keep the detection with the smallest
            # (topmost) y-position — the first occurrence is the real label.
            from collections import defaultdict
            by_qnum = defaultdict(list)
            for q_num, y_pos in detections:
                by_qnum[q_num].append(y_pos)

            seen = {}
            for q_num, y_positions in by_qnum.items():
                seen[q_num] = min(y_positions)  # topmost occurrence

            # Sort by y-position and validate ascending question numbers.
            # This filters out false positives — e.g., the digit "6" in
            # answer text that appears below Q8's label.
            result = sorted(seen.items(), key=lambda x: x[1])

            validated = []
            last_num = 0
            for q_num, y_pos in result:
                if q_num > last_num:
                    validated.append((q_num, y_pos))
                    last_num = q_num

            print(f"Vision API detected {len(validated)} question numbers: "
                  f"{[q for q, _ in validated]} "
                  f"(raw: {len(detections)} detections, {len(seen)} unique)",
                  flush=True)

            # --- Interpolate missing question numbers ---
            # If we found most questions but some are missing, fill in the
            # gaps by linear interpolation between surrounding detections.
            if len(validated) >= num_questions:
                return validated

            detected_nums = {q for q, _ in validated}
            missing = [q for q in range(1, num_questions + 1) if q not in detected_nums]

            if missing and len(validated) >= 2:
                # Build a lookup: question_number -> y_position
                pos_map = dict(validated)

                for mq in missing:
                    # Find the nearest detected questions below and above
                    lower = [(q, y) for q, y in validated if q < mq]
                    upper = [(q, y) for q, y in validated if q > mq]

                    if lower and upper:
                        # Interpolate between the closest lower and upper
                        lq, ly = lower[-1]
                        uq, uy = upper[0]
                        frac = (mq - lq) / (uq - lq)
                        interp_y = int(ly + frac * (uy - ly))
                    elif lower:
                        # Extrapolate after the last detected
                        lq, ly = lower[-1]
                        if len(lower) >= 2:
                            avg_step = (lower[-1][1] - lower[0][1]) / (lower[-1][0] - lower[0][0])
                        else:
                            avg_step = ly / max(lq, 1)
                        interp_y = int(ly + avg_step * (mq - lq))
                    elif upper:
                        # Extrapolate before the first detected
                        uq, uy = upper[0]
                        if len(upper) >= 2:
                            avg_step = (upper[-1][1] - upper[0][1]) / (upper[-1][0] - upper[0][0])
                        else:
                            avg_step = uy / max(uq, 1)
                        interp_y = int(uy - avg_step * (uq - mq))
                    else:
                        continue

                    interp_y = max(0, min(interp_y, height - 1))
                    pos_map[mq] = interp_y

                validated = sorted(pos_map.items(), key=lambda x: x[1])
                print(f"  After interpolation: {len(validated)} questions "
                      f"(filled {len(missing)} missing: {missing})", flush=True)

            return validated

        except Exception as e:
            import traceback
            print(f"Vision API question detection failed: {e}", flush=True)
            traceback.print_exc()
            return []

    def _detect_question_numbers(self, image_path, num_questions):
        """
        Detect question number labels in the image using OCR.

        Tries Google Cloud Vision API first (much better for handwriting),
        then falls back to Tesseract if Vision API is unavailable or returns
        insufficient results.

        Looks for patterns like "1.", "2.", "10.", "Q1", or bare "1", "2".

        Args:
            image_path: Path to the stitched answer sheet image
            num_questions: Expected number of questions

        Returns:
            list of (question_number, y_position) tuples sorted by y,
            or empty list if detection fails.
        """
        # --- Try Vision API first (handles handwriting much better) ---
        if self.client:
            vision_results = self._detect_question_numbers_vision(image_path, num_questions)
            if len(vision_results) >= num_questions * 0.5:
                # Vision API found a reasonable number of questions — use it
                return vision_results
            print(f"Vision API found only {len(vision_results)} questions "
                  f"(need ~{num_questions}), falling back to Tesseract",
                  flush=True)
        else:
            print("Vision API client not available, using Tesseract fallback",
                  flush=True)

        # --- Tesseract fallback ---
        try:
            full_image = cv2.imread(image_path)
            if full_image is None:
                return []

            height, width = full_image.shape[:2]

            # Narrow left margin (15%) — question numbers are at the very left.
            # Wider crops include answer text which creates false positives.
            left_width = int(width * 0.15)

            # Process in vertical chunks (~2500px each for better OCR accuracy)
            chunk_height = 2500
            num_chunks = (height + chunk_height - 1) // chunk_height

            # Patterns: "1.", "2.", "10.", "Q1", "Q2", or bare "1", "2", "10"
            number_pattern = re.compile(r'^(\d{1,2})\.?[)\]]?$')
            q_pattern = re.compile(r'^[Qq]\.?(\d{1,2})\.?$')
            # Also match numbers with common OCR artifacts: "1)", "2]", etc.
            loose_pattern = re.compile(r'(\d{1,2})')

            detections = []  # (question_number, y_center_in_full_image, confidence)

            for chunk_idx in range(num_chunks):
                y_start = chunk_idx * chunk_height
                y_end = min(y_start + chunk_height, height)

                # Crop the left margin of this chunk
                chunk = full_image[y_start:y_end, 0:left_width]
                chunk_gray = cv2.cvtColor(chunk, cv2.COLOR_BGR2GRAY)

                # Remove ruled lines morphologically — this is the key step
                # that makes handwritten number detection work on lined paper
                clean = self._remove_ruled_lines(chunk_gray)
                chunk_pil = Image.fromarray(clean)

                # Run OCR with two PSM modes for robustness
                for psm in ['--psm 6', '--psm 11']:
                    ocr_data = pytesseract.image_to_data(
                        chunk_pil, output_type=pytesseract.Output.DICT,
                        config=psm
                    )

                    n_boxes = len(ocr_data['text'])
                    for i in range(n_boxes):
                        text = ocr_data['text'][i].strip()
                        conf = int(ocr_data['conf'][i])
                        if conf < 15 or not text:
                            continue

                        q_num = None
                        # Try strict patterns first (higher confidence)
                        m = number_pattern.match(text)
                        if m:
                            q_num = int(m.group(1))
                        else:
                            m = q_pattern.match(text)
                            if m:
                                q_num = int(m.group(1))
                            elif conf >= 40:
                                # For high-confidence detections, try loose match
                                m = loose_pattern.search(text)
                                if m and len(text) <= 3:
                                    q_num = int(m.group(1))

                        if q_num is not None and 1 <= q_num <= num_questions:
                            y_top = ocr_data['top'][i] + y_start
                            box_h = ocr_data['height'][i]
                            y_center = y_top + box_h // 2
                            detections.append((q_num, y_center, conf))

            if not detections:
                print("OCR detected 0 question numbers")
                return []

            # For each question number, keep the detection with highest confidence.
            # Group by question number, picking the best (topmost high-confidence) one.
            from collections import defaultdict
            by_qnum = defaultdict(list)
            for q_num, y_pos, conf in detections:
                by_qnum[q_num].append((y_pos, conf))

            seen = {}
            for q_num, positions in by_qnum.items():
                # Sort by confidence descending, then by y ascending (topmost)
                positions.sort(key=lambda x: (-x[1], x[0]))
                best_y, best_conf = positions[0]
                seen[q_num] = best_y

            result = sorted(seen.items(), key=lambda x: x[1])

            # Validate: question numbers should appear in roughly ascending order
            # Remove out-of-order detections (likely false positives)
            validated = []
            last_num = 0
            for q_num, y_pos in result:
                if q_num > last_num:
                    validated.append((q_num, y_pos))
                    last_num = q_num

            print(f"OCR detected {len(validated)} question numbers: "
                  f"{[q for q, _ in validated]} "
                  f"(raw: {len(detections)} detections, {len(result)} unique)")
            return validated

        except Exception as e:
            import traceback
            print(f"OCR question detection failed: {e}")
            traceback.print_exc()
            return []

    def _select_splits_for_page(self, gaps, page_start, page_end, num_splits, image_height):
        """
        Select the best N split points from candidate gaps within a single page region.

        For each expected split position, finds the best nearby gap using a score
        that balances proximity to ideal position with gap height. This avoids
        the clustering problem of pure tallest-first selection.

        Args:
            gaps: list of (gap_center_y, gap_height) candidates within this page
            page_start: y-coordinate where this page starts
            page_end: y-coordinate where this page ends
            num_splits: number of split points needed (questions_on_page - 1)
            image_height: total image height (for min-distance calculation)

        Returns:
            list of y-coordinates for split points, sorted ascending
        """
        if num_splits <= 0:
            return []

        page_h = page_end - page_start

        # Filter to gaps within this page region
        page_gaps = [(cy, ch) for cy, ch in gaps if page_start < cy < page_end]

        if not page_gaps:
            # No candidates — fall back to equal division within this page
            step = page_h / (num_splits + 1)
            return [int(page_start + step * (k + 1)) for k in range(num_splits)]

        gap_centers_arr = np.array([g[0] for g in page_gaps])
        gap_heights_arr = np.array([g[1] for g in page_gaps])

        # Normalize gap heights to [0, 1] for scoring
        max_gh = float(gap_heights_arr.max())
        min_gh = float(gap_heights_arr.min())
        if max_gh > min_gh:
            norm_heights = (gap_heights_arr - min_gh) / (max_gh - min_gh)
        else:
            norm_heights = np.ones_like(gap_heights_arr)

        ideal_step = page_h / (num_splits + 1)
        # Search window: look within 60% of the ideal step from each ideal position
        window = ideal_step * 0.6

        selected = []
        used = set()

        for k in range(1, num_splits + 1):
            ideal_y = page_start + k * ideal_step

            # Find gaps within the search window
            distances = np.abs(gap_centers_arr - ideal_y)
            in_window = distances < window

            # Exclude already-used gaps
            available = in_window.copy()
            for u in used:
                available[u] = False

            if not np.any(available):
                # No gap in window — use the ideal position directly
                selected.append(int(ideal_y))
                continue

            # Score = height_bonus - distance_penalty
            # Prefer tall gaps that are close to the ideal position
            dist_penalty = distances / window  # 0 at ideal, 1 at window edge
            height_bonus = norm_heights
            scores = np.full(len(page_gaps), -np.inf)
            scores[available] = height_bonus[available] - dist_penalty[available] * 0.5

            best_idx = int(np.argmax(scores))
            used.add(best_idx)
            selected.append(int(gap_centers_arr[best_idx]))

        selected.sort()
        return selected

    def extract_question_sections(self, image_path, num_questions, page_heights=None):
        """
        Extract individual question sections from a full answer sheet.

        Strategy (layered):
        1. Try OCR-based detection — find question number labels and split
           at those positions, snapped to the nearest whitespace gap.
        2. If OCR doesn't find enough questions, use page-aware gap
           classification: classify gaps by median-based thresholding,
           then select tallest gaps per page as split points.
        3. Last resort: equal-height splitting.

        Args:
            image_path: Path to the full answer sheet image
            num_questions: Number of questions in the test
            page_heights: List of individual page heights (from PDF conversion).
                          None for single-page images.

        Returns:
            list: List of image arrays for each question section
        """
        try:
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError("Could not read image")

            height, width = image.shape[:2]
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # Minimum gap height scales with image size
            min_gap = max(20, height // 200)
            gaps = self._find_whitespace_gaps(gray, min_gap_height=min_gap)
            gap_centers = np.array([g[0] for g in gaps]) if gaps else np.array([])

            needed = num_questions - 1

            # --- Strategy 1: OCR-based question detection ---
            ocr_questions = self._detect_question_numbers(image_path, num_questions)

            # Accept if we detected at least 75% of questions (with
            # interpolation the list may already be complete).
            if len(ocr_questions) >= num_questions * 0.75:
                # Split just above each question label, snapped to nearest
                # whitespace gap if one is very close (within 300px).
                snap_tolerance = 300

                # Build split points from detected positions.
                # Use the first N questions matching num_questions.
                # Sort by y-position to ensure correct order.
                sorted_questions = sorted(ocr_questions, key=lambda x: x[1])[:num_questions]

                split_points = [0]
                for idx in range(1, len(sorted_questions)):
                    q_num, q_y = sorted_questions[idx]
                    # The split should be above the question label
                    target_y = q_y - 50

                    if len(gap_centers) > 0:
                        # Only look at gaps that are ABOVE the question label
                        above_mask = gap_centers < q_y
                        if np.any(above_mask):
                            above_centers = gap_centers[above_mask]
                            distances = np.abs(above_centers - target_y)
                            best_local = int(np.argmin(distances))
                            if distances[best_local] < snap_tolerance:
                                target_y = int(above_centers[best_local])

                    split_points.append(max(0, min(target_y, height - 1)))
                split_points.append(height)

                print(f"Using OCR-based splitting with {len(split_points)-1} sections "
                      f"(detected {len(ocr_questions)} of {num_questions} questions)",
                      flush=True)

            elif len(gaps) >= needed:
                # --- Strategy 2: Page-aware gap classification ---
                print(f"OCR found {len(ocr_questions)} questions (need {num_questions}), "
                      f"using page-aware gap classification ({len(gaps)} raw gaps)",
                      flush=True)

                # Determine page boundaries from PDF page heights
                page_boundaries = []
                if page_heights and len(page_heights) > 1:
                    cumulative = 0
                    for ph in page_heights[:-1]:
                        cumulative += ph
                        page_boundaries.append(cumulative)
                    print(f"Page boundaries at y={page_boundaries}")

                # Classify gaps with progressive threshold — request enough candidates
                candidates = self._classify_gaps(
                    gaps, height, page_boundaries, min_candidates=needed
                )

                # Define page regions for independent processing
                if page_boundaries:
                    page_regions = []
                    prev = 0
                    for pb in page_boundaries:
                        page_regions.append((prev, pb))
                        prev = pb
                    page_regions.append((prev, height))

                    # Distribute questions by counting candidates per page
                    # More candidates on a page = more questions there
                    candidates_per_page = []
                    for ps, pe in page_regions:
                        count = sum(1 for cy, _ in candidates if ps < cy < pe)
                        candidates_per_page.append(count)

                    total_candidates = sum(candidates_per_page)
                    questions_per_page = []
                    remaining_q = num_questions

                    if total_candidates > 0:
                        for i, count in enumerate(candidates_per_page):
                            if i == len(page_regions) - 1:
                                questions_per_page.append(remaining_q)
                            else:
                                # Each candidate implies a boundary between 2 questions,
                                # so candidates + 1 ≈ questions on that page
                                q_count = max(1, round(
                                    num_questions * (count + 1) /
                                    (total_candidates + len(page_regions))
                                ))
                                q_count = min(q_count, remaining_q - (len(page_regions) - 1 - i))
                                questions_per_page.append(q_count)
                                remaining_q -= q_count
                    else:
                        # No candidates at all — distribute proportionally by height
                        total_page_h = sum(r[1] - r[0] for r in page_regions)
                        for i, (ps, pe) in enumerate(page_regions):
                            if i == len(page_regions) - 1:
                                questions_per_page.append(remaining_q)
                            else:
                                page_frac = (pe - ps) / total_page_h
                                q_count = max(1, round(num_questions * page_frac))
                                q_count = min(q_count, remaining_q - (len(page_regions) - 1 - i))
                                questions_per_page.append(q_count)
                                remaining_q -= q_count

                    print(f"Candidates per page: {candidates_per_page}, "
                          f"Questions per page: {questions_per_page}")

                    # Select splits independently per page
                    all_splits = []
                    for i, (ps, pe) in enumerate(page_regions):
                        n_splits = questions_per_page[i] - 1
                        page_splits = self._select_splits_for_page(
                            candidates, ps, pe, n_splits, height
                        )
                        all_splits.extend(page_splits)

                    # Add page boundaries as split points (between pages = between questions)
                    for pb in page_boundaries:
                        if not any(abs(pb - s) < height * 0.01 for s in all_splits):
                            all_splits.append(pb)

                    all_splits.sort()
                    split_points = [0] + all_splits + [height]
                else:
                    # Single page (or no page info): select tallest N-1 gaps
                    selected = self._select_splits_for_page(
                        candidates, 0, height, needed, height
                    )
                    split_points = [0] + selected + [height]

                # --- Post-processing: subdivide oversized sections ---
                # If any section is much larger than expected, it likely
                # contains multiple questions that weren't split
                avg_section = height / num_questions
                max_section = avg_section * 1.8
                refined = [split_points[0]]
                for i in range(len(split_points) - 1):
                    section_h = split_points[i + 1] - split_points[i]
                    if section_h > max_section:
                        # Subdivide: find gaps inside this section
                        sub_count = max(1, round(section_h / avg_section))
                        if sub_count > 1:
                            section_gaps = [
                                (cy, ch) for cy, ch in gaps
                                if split_points[i] + 50 < cy < split_points[i + 1] - 50
                            ]
                            sub_splits = self._select_splits_for_page(
                                section_gaps, split_points[i], split_points[i + 1],
                                sub_count - 1, height
                            )
                            for s in sub_splits:
                                refined.append(s)
                    refined.append(split_points[i + 1])

                if len(refined) != len(split_points):
                    print(f"Post-processing: refined {len(split_points)} -> {len(refined)} points")
                    split_points = sorted(set(refined))

                print(f"Strategy 2 final split points ({len(split_points)-1} sections): "
                      f"{split_points}")

            else:
                # --- Strategy 3: Equal division ---
                print(f"Whitespace detection found {len(gaps)} gaps, "
                      f"need {needed}. Falling back to equal split.")
                section_height = height // num_questions
                split_points = [i * section_height for i in range(num_questions)] + [height]

            # Extract sections with vertical padding so answers aren't clipped.
            # Padding = 15% of average section height, clamped to image bounds.
            avg_section_h = height / max(num_questions, 1)
            pad = int(avg_section_h * 0.15)

            question_images = []
            for i in range(len(split_points) - 1):
                start_y = max(0, split_points[i] - pad)
                end_y = min(height, split_points[i + 1] + pad)
                if end_y - start_y < 10:
                    continue
                section = image[start_y:end_y, 0:width]
                question_images.append(section)

            return question_images

        except Exception as e:
            print(f"Error extracting question sections: {e}")
            return []

    def extract_question_sections_advanced(self, image_path, num_questions):
        """
        Advanced extraction using line detection and text analysis

        Args:
            image_path: Path to the full answer sheet image
            num_questions: Number of questions in the test

        Returns:
            list: List of image arrays for each question section
        """
        try:
            # Read image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError("Could not read image")

            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # Apply edge detection
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)

            # Detect horizontal lines (potential question separators)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100,
                                   minLineLength=image.shape[1] * 0.5,
                                   maxLineGap=20)

            # Find horizontal line positions
            line_positions = []
            if lines is not None:
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    # Only consider nearly horizontal lines
                    if abs(y2 - y1) < 10:
                        line_positions.append(y1)

            # Sort and filter line positions
            line_positions = sorted(set(line_positions))

            # If we found enough separator lines, use them
            if len(line_positions) >= num_questions - 1:
                # Use detected lines as boundaries
                split_points = [0] + line_positions[:num_questions-1] + [image.shape[0]]
            else:
                # Fall back to simple division
                height = image.shape[0]
                section_height = height // num_questions
                split_points = [i * section_height for i in range(num_questions + 1)]

            # Extract sections with vertical padding
            img_h = image.shape[0]
            avg_section_h = img_h / max(num_questions, 1)
            pad = int(avg_section_h * 0.15)

            question_images = []
            for i in range(len(split_points) - 1):
                start_y = max(0, split_points[i] - pad)
                end_y = min(img_h, split_points[i + 1] + pad)
                section = image[start_y:end_y, :]
                question_images.append(section)

            return question_images

        except Exception as e:
            print(f"Error in advanced extraction: {e}")
            # Fall back to simple method
            return self.extract_question_sections(image_path, num_questions)

    def save_image_section(self, image_array, output_path):
        """
        Save an image section to file

        Args:
            image_array: NumPy array containing image data
            output_path: Path where to save the image
        """
        try:
            cv2.imwrite(output_path, image_array)
            return True
        except Exception as e:
            print(f"Error saving image section: {e}")
            return False

    def convert_pdf_to_image(self, pdf_path):
        """
        Convert all pages of a PDF into a single stitched image.

        Args:
            pdf_path: Path to PDF file

        Returns:
            tuple: (image_path, page_heights) where image_path is the path to
                   the stitched image and page_heights is a list of individual
                   page heights in pixels. Returns (None, []) on failure.
        """
        try:
            # Convert every PDF page to a PIL image at 300 DPI
            pages = convert_from_path(pdf_path, dpi=300)

            if not pages:
                raise ValueError("No pages found in PDF")

            page_heights = [page.height for page in pages]

            if len(pages) == 1:
                # Single page — save directly
                temp_image = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
                pages[0].save(temp_image.name, 'JPEG', quality=95)
                return temp_image.name, page_heights

            # Multi-page — stitch all pages vertically into one tall image
            max_width = max(page.width for page in pages)
            total_height = sum(page.height for page in pages)

            stitched = Image.new('RGB', (max_width, total_height), 'white')
            y_offset = 0
            for page in pages:
                # Center narrower pages horizontally
                x_offset = (max_width - page.width) // 2
                stitched.paste(page, (x_offset, y_offset))
                y_offset += page.height

            temp_image = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            stitched.save(temp_image.name, 'JPEG', quality=95)
            print(f"Stitched {len(pages)} PDF pages into one image "
                  f"({max_width}x{total_height}px)")
            return temp_image.name, page_heights

        except ImportError as e:
            print(f"Error: pdf2image not properly installed: {e}")
            return None, []
        except Exception as e:
            error_msg = str(e)
            if 'poppler' in error_msg.lower() or 'pdftoppm' in error_msg.lower():
                print(f"Error: Poppler not installed. Please install poppler-utils.")
                print(f"  macOS: brew install poppler")
                print(f"  Ubuntu: sudo apt-get install poppler-utils")
            else:
                print(f"Error converting PDF to image: {e}")
            return None, []

    def is_pdf(self, file_path):
        """
        Check if file is a PDF

        Args:
            file_path: Path to file

        Returns:
            bool: True if file is PDF
        """
        return file_path.lower().endswith('.pdf')

    def process_answer_sheet(self, file_path, num_questions, use_advanced=False):
        """
        Complete processing pipeline for an answer sheet (supports images and PDFs)

        Args:
            file_path: Path to the full answer sheet (image or PDF)
            num_questions: Number of questions to extract
            use_advanced: Whether to use advanced extraction (default: False)

        Returns:
            dict: Processing results with quality info and question images
        """
        # Convert PDF to image if needed
        page_heights = None
        if self.is_pdf(file_path):
            print(f"Converting PDF to image: {file_path}")
            image_path, page_heights = self.convert_pdf_to_image(file_path)
            if not image_path:
                return {
                    'quality_score': 0.0,
                    'confidence_level': 'low',
                    'ocr_text': '',
                    'question_images': [],
                    'num_sections_extracted': 0,
                    'error': 'Failed to convert PDF'
                }
            cleanup_image = True
        else:
            image_path = file_path
            cleanup_image = False

        try:
            # Analyze overall image quality
            quality_score, confidence_level, ocr_text = self.analyze_image_quality(image_path)

            # Extract question sections
            if use_advanced:
                question_images = self.extract_question_sections_advanced(image_path, num_questions)
            else:
                question_images = self.extract_question_sections(
                    image_path, num_questions, page_heights=page_heights
                )

            return {
                'quality_score': quality_score,
                'confidence_level': confidence_level,
                'ocr_text': ocr_text[:500],  # Limit OCR text length
                'question_images': question_images,
                'num_sections_extracted': len(question_images)
            }

        finally:
            # Clean up temporary image file if created from PDF
            if cleanup_image and image_path and os.path.exists(image_path):
                try:
                    os.remove(image_path)
                except:
                    pass
