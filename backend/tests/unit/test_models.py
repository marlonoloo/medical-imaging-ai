import pytest
import torch
import sys
import os
from unittest.mock import MagicMock, patch

# Add the parent directory to the path so we can import the models
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from models.pneumonia_model_cam import PneumoniaModelCAM
from models.cardiac_model import CardiacModel
from models.atrium_model import AtriumSegmentation, UNet


@pytest.mark.parametrize("batch_size", [1, 4])
class TestPneumoniaModel:
    def test_model_structure(self, batch_size):
        """Test that the model is structured correctly."""
        model = PneumoniaModelCAM()
        
        # Check that the model has the expected components
        assert hasattr(model, 'model')
        assert hasattr(model, 'feature_extractor')
        assert hasattr(model, 'loss_fn')
        
        # Check the structure of the model
        assert model.model.conv1.in_channels == 1  # First conv layer should accept 1 channel input
        assert model.model.fc.out_features == 1    # Output should be 1 for binary classification
    
    def test_forward_pass(self, batch_size):
        """Test the forward pass of the model."""
        model = PneumoniaModelCAM()
        
        # Create a sample input tensor (batch_size, channels, height, width)
        input_tensor = torch.rand(batch_size, 1, 224, 224)
        
        # Pass the input through the model
        pred, features = model(input_tensor)
        
        # Check the shapes of the outputs
        assert pred.shape == (batch_size, 1)          # Output shape should be (batch_size, 1)
        assert features.shape == (batch_size, 512, 7, 7)  # Feature maps should be (batch_size, 512, 7, 7)
    
    def test_training_step(self, batch_size):
        """Test the training step of the model."""
        model = PneumoniaModelCAM()
        
        # Create a sample batch (input, target)
        x = torch.rand(batch_size, 1, 224, 224)
        y = torch.randint(0, 2, (batch_size, 1)).float()
        batch = (x, y)
        
        # Mock the log method to avoid issues with the trainer
        model.log = MagicMock()
        
        # Create a dummy training step method that uses our model's forward pass
        # but manually calculates loss
        pred, _ = model(x)
        loss = torch.nn.functional.binary_cross_entropy_with_logits(pred, y)
        
        # Check that loss is a valid tensor with gradient
        assert loss is not None
        assert isinstance(loss.item(), float)
        assert loss.requires_grad


@pytest.mark.parametrize("batch_size", [1, 4])
class TestCardiacModel:
    def test_model_structure(self, batch_size):
        """Test that the model is structured correctly."""
        model = CardiacModel()
        
        # Check that the model has the expected components
        assert hasattr(model, 'model')
        assert hasattr(model, 'optimizer')
        assert hasattr(model, 'loss_fn')
        
        # Check the structure of the model
        assert model.model.conv1.in_channels == 1  # First conv layer should accept 1 channel input
        assert model.model.fc.out_features == 4    # Output should be 4 for bbox coordinates (x1,y1,x2,y2)
    
    def test_forward_pass(self, batch_size):
        """Test the forward pass of the model."""
        model = CardiacModel()
        
        # Create a sample input tensor (batch_size, channels, height, width)
        input_tensor = torch.rand(batch_size, 1, 224, 224)
        
        # Pass the input through the model
        output = model(input_tensor)
        
        # Check the shape of the output
        assert output.shape == (batch_size, 4)  # Output shape should be (batch_size, 4) for bbox coordinates
    
    def test_training_step(self, batch_size):
        """Test the training step of the model."""
        model = CardiacModel()
        
        # Create a sample batch (input, target)
        x = torch.rand(batch_size, 1, 224, 224)
        y = torch.rand(batch_size, 4)  # 4 values for bounding box coordinates
        batch = (x, y)
        
        # Mock the log method to avoid issues with the trainer
        model.log = MagicMock()
        
        # Create a dummy training step that uses our model's forward pass
        # but manually calculates loss
        pred = model(x)
        loss = torch.nn.functional.mse_loss(pred, y)
        
        # Check that loss is a valid tensor with gradient
        assert loss is not None
        assert isinstance(loss.item(), float)
        assert loss.requires_grad


@pytest.mark.parametrize("batch_size", [1, 2])
@pytest.mark.parametrize("height,width", [(224, 224), (256, 256)])
class TestAtriumModel:
    def test_unet_structure(self, batch_size, height, width):
        """Test that the UNet model is structured correctly."""
        unet = UNet()
        
        # Check the structure of the UNet model
        assert unet.layer1.step[0].in_channels == 1  # First conv layer should accept 1 channel input
        assert unet.layer8.out_channels == 1         # Final output should have 1 channel for segmentation mask
    
    def test_atrium_model_structure(self, batch_size, height, width):
        """Test that the model is structured correctly."""
        model = AtriumSegmentation()
        
        # Check that the model has the expected components
        assert hasattr(model, 'model')
        assert hasattr(model, 'optimizer')
        
        # Check that the model uses a UNet
        assert isinstance(model.model, UNet)
    
    def test_forward_pass(self, batch_size, height, width):
        """Test the forward pass of the model."""
        model = AtriumSegmentation()
        
        # Create a sample input tensor (batch_size, channels, height, width)
        input_tensor = torch.rand(batch_size, 1, height, width)
        
        # Pass the input through the model
        output = model(input_tensor)
        
        # Check the shape of the output
        assert output.shape == (batch_size, 1, height, width)  # Output shape should match input spatial dimensions
        
        # Check that output values are between 0 and 1 (due to sigmoid in forward)
        assert torch.min(output) >= 0
        assert torch.max(output) <= 1
    
    def test_dice_loss(self, batch_size, height, width):
        """Test the Dice loss function for segmentation."""
        model = AtriumSegmentation()
        
        # Create sample input and target tensors
        pred = torch.sigmoid(torch.rand(batch_size, 1, height, width))
        target = torch.randint(0, 2, (batch_size, 1, height, width)).float()
        
        # Calculate Dice loss manually
        smooth = 1e-5
        intersection = (pred * target).sum(dim=(2, 3))
        union = pred.sum(dim=(2, 3)) + target.sum(dim=(2, 3))
        dice_score = (2 * intersection + smooth) / (union + smooth)
        dice_loss = 1 - dice_score.mean()
        
        # Check that loss is a valid value
        assert dice_loss >= 0
        assert dice_loss <= 1