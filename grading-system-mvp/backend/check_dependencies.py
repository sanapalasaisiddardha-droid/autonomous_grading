#!/usr/bin/env python
"""
Check if all dependencies are properly installed
"""
import sys

def check_poppler():
    """Check if poppler is installed"""
    try:
        from pdf2image import convert_from_path
        import tempfile

        # Try to import and check if poppler is available
        print("✓ pdf2image is installed")

        # Try a simple conversion test
        try:
            # This will fail if poppler is not installed
            import subprocess
            result = subprocess.run(['pdftoppm', '-v'], capture_output=True, text=True)
            if result.returncode == 0 or 'poppler' in result.stdout.lower() or 'poppler' in result.stderr.lower():
                print("✓ Poppler is installed and working")
                return True
            else:
                print("✗ Poppler might not be installed correctly")
                return False
        except FileNotFoundError:
            print("✗ Poppler is NOT installed")
            print("\n📦 Install Instructions:")
            print("  macOS:    brew install poppler")
            print("  Ubuntu:   sudo apt-get install poppler-utils")
            print("  Windows:  Download from https://github.com/oschwartz10612/poppler-windows/releases")
            return False

    except ImportError:
        print("✗ pdf2image is not installed")
        print("  Run: pip install pdf2image")
        return False

def check_opencv():
    """Check if OpenCV is installed"""
    try:
        import cv2
        print(f"✓ OpenCV is installed (version {cv2.__version__})")
        return True
    except ImportError:
        print("✗ OpenCV is not installed")
        print("  Run: pip install opencv-python")
        return False

def check_vision_api():
    """Check if Google Vision API is set up"""
    import os
    from pathlib import Path

    try:
        from google.cloud import vision
        print("✓ google-cloud-vision is installed")

        # Check if credentials file exists
        base_dir = Path(__file__).resolve().parent
        creds_path = base_dir / 'credentials' / 'google-cloud-vision-credentials.json'

        if creds_path.exists():
            print(f"✓ Credentials file found at: {creds_path}")
            return True
        else:
            print(f"⚠ Credentials file not found at: {creds_path}")
            print("  Vision API will use mock data")
            return True

    except ImportError:
        print("✗ google-cloud-vision is not installed")
        print("  Run: pip install google-cloud-vision")
        return False

def main():
    print("=" * 60)
    print("Checking Dependencies for Grading System")
    print("=" * 60)
    print()

    all_ok = True

    print("1. Checking PDF Processing:")
    if not check_poppler():
        all_ok = False
    print()

    print("2. Checking Image Processing:")
    if not check_opencv():
        all_ok = False
    print()

    print("3. Checking Vision API:")
    if not check_vision_api():
        all_ok = False
    print()

    print("=" * 60)
    if all_ok:
        print("✓ All dependencies are installed correctly!")
    else:
        print("⚠ Some dependencies are missing. Please install them.")
    print("=" * 60)

    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(main())
