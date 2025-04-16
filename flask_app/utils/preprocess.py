import pydicom
import cv2
import numpy as np
import nibabel as nib
from torchvision import transforms

def preprocess_dicom(dicom_path):
    dcm = pydicom.read_file(dicom_path).pixel_array / 255.0
    img = cv2.resize(dcm, (224, 224)).astype(np.float32)
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize([0.49], [0.248])
    ])
    tensor_img = transform(img)
    return tensor_img

def normalize_volume(volume):
    """Z-Normalization of the whole volume"""
    mu = volume.mean()
    std = np.std(volume)
    # Prevent division by zero if standard deviation is very small
    if std < 1e-5:
        # Return a volume of zeros or handle as appropriate for constant input
        return np.zeros_like(volume, dtype=np.float32)
    return (volume - mu) / std

def standardize_volume(normalized):
    """Standardize the normalized data into 0-1 range"""
    min_val = np.nanmin(normalized) # Use nanmin/nanmax to handle potential NaNs
    max_val = np.nanmax(normalized)
    # Prevent division by zero if the range is zero (constant image)
    if max_val - min_val < 1e-5:
        return np.zeros_like(normalized, dtype=np.float32)
    
    # Clip values to prevent potential issues with extreme outliers if any
    normalized = np.clip(normalized, min_val, max_val)
    
    return (normalized - min_val) / (max_val - min_val)
