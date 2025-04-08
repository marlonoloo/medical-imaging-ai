import pydicom
import cv2
import numpy as np
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
