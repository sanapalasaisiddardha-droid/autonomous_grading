#!/usr/bin/env python
"""
Quick test to verify Google Cloud Vision API credentials
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.uploads.image_processor import ImageProcessor

def test_vision_api():
    print("Testing Google Cloud Vision API setup...")
    print("-" * 50)

    # Initialize processor
    processor = ImageProcessor()

    if processor.client is None:
        print("❌ ERROR: Vision API client not initialized")
        print("   Check credentials file location and format")
        return False

    print("✓ Vision API client initialized successfully")
    print("✓ Credentials file loaded")
    print("\nImage processor ready to use!")
    print("\nCapabilities:")
    print("  - Image quality analysis")
    print("  - OCR text extraction")
    print("  - Question section extraction (simple)")
    print("  - Question section extraction (advanced)")

    return True

if __name__ == "__main__":
    success = test_vision_api()
    exit(0 if success else 1)
