import shutil
from PIL import Image

png_path = r"e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\ana-file.png"
ico_path = r"e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\ana-file.ico"

# Create backups first
shutil.copy(png_path, png_path + ".bak")
shutil.copy(ico_path, ico_path + ".bak")

print("Backups created.")

# Open PNG
img = Image.open(png_path).convert("RGBA")
width, height = img.size
pixels = img.load()

# Perform BFS starting from corners to find and clear the black background
visited = [[False for _ in range(height)] for _ in range(width)]
queue = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]

for x, y in queue:
    visited[x][y] = True

idx = 0
while idx < len(queue):
    x, y = queue[idx]
    idx += 1
    
    r, g, b, a = pixels[x, y]
    # Check if pixel is dark/black (distance from black is less than 45)
    dist = (r*r + g*g + b*b) ** 0.5
    if dist < 45:
        # Make transparent
        pixels[x, y] = (0, 0, 0, 0)
        
        # Add 4-connected neighbors
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height:
                if not visited[nx][ny]:
                    visited[nx][ny] = True
                    queue.append((nx, ny))

# Save transparent PNG
img.save(png_path, format="PNG")
print("Transparent PNG saved.")

# Save high-quality multi-size ICO
icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(ico_path, format="ICO", sizes=icon_sizes)
print("Multi-size transparent ICO saved successfully.")
