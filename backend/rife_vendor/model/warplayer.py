import torch

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
backwarp_tenGrid = {}


def warp(tenInput, tenFlow):
    k = (str(tenFlow.device), str(tenFlow.size()))
    if k not in backwarp_tenGrid:
        # Use the actual device of the input tensor, not the global device variable
        actual_device = tenInput.device
        tenHorizontal = torch.linspace(-1.0, 1.0, tenFlow.shape[3], device=actual_device).view(
            1, 1, 1, tenFlow.shape[3]).expand(tenFlow.shape[0], -1, tenFlow.shape[2], -1)
        tenVertical = torch.linspace(-1.0, 1.0, tenFlow.shape[2], device=actual_device).view(
            1, 1, tenFlow.shape[2], 1).expand(tenFlow.shape[0], -1, -1, tenFlow.shape[3])
        backwarp_tenGrid[k] = torch.cat(
            [tenHorizontal, tenVertical], 1).to(actual_device)

    tenFlow = torch.cat([tenFlow[:, 0:1, :, :] / ((tenInput.shape[3] - 1.0) / 2.0),
                         tenFlow[:, 1:2, :, :] / ((tenInput.shape[2] - 1.0) / 2.0)], 1)

    g = (backwarp_tenGrid[k] + tenFlow).permute(0, 2, 3, 1)
    # Use 'zeros' padding mode for MPS compatibility (MPS doesn't support 'border')
    # Check device type to determine padding mode
    device_type = str(tenInput.device.type)
    padding_mode = 'zeros' if device_type == 'mps' else 'border'
    return torch.nn.functional.grid_sample(input=tenInput, grid=g, mode='bilinear', padding_mode=padding_mode, align_corners=True)
