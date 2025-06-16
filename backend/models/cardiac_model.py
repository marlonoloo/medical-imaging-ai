import torch
import torchvision
import pytorch_lightning as pl

class CardiacModel(pl.LightningModule):
    def __init__(self):
        super().__init__()
        self.model = torchvision.models.resnet18(pretrained=True)
        # Change first conv layer for single-channel input
        self.model.conv1 = torch.nn.Conv2d(1, 64, kernel_size=7, stride=2, padding=3, bias=False)
        # Change final fully connected layer for 4 outputs (x1,y1,x2,y2)
        self.model.fc = torch.nn.Linear(512, 4)
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=1e-4)
        self.loss_fn = torch.nn.MSELoss()

    def forward(self, x):
        return self.model(x)
