# Medical Imaging AI Platform

A comprehensive platform for medical image analysis using deep learning, supporting DICOM and NIfTI formats with multiple AI models for classification, detection, and segmentation.

## Overview

This platform consists of two main components:

1.  **Flask Backend (`backend/`)**: Provides API endpoints for AI inference, including pneumonia classification, cardiac chamber detection, and left atrium segmentation.
2.  **TypeScript Frontend (`frontend/`)**: A web application built with TypeScript and Cornerstone.js for viewing and analyzing medical images with integrated AI capabilities.

## Features

-   **Multi-model AI Analysis**
    -   Pneumonia Classification with Class Activation Map (CAM) visualization
    -   Cardiac Chamber Detection with bounding box visualization
    -   Left Atrium Segmentation for 3D NIfTI volumes
-   **Medical Image Support**
    -   DICOM format (e.g., X-rays)
    -   NIfTI format (e.g., MRI volumes)
-   **Interactive Visualization**
    -   Heatmap overlays for classification results
    -   Bounding box visualization for detection models
    -   Segmented slice display for volumetric data

## Directory Structure

```
.
├── backend/            # Flask API and AI models
│   ├── app.py          # Main Flask application
│   ├── requirements.txt # Backend dependencies
│   ├── models/         # Model definitions
│   ├── routes/         # API route handlers
│   ├── utils/          # Helper functions (preprocessing, loading)
│   └── weights/        # Pre-trained model weights (required)
├── frontend/           # TypeScript/Cornerstone.js DICOM viewer
│   ├── package.json    # Frontend dependencies
│   ├── tsconfig.json   # TypeScript configuration
│   ├── webpack.config.js # Webpack configuration
│   ├── public/         # Static assets (HTML, CSS)
│   └── src/            # Frontend source code
└── README.md           # This file
```

## Backend Setup (Flask)

### Prerequisites

-   Python 3.8+
-   `pip` and `venv`
-   CUDA-compatible GPU (recommended for faster inference)

### Installation

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Model Weights**: Ensure the pre-trained model weights are placed in the `backend/weights/` directory:
    -   `pneumonia_weights.ckpt`
    -   `cardiac_weights.ckpt`
    -   `atrium_weights.ckpt`
    *(Note: Weights are not included in the repository and must be obtained separately)*

### Running the Backend

1.  Ensure you are in the `backend/` directory with the virtual environment activated.
2.  Start the Flask server:
    ```bash
    python app.py
    ```
    The server will typically be available at `http://localhost:5000`.

## Frontend Setup (TypeScript/Cornerstone.js)

### Prerequisites

-   Node.js 16+
-   npm (or yarn)

### Installation

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    # yarn install
    ```

### Running the Frontend

1.  Ensure you are in the `frontend/` directory.
2.  Start the development server:
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
    The application will typically be available at `http://localhost:3000`.

## API Endpoints

The backend exposes the following API endpoints (running on `http://localhost:5000` by default):

### Pneumonia Classification (CAM)

-   **Endpoint**: `POST /predict_cam/pneumonia`
-   **Request**: Form data with a DICOM file under the key `dicom`.
-   **Response**: A PNG image overlaying the Class Activation Map (heatmap) onto the original X-ray.
-   **Headers**: The response includes an `X-Probability` header containing the model's predicted probability of pneumonia.

### Cardiac Chamber Detection

-   **Endpoint**: `POST /predict_cardiac/cardiac`
-   **Request**: Form data with a DICOM file under the key `dicom`.
-   **Response**: A PNG image with a bounding box drawn around the detected cardiac chamber region.

### Left Atrium Segmentation

-   **Endpoint**: `POST /segment_atrium`
-   **Request**: Form data with a NIfTI file (`.nii` or `.nii.gz`) under the key `nifti`.
-   **Response**: A ZIP file (`segmented_slices.zip`) containing PNG images for each slice of the volume, with the segmented left atrium overlaid in red.

## Technologies Used

### Backend

-   **Flask**: Web framework
-   **PyTorch**: Deep learning framework
-   **Pydicom**: DICOM file handling
-   **Nibabel**: NIfTI file handling
-   **OpenCV-Python**: Image processing and visualization
-   **Flask-Cors**: Handling Cross-Origin Resource Sharing

### Frontend

-   **TypeScript**: Programming language
-   **Cornerstone.js**: Medical imaging viewer core library
-   **@cornerstonejs/dicom-image-loader**: DICOM loading for Cornerstone
-   **@cornerstonejs/nifti-volume-loader**: NIfTI loading for Cornerstone
-   **@cornerstonejs/tools**: Annotation and interaction tools
-   **Webpack**: Module bundler and development server

## License

This project is licensed under the ISC License.

## Acknowledgments

This platform utilizes several open-source libraries, including:
-   Cornerstone.js
-   Flask
-   PyTorch