# DICOM Medical Image Viewer and Analysis

A web-based DICOM viewer with integrated AI analysis capabilities for medical imaging. The project consists of two main components:

1. A web-based DICOM viewer (frontend)
2. A Flask-based AI analysis server (backend)

## Features

- DICOM image viewing with standard medical imaging tools
- Pneumonia detection with probability estimation
- Cardiac chamber analysis
- Interactive viewport controls (pan, zoom, window/level)
- Drag-and-drop DICOM file loading

## Project Structure

```
project/
├── dicom-viewer/        # Frontend application
│   ├── src/            # Source code
│   ├── public/         # Static assets
│   └── package.json    # Dependencies
└── flask_app/          # Backend server
    ├── models/         # AI models
    ├── routes/         # API endpoints
    ├── utils/          # Helper functions
    └── requirements.txt
```

## Setup

### Frontend (DICOM Viewer)

1. Install dependencies:
```bash
cd dicom-viewer
npm install
```

2. Start development server:
```bash
npm run dev
```

### Backend (Flask Server)

1. Create and activate virtual environment:
```bash
cd flask_app
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Start the Flask server:
```bash
python app.py
```

## Usage

1. Open http://localhost:3000 in your browser
2. Load a DICOM file using drag-and-drop or file selector
3. Use the processing buttons to analyze images:
   - "Process Pneumonia" for pneumonia detection
   - "Process Cardiac" for cardiac chamber analysis

## Development

- Frontend built with TypeScript and Cornerstone.js
- Backend uses Flask and PyTorch
- AI models: ResNet18-based architectures for both pneumonia and cardiac analysis

## License

[Add your chosen license here]
