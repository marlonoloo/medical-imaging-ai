import torch

def compute_cam(model, image_tensor):
    """
    Compute the Class Activation Map (CAM) for the given image tensor.
    Assumes image_tensor is of shape (C, 224, 224).
    """
    model.eval()
    with torch.no_grad():
        pred, features = model(image_tensor.unsqueeze(0))  # features: (1, 512, 7, 7)
    # Remove batch dimension
    features = features.squeeze(0)  # shape: (512, 7, 7)
    b, h, w = features.shape
    # Reshape features to (512, 49)
    features_reshaped = features.reshape(b, h * w)  # (512, 49)
    
    # Get weights from the fully connected layer (only weights, not bias)
    weight_params = list(model.model.fc.parameters())[0]  # shape: (1, 512)
    weight = weight_params[0].detach()  # shape: (512,)
    
    # Compute the CAM as a weighted sum of the feature maps.
    cam = torch.matmul(weight, features_reshaped)  # shape: (49,)
    cam = cam.reshape(h, w)  # shape: (7, 7)
    
    # Normalize the CAM between 0 and 1
    # Handle the case where min and max are the same (constant CAM)
    cam_min = cam.min()
    cam_max = cam.max()
    
    if cam_max - cam_min > 1e-7:  # Only normalize if there's a meaningful difference
        cam = (cam - cam_min) / (cam_max - cam_min)
    else:
        # If the CAM is constant, set it to zeros to avoid division by zero
        cam = torch.zeros_like(cam)
        
    return cam, torch.sigmoid(pred)
