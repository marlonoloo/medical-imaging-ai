import torch
import torchvision
import pytorch_lightning as pl
import torch.nn.functional as F

class PneumoniaModelCAM(pl.LightningModule):
    def __init__(self, weight=1):
        super().__init__()
        self.model = torchvision.models.resnet18()
        # Change first conv layer for single-channel input
        self.model.conv1 = torch.nn.Conv2d(1, 64, kernel_size=7, stride=2, padding=3, bias=False)
        # Change final fully connected layer for binary classification
        self.model.fc = torch.nn.Linear(512, 1)
        self.loss_fn = torch.nn.BCEWithLogitsLoss(pos_weight=torch.tensor([weight]))
        
        # Create a feature extractor from the model (all layers except the last 2)
        self.feature_extractor = torch.nn.Sequential(*list(self.model.children())[:-2])
    
    def forward(self, x):
        # Compute the feature map from the convolutional layers
        features = self.feature_extractor(x)  # shape: (B, 512, 7, 7)
        # Apply Adaptive Average Pooling as in the original model
        avg_pool = F.adaptive_avg_pool2d(features, (1,1))
        avg_pool_flat = torch.flatten(avg_pool, 1)
        # Get prediction from the FC layer
        pred = self.model.fc(avg_pool_flat)
        return pred, features
