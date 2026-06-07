import shutil
from PIL import Image

generated_png = r"C:\Users\NITRO\.gemini\antigravity-ide\brain\8a0fac99-f49a-4d2b-8f05-5efe90a94988\ana_file_icon_1780758704228.png"
target_png = r"e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\ana-file.png"
target_ico = r"e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\ana-file.ico"

print(f"Loading generated icon from: {generated_png}")

# Open PNG and convert to RGBA
img = Image.open(generated_png).convert("RGBA")
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
    # Check if pixel is dark/black (distance from black is less than 50)
    dist = (r*r + g*g + b*b) ** 0.5
    if dist < 50:
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
img.save(target_png, format="PNG")
print(f"Transparent PNG saved to: {target_png}")

# Save high-quality multi-size ICO
icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(target_ico, format="ICO", sizes=icon_sizes)
print(f"Multi-size transparent ICO saved successfully to: {target_ico}")
