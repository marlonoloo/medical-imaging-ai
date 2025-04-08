import warnings
from models.pneumonia_model_cam import PneumoniaModelCAM
from models.cardiac_model import CardiacModel
# Future models can be imported here.

def load_model(model_name, checkpoint_path, device, model_type="default"):
    # Suppress specific PyTorch Lightning warning about missing keys
    warnings.filterwarnings('ignore', message='Found keys that are in the model state dict but not in the checkpoint*')
    
    if model_name == "pneumonia":
        model = PneumoniaModelCAM.load_from_checkpoint(checkpoint_path, strict=False)
    elif model_name == "cardiac":
        model = CardiacModel.load_from_checkpoint(checkpoint_path, strict=False)
    else:
        raise ValueError("Unknown model name")
    
    model.eval()
    model.to(device)
    return model
