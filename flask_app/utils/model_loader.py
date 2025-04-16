import warnings
from models.pneumonia_model_cam import PneumoniaModelCAM
from models.cardiac_model import CardiacModel
from models.atrium_model import AtriumSegmentation
# Future models can be imported here.

def load_model(model_name, checkpoint_path, device):
    # Suppress all model state dict related warnings
    with warnings.catch_warnings():
        warnings.filterwarnings('ignore', category=UserWarning)
        
        if model_name == "pneumonia":
            model = PneumoniaModelCAM.load_from_checkpoint(checkpoint_path, strict=False)
        elif model_name == "cardiac":
            model = CardiacModel.load_from_checkpoint(checkpoint_path, strict=False)
        elif model_name == "atrium":
            model = AtriumSegmentation.load_from_checkpoint(checkpoint_path, strict=False)
        else:
            raise ValueError("Unknown model name")
        
        model.eval()
        model.to(device)
        return model
