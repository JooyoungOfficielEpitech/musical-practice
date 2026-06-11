"""Preprocessing strategies for OMR input images."""

import numpy as np
import cv2


def preprocess_original(img: np.ndarray) -> np.ndarray:
    """No preprocessing — use raw image."""
    return img


def preprocess_otsu(img: np.ndarray) -> np.ndarray:
    """Otsu thresholding."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def preprocess_adaptive(img: np.ndarray) -> np.ndarray:
    """Adaptive Gaussian thresholding."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 10)


def preprocess_high_contrast(img: np.ndarray) -> np.ndarray:
    """CLAHE (Contrast Limited Adaptive Histogram Equalization) + Otsu."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def preprocess_denoise(img: np.ndarray) -> np.ndarray:
    """Non-local means denoising + Otsu."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    denoised = cv2.fastNlMeansDenoising(gray, h=12)
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def preprocess_deskew(img: np.ndarray) -> np.ndarray:
    """Detect skew via Hough line detection and rotate."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=100, maxLineGap=10)
    if lines is None or len(lines) < 5:
        return img
    angles = [
        np.degrees(np.arctan2(line[0][3] - line[0][1], line[0][2] - line[0][0]))
        for line in lines
        if abs(np.degrees(np.arctan2(line[0][3] - line[0][1], line[0][2] - line[0][0]))) < 10
    ]
    if not angles:
        return img
    median_angle = np.median(angles)
    if abs(median_angle) < 0.3:
        return img
    h, w = gray.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), median_angle, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def preprocess_sharpen(img: np.ndarray) -> np.ndarray:
    """Unsharp mask + Otsu."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    _, binary = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def preprocess_scale15(img: np.ndarray) -> np.ndarray:
    """Upscale 1.5× (cubic) — recovers chord noteheads homr misses on small
    staff crops. Do NOT raise to 2×: homr output collapses on larger inputs
    (sweep 2026-06-11: scale2 dropped to 2 pitched notes on p13).
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    return cv2.resize(gray, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)


STRATEGIES = [
    ("original", preprocess_original),
    ("otsu", preprocess_otsu),
    ("adaptive", preprocess_adaptive),
    ("high_contrast", preprocess_high_contrast),
    ("denoise", preprocess_denoise),
    ("deskew", preprocess_deskew),
    ("sharpen", preprocess_sharpen),
    ("scale1.5", preprocess_scale15),
]
