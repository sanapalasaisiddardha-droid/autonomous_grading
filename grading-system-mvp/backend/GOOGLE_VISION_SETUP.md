# Google Cloud Vision API Setup

This guide explains how to set up Google Cloud Vision API for automatic answer sheet processing.

## Prerequisites

You need a Google Cloud Vision API credentials JSON file. If you don't have one:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Vision API
4. Create a service account and download the JSON key file

## Installation Steps

### 1. Place Your Credentials File

Copy your Google Cloud Vision API credentials JSON file to:
```
backend/credentials/google-cloud-vision-credentials.json
```

**Important:** Make sure the filename is exactly `google-cloud-vision-credentials.json`

### 2. Verify Setup

The credentials directory structure should look like:
```
backend/
├── credentials/
│   └── google-cloud-vision-credentials.json
├── apps/
├── config/
└── manage.py
```

### 3. Test the Setup

Run the Django server and upload an answer sheet. The system will automatically:
- Analyze image quality using Vision API
- Extract individual question sections from the full answer sheet
- Save each question as a separate image
- Store quality metrics (quality_score, confidence_level)

## How It Works

### Image Processing Pipeline

1. **Upload**: Teacher uploads a full answer sheet (e.g., `101.jpg`)
2. **Quality Analysis**: Vision API analyzes image quality and extracts text
3. **Section Extraction**: OpenCV divides the image into question sections
4. **Storage**: Each question section is saved as a separate image
5. **Grading**: Teachers can grade each question anonymously

### Extraction Methods

#### Simple Method (Current Default)
- Divides image into equal vertical sections
- Fast and reliable
- Works well for consistently formatted answer sheets

#### Advanced Method (Optional)
- Uses edge detection to find question boundaries
- Detects horizontal separator lines
- More accurate for varied layouts
- Can be enabled by setting `use_advanced=True` in views.py

## Configuration

### Switching to Advanced Extraction

In `apps/uploads/views.py`, line ~75, change:
```python
result = processor.process_answer_sheet(
    temp_path,
    num_questions=len(questions),
    use_advanced=True  # Enable advanced extraction
)
```

### Adjusting Quality Thresholds

In `apps/uploads/image_processor.py`, modify the `_calculate_quality_score` method to adjust quality scoring logic.

## Troubleshooting

### Credentials Not Found
**Error:** "Warning: Google Cloud Vision credentials not found"

**Solution:**
- Verify the credentials file is in the correct location
- Check the filename matches exactly: `google-cloud-vision-credentials.json`
- Ensure the file has valid JSON format

### Vision API Not Working
**Error:** API calls failing or returning errors

**Solution:**
- Verify the Vision API is enabled in your Google Cloud project
- Check that your service account has proper permissions
- Ensure you're not exceeding API quotas

### Image Extraction Issues
**Problem:** Question sections not extracted correctly

**Solutions:**
- Try enabling advanced extraction method
- Adjust the number of questions in the test
- Ensure answer sheets have consistent formatting
- Check that images are clear and well-lit

### Low Quality Scores
**Problem:** Images marked as low quality

**Solutions:**
- Ensure original images are high resolution (at least 1200px height)
- Use good lighting when scanning/photographing answer sheets
- Avoid shadows and glare
- Keep answer sheets flat and properly aligned

## API Costs

Google Cloud Vision API pricing (as of 2026):
- First 1,000 requests/month: FREE
- Additional requests: ~$1.50 per 1,000 images

For typical usage (30 students × 5 tests/month = 150 images), you'll likely stay within the free tier.

## Security Best Practices

1. **Never commit credentials to git:**
   - The `credentials/` directory is in `.gitignore`
   - Always keep credentials secure and private

2. **Restrict API key permissions:**
   - Limit service account to Vision API only
   - Set up API key restrictions in Google Cloud Console

3. **Monitor API usage:**
   - Check Google Cloud Console regularly
   - Set up billing alerts to avoid unexpected charges

## Future Enhancements

Potential improvements for image processing:

1. **Machine Learning-based Extraction**
   - Train a model to detect question boundaries
   - Handle varied answer sheet formats
   - Detect handwriting regions automatically

2. **Quality Improvements**
   - Auto-rotate misaligned images
   - Enhance low-quality scans
   - Remove backgrounds and shadows

3. **Answer Validation**
   - Detect if student answered all questions
   - Flag blank or incomplete answers
   - Warn about illegible handwriting

4. **Batch Processing**
   - Process multiple students' sheets at once
   - Parallel processing for faster uploads
   - Progress tracking for large batches

## Support

If you encounter issues:
1. Check the Django server logs for error messages
2. Verify your Google Cloud project settings
3. Test with a small, clear sample image first
4. Review the troubleshooting section above

For more information:
- [Google Cloud Vision Documentation](https://cloud.google.com/vision/docs)
- [OpenCV Documentation](https://docs.opencv.org/)
