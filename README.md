# Medical Imaging AI Platform

A comprehensive platform for medical image analysis using deep learning, supporting DICOM and NIfTI formats with multiple AI models for classification, detection, and segmentation.

## Overview

This platform consists of two main components:

1. **Flask Backend (`flask_app`)**: Provides API endpoints for AI inference, including pneumonia classification, cardiac chamber detection, and left atrium segmentation.

2. **DICOM Viewer Frontend (`dicom-viewer`)**: A modern web application built with TypeScript and Cornerstone.js for viewing and analyzing medical images with integrated AI capabilities.

## Features

- **Multi-model AI Analysis**
  - Pneumonia Classification with CAM visualization
  - Cardiac Chamber Detection with bounding box visualization
  - Left Atrium Segmentation for 3D volumes

- **Medical Image Support**
  - DICOM format for X-rays and CT scans
  - NIfTI format for volumetric data

- **Interactive Visualization**
  - Heatmap overlays for classification results
  - Bounding box visualization for detection models
  - Volume segmentation with slice-by-slice display

## Backend Setup (Flask)

### Prerequisites

- Python 3.8+
- CUDA-compatible GPU (recommended for inference)

### Installation

1. Navigate to the Flask application directory:
   ```
   cd flask_app
   ```

2. Create and activate a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Set up model weights:
   Ensure the pre-trained model weights are placed in the `flask_app/weights/` directory:
   - `pneumonia_weights.ckpt`
   - `cardiac_weights.ckpt`
   - `atrium_weights.ckpt`

### Running the Backend

Start the Flask server:
```
python app.py
```

The server will be available at `http://localhost:5000`

## Frontend Setup (DICOM Viewer)

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Navigate to the DICOM viewer directory:
   ```
   cd dicom-viewer
   ```

2. Install dependencies:
   ```
   npm install
   # or
   yarn install
   ```

### Running the Frontend

Start the development server:
```
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000`

## API Endpoints

### Pneumonia Classification

```
POST /predict_cam/pneumonia
```
- Request: Form data with DICOM file (`dicom` field)
- Response: PNG image with CAM overlay
- Headers: `X-Probability` contains the classification probability

### Cardiac Chamber Detection

```
POST /predict_cardiac/cardiac
```
- Request: Form data with DICOM file (`dicom` field)
- Response: PNG image with bounding box overlay

### Left Atrium Segmentation

```
POST /segment_atrium
```
- Request: Form data with NIfTI file (`nifti` field)
- Response: ZIP file containing segmented slice PNGs

## Technical Details

### Backend Technologies

- **Flask**: Web framework for API endpoints
- **PyTorch**: Deep learning framework for AI models
- **OpenCV**: Image processing for visualization
- **Pydicom/Nibabel**: Medical image format handling

### Frontend Technologies

- **TypeScript**: For type-safe code development
- **Cornerstone.js**: Medical imaging viewer
- **Webpack**: Module bundling and development server

## License

This project is licensed under the ISC License.

## Acknowledgments

This platform uses the following open-source libraries:
- Cornerstone.js for medical image viewing
- Flask for the backend API
- PyTorch for deep learning models 