from flask import Blueprint, request, jsonify, send_file, make_response
from flask_cors import CORS  # You'll need to install flask-cors
import os
import io
import torch
import cv2
import numpy as np
import pydicom
import nibabel as nib
import zipfile
import tempfile
from utils.preprocess import preprocess_dicom, normalize_volume, standardize_volume
from utils.cam import compute_cam
from utils.model_loader import load_model

predict_bp = Blueprint('predict_bp', __name__)
CORS(predict_bp)  # Enable CORS for all routes in this blueprint
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

# Load the pneumonia CAM model. Ensure you're using the CAM version.
models = {}
models["pneumonia"] = load_model("pneumonia", "weights/pneumonia_weights.ckpt", device)

# Add cardiac model to models dict
models["cardiac"] = load_model("cardiac", "weights/cardiac_weights.ckpt", device)

# Add left atrium segmentation model
models["atrium"] = load_model("atrium", "weights/atrium_weights.ckpt", device)

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

@predict_bp.route('/segment_atrium', methods=['POST'])
def segment_atrium_endpoint():
    if 'nifti' not in request.files:
        return jsonify({"error": "No NIfTI file provided."}), 400
    
    file = request.files['nifti']
    temp_path = "temp.nii.gz"
    file.save(temp_path)
    
    # Create a temporary directory for the slice PNGs
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, "segmented_slices.zip")
    
    try:
        # Load NIfTI volume
        nifti_img = nib.load(temp_path)
        volume = nifti_img.get_fdata()
        
        nifti_slice_count = volume.shape[2]
        # print(f"NIfTI volume loaded with {nifti_slice_count} slices.") # Removed log

        # Normalize and standardize volume
        volume_norm = normalize_volume(volume)
        volume_std = standardize_volume(volume_norm)
        
        # Create a ZIP file to store all segmented slices
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            saved_png_count = 0 # Counter for saved PNGs
            # Process each slice and store predictions
            for i in range(volume.shape[2]):  # Assuming the slices are along the z-axis
                # Extract standardized slice for model
                slice_img = volume_std[:, :, i]
                
                # Extract original slice for visualization
                original_slice = volume[:, :, i]
                
                # --- REMOVED Debugging --- 
                # if i < 3: # Check first 3 slices
                #     print(f"--- Debug Slice {i} ---")
                #     print(f"  slice_img shape: {slice_img.shape}")
                #     print(f"  slice_img dtype: {slice_img.dtype}")
                #     min_val, max_val = np.min(slice_img), np.max(slice_img)
                #     has_nan = np.isnan(slice_img).any()
                #     print(f"  Min value: {min_val:.4f}")
                #     print(f"  Max value: {max_val:.4f}")
                #     print(f"  Contains NaN: {has_nan}")
                # --- End REMOVED Debugging ---

                # Skip completely empty slices (completely black)
                if np.max(slice_img) < 0.01:
                    # print(f"Slice {i} skipped (max value < 0.01)") # Removed log
                    continue
                
                # Resize and prepare for model
                slice_resized = cv2.resize(slice_img, (224, 224))
                slice_tensor = torch.from_numpy(slice_resized).float().unsqueeze(0).unsqueeze(0).to(device)
                
                # Get prediction from model
                with torch.no_grad():
                    pred = models["atrium"](slice_tensor)
                    # AtriumSegmentation forward already applies sigmoid
                    
                    # Debug: Output prediction statistics before thresholding
                    # pred_np = pred.cpu().numpy()
                    # print(f"Slice {i}: pred min={pred_np.min():.4f}, max={pred_np.max():.4f}, mean={pred_np.mean():.4f}") # Removed log
                    
                    # Use a reasonable threshold of 0.5
                    threshold = 0.5
                    mask = (pred > threshold).float()
                    
                    # Debug: Output mask coverage
                    # mask_np = mask.cpu().numpy()
                    # coverage = mask_np.mean() * 100
                    # print(f"Mask coverage: {coverage:.2f}% of image") # Removed log
                
                # Convert prediction to original size
                mask = mask.squeeze().cpu().numpy()
                mask_resized = cv2.resize(mask, (slice_img.shape[1], slice_img.shape[0]))
                
                # Create RGB visualization with red overlay using OpenCV
                # Scale the ORIGINAL slice to 0-255 range for visualization based on its own min/max
                min_orig, max_orig = np.min(original_slice), np.max(original_slice)
                if max_orig > min_orig: # Avoid division by zero for constant slices
                    vis_slice = ((original_slice - min_orig) / (max_orig - min_orig) * 255).astype(np.uint8)
                else:
                    vis_slice = np.zeros_like(original_slice, dtype=np.uint8) # Handle constant slice

                # Convert grayscale to BGR
                vis_rgb = cv2.cvtColor(vis_slice, cv2.COLOR_GRAY2BGR)
                
                # Create a red mask only where the segmentation is positive
                red_mask = np.zeros_like(vis_rgb)
                red_mask[:, :, 2] = (mask_resized * 255).astype(np.uint8)  # Red channel in BGR
                
                # Only apply the red overlay where the mask is non-zero
                overlay = vis_rgb.copy()
                non_zero_mask = mask_resized > 0
                if non_zero_mask.any():  # Only blend if there are non-zero pixels in the mask
                    # Apply red only to the areas with a positive segmentation
                    overlay[non_zero_mask] = cv2.addWeighted(
                        vis_rgb[non_zero_mask], 
                        0.5,  # Alpha for original image
                        red_mask[non_zero_mask], 
                        0.5,  # Alpha for red overlay
                        0
                    )
                
                # Rotate the final overlay image 90 degrees counter-clockwise
                overlay_rotated = cv2.rotate(overlay, cv2.ROTATE_90_COUNTERCLOCKWISE)

                # Flip the rotated image horizontally (along Y-axis)
                overlay_final = cv2.flip(overlay_rotated, 1)

                # Create a temporary file for this slice
                slice_filename = f"slice_{i:03d}.png"
                temp_slice_path = os.path.join(temp_dir, slice_filename)
                
                # Save the ROTATED and FLIPPED slice to the temporary file
                cv2.imwrite(temp_slice_path, overlay_final)
                
                # Add the slice to the ZIP file
                zipf.write(temp_slice_path, slice_filename)
                saved_png_count += 1 # Increment counter
                
                # Remove the temporary slice file
                os.remove(temp_slice_path)
                
                # --- REMOVED Debugging images save ---
                # if i == 0 or i == volume.shape[2] // 2:
                #     debug_dir = os.path.join(temp_dir, "debug")
                #     os.makedirs(debug_dir, exist_ok=True)
                # 
                #     prefix = f"slice_{i:03d}"
                # 
                #     # Save scaled original slice used for visualization background
                #     cv2.imwrite(os.path.join(debug_dir, f"{prefix}_original_scaled.png"), vis_slice)
                #     zipf.write(os.path.join(debug_dir, f"{prefix}_original_scaled.png"), f"debug/{prefix}_original_scaled.png")
                # 
                #     # Save standardized slice fed to model (scale 0-1 to 0-255 for saving)
                #     standardized_vis = (slice_img * 255).astype(np.uint8)
                #     cv2.imwrite(os.path.join(debug_dir, f"{prefix}_standardized_model_input.png"), standardized_vis)
                #     zipf.write(os.path.join(debug_dir, f"{prefix}_standardized_model_input.png"), f"debug/{prefix}_standardized_model_input.png")
                # 
                #     # Save binary mask (resized)
                #     mask_vis = (mask_resized * 255).astype(np.uint8)
                #     cv2.imwrite(os.path.join(debug_dir, f"{prefix}_binary_mask.png"), mask_vis)
                #     zipf.write(os.path.join(debug_dir, f"{prefix}_binary_mask.png"), f"debug/{prefix}_binary_mask.png")
                # --- End REMOVED Debugging images save ---
        
            # print(f"Finished processing. Saved {saved_png_count} PNG slices to zip.") # Removed log

        # Create response with the ZIP file
        response = make_response(send_file(zip_path, 
                                          mimetype='application/zip',
                                          as_attachment=True, 
                                          download_name='segmented_slices.zip'))
        
        # Add CORS headers
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'POST'
        
        # Clean up
        os.remove(temp_path)
        return response
        
    except Exception as e:
        # Clean up on error
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": str(e)}), 500
    finally:
        # Make sure we clean up the temporary directory
        import shutil
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
