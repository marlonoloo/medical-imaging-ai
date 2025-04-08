from flask import Blueprint, request, jsonify, send_file, make_response
from flask_cors import CORS  # You'll need to install flask-cors
import os
import io
import torch
import cv2
import numpy as np
import pydicom
from utils.preprocess import preprocess_dicom
from utils.cam import compute_cam
from utils.model_loader import load_model

predict_bp = Blueprint('predict_bp', __name__)
CORS(predict_bp)  # Enable CORS for all routes in this blueprint
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

# Load the pneumonia CAM model. Ensure you're using the CAM version.
models = {}
models["pneumonia"] = load_model("pneumonia", "weights/pneumonia_weights.ckpt", device, model_type="cam")

# Add cardiac model to models dict
models["cardiac"] = load_model("cardiac", "weights/cardiac_weights.ckpt", device)

@predict_bp.route('/predict_cam/<model_name>', methods=['POST'])
def predict_cam_endpoint(model_name):
    if model_name not in models:
        return jsonify({"error": "Unknown model requested."}), 400
    if 'dicom' not in request.files:
        return jsonify({"error": "No file provided."}), 400
    
    file = request.files['dicom']
    temp_path = "temp.dcm"
    file.save(temp_path)
    
    try:
        # Preprocess the DICOM for model input (224x224 tensor)
        input_tensor = preprocess_dicom(temp_path)
        # Compute the CAM and get the prediction probability
        cam, pred_prob = compute_cam(models[model_name], input_tensor)
        
        # Load the original DICOM image for visualization
        ds = pydicom.read_file(temp_path)
        raw_img = ds.pixel_array.astype(np.float32)
        # Normalize the raw image between 0 and 1
        raw_img_norm = (raw_img - raw_img.min()) / (raw_img.max() - raw_img.min())
        # Resize the raw image to 1024x1024
        raw_img_1024 = cv2.resize(raw_img_norm, (1024, 1024))
        raw_img_1024 = (raw_img_1024 * 255).astype(np.uint8)
        
        # Resize the computed CAM (7x7) to 1024x1024
        cam_resized = cv2.resize(cam.cpu().numpy(), (1024, 1024))
        # Convert the CAM to a heatmap using a colormap
        heatmap = cv2.applyColorMap((cam_resized * 255).astype(np.uint8), cv2.COLORMAP_JET)
        
        # Convert the raw image to 3 channels
        raw_img_color = cv2.cvtColor(raw_img_1024, cv2.COLOR_GRAY2BGR)
        # Overlay the heatmap on the raw image (without adding any text)
        overlay = cv2.addWeighted(raw_img_color, 0.5, heatmap, 0.5, 0)
        
        # Encode the overlay image as PNG
        _, img_encoded = cv2.imencode('.png', overlay)
        # Create response with CORS headers
        response = make_response(send_file(io.BytesIO(img_encoded.tobytes()), mimetype='image/png'))
        response.headers["X-Probability"] = str(float(pred_prob.item()))  # Convert to float string
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'POST'
        response.headers['Access-Control-Expose-Headers'] = 'X-Probability'  # Add this line
        
        os.remove(temp_path)
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@predict_bp.route('/predict_cardiac/<model_name>', methods=['POST'])
def predict_cardiac_endpoint(model_name):
    if model_name not in models:
        return jsonify({"error": "Unknown model requested."}), 400
    if 'dicom' not in request.files:
        return jsonify({"error": "No file provided."}), 400
    
    file = request.files['dicom']
    temp_path = "temp.dcm"
    file.save(temp_path)
    
    try:
        # Preprocess using existing function
        input_tensor = preprocess_dicom(temp_path)
        
        # Get prediction from model
        with torch.no_grad():
            bbox = models[model_name](input_tensor.unsqueeze(0))[0]
        
        # Scale factor from 224x224 to 1024x1024
        scale_factor = 1024 / 224
        
        # Load and process original image
        ds = pydicom.read_file(temp_path)
        raw_img = ds.pixel_array.astype(np.float32)
        raw_img_norm = (raw_img - raw_img.min()) / (raw_img.max() - raw_img.min())
        raw_img_1024 = cv2.resize(raw_img_norm, (1024, 1024))
        raw_img_1024 = (raw_img_1024 * 255).astype(np.uint8)
        
        # Convert to BGR for rectangle drawing
        img_with_bbox = cv2.cvtColor(raw_img_1024, cv2.COLOR_GRAY2BGR)
        
        # Draw predicted bounding box - scale coordinates up to 1024x1024
        coords = bbox.cpu().numpy()
        x1, y1, x2, y2 = [int(coord * scale_factor) for coord in coords]
        cv2.rectangle(img_with_bbox, (x1, y1), (x2, y2), (0, 255, 0), 2)
        
        # Encode and return image
        _, img_encoded = cv2.imencode('.png', img_with_bbox)
        response = make_response(send_file(io.BytesIO(img_encoded.tobytes()), mimetype='image/png'))
        
        # Add CORS headers
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'POST'
        
        os.remove(temp_path)
        return response
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
