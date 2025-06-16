import pytest
import numpy as np
import torch
from unittest.mock import MagicMock
import sys
import os

# Add the parent directory to the path so we can import modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from utils.preprocess import normalize_volume, standardize_volume
from utils.cam import compute_cam

class TestPreprocessUtils:
    def test_normalize_volume(self):
        """Test that normalize_volume correctly z-normalizes a volume."""
        # Create a sample volume with known mean and std
        mean_val = 10
        std_val = 2
        volume = np.random.normal(mean_val, std_val, size=(10, 10, 10))
        
        # Normalize the volume
        normalized = normalize_volume(volume)
        
        # Check that the normalized volume has mean close to 0 and std close to 1
        assert abs(normalized.mean()) < 1e-5  # Mean should be close to 0
        assert abs(normalized.std() - 1.0) < 1e-5  # Std should be close to 1
    
    def test_normalize_volume_constant_input(self):
        """Test that normalize_volume handles constant input correctly."""
        # Create a constant volume
        volume = np.ones((10, 10, 10)) * 5
        
        # Normalize the volume
        normalized = normalize_volume(volume)
        
        # For constant input, output should be all zeros
        assert np.all(normalized == 0)
    
    def test_standardize_volume(self):
        """Test that standardize_volume correctly scales to 0-1 range."""
        # Create a sample normalized volume
        volume = np.random.normal(0, 1, size=(10, 10, 10))
        
        # Make sure it has some negative values
        assert np.min(volume) < 0
        
        # Standardize the volume
        standardized = standardize_volume(volume)
        
        # Check that values are in 0-1 range
        assert np.min(standardized) >= 0
        assert np.max(standardized) <= 1
        
        # If input covers full range, output should cover full range
        volume_full_range = np.linspace(-3, 3, 100).reshape(10, 10, 1)
        standardized_full_range = standardize_volume(volume_full_range)
        assert np.min(standardized_full_range) == 0
        assert np.max(standardized_full_range) == 1
    
    def test_standardize_volume_constant_input(self):
        """Test that standardize_volume handles constant input correctly."""
        # Create a constant volume
        volume = np.ones((10, 10, 10)) * 5
        
        # Standardize the volume
        standardized = standardize_volume(volume)
        
        # For constant input, output should be all zeros
        assert np.all(standardized == 0)


class TestCAMUtils:
    def test_compute_cam(self):
        """Test that compute_cam correctly generates a class activation map."""
        # Create a mock model
        mock_model = MagicMock()
        
        # Setup mock feature maps and prediction
        mock_features = torch.ones((1, 512, 7, 7))
        mock_pred = torch.tensor([[0.7]])
        mock_model.return_value = (mock_pred, mock_features)
        
        # Setup mock FC layer weights
        mock_fc_weights = torch.ones((1, 512))
        mock_model.model.fc.parameters.return_value = [mock_fc_weights]
        
        # Create a sample input tensor
        image_tensor = torch.zeros((1, 224, 224))
        
        # Compute the CAM
        cam, pred = compute_cam(mock_model, image_tensor)
        
        # Check the shape of the output CAM
        assert cam.shape == (7, 7)
        
        # Check normalization (values between 0 and 1)
        assert torch.min(cam) >= 0
        assert torch.max(cam) <= 1
        
        # Check prediction is passed through
        assert pred.item() == torch.sigmoid(mock_pred).item()