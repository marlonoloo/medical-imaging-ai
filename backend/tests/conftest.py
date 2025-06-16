import os
import sys
import pytest
from flask import Flask
from unittest.mock import MagicMock

# Add the parent directory to the path so we can import the app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app as flask_app
from models.pneumonia_model_cam import PneumoniaModelCAM
from models.cardiac_model import CardiacModel
from models.atrium_model import AtriumSegmentation

@pytest.fixture
def app():
    """Create and configure a Flask app for testing."""
    # Set testing configuration
    flask_app.config.update({
        "TESTING": True,
    })
    yield flask_app

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture
def mock_pneumonia_model():
    """Create a mock pneumonia model."""
    model = MagicMock(spec=PneumoniaModelCAM)
    # Configure the mock to return a tensor and features when called
    model.return_value = (
        MagicMock(),  # Mock prediction tensor
        MagicMock()   # Mock features tensor
    )
    return model

@pytest.fixture
def mock_cardiac_model():
    """Create a mock cardiac model."""
    model = MagicMock(spec=CardiacModel)
    # Configure the mock to return bounding box coordinates when called
    model.return_value = MagicMock()  # Mock bounding box tensor
    return model

@pytest.fixture
def mock_atrium_model():
    """Create a mock atrium segmentation model."""
    model = MagicMock(spec=AtriumSegmentation)
    # Configure the mock to return a segmentation mask when called
    model.return_value = MagicMock()  # Mock segmentation mask tensor
    return model