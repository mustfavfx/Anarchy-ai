import math
from PIL import Image, ImageDraw, ImageFilter

# Paths
generated_png = r"C:\Users\NITRO\.gemini\antigravity-ide\brain\8a0fac99-f49a-4d2b-8f05-5efe90a94988\ana_file_icon_1780758704228.png"
logo_png_path = r"e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\icon.png"
target_png = r"e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\ana-file.png"
target_ico = r"e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\ana-file.ico"

print("Step 1: Loading original generated PNG...")
img = Image.open(generated_png).convert("RGBA")
width, height = img.size
pixels = img.load()

print("Step 2: Removing black background (transparency) using BFS...")
visited = [[False for _ in range(height)] for _ in range(width)]
queue = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]

for x, y in queue:
    visited[x][y] = True

idx = 0
while idx < len(queue):
    x, y = queue[idx]
    idx += 1
    
    r, g, b, a = pixels[x, y]
    dist = (r*r + g*g + b*b) ** 0.5
    if dist < 50:
        pixels[x, y] = (0, 0, 0, 0)
        
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height:
                if not visited[nx][ny]:
                    visited[nx][ny] = True
                    queue.append((nx, ny))

print("Step 3: Erasing old neon logo and stand using precise masked soft-interpolation...")
# Create custom mask for erasing the logo and its stand
mask = Image.new("L", (width, height), 0)
draw = ImageDraw.Draw(mask)

# Draw a larger circle covering the main neon logo and its glow
center_x = 512
center_y = 495
circle_radius = 240
draw.ellipse(
    [center_x - circle_radius, center_y - circle_radius, center_x + circle_radius, center_y + circle_radius],
    fill=255
)

# Draw a larger trapezoid covering the stand at the bottom
poly_points = [
    (280, 690),  # Bottom-left (wider)
    (744, 690),  # Bottom-right (wider)
    (640, 480),  # Top-right
    (384, 480)   # Top-left
]
draw.polygon(poly_points, fill=255)

# Blur the mask to create a soft transition
blurred_mask = mask.filter(ImageFilter.GaussianBlur(radius=20))
mask_pixels = blurred_mask.load()

# Perform the interpolation and blending
x_left_anchor = 250
x_right_anchor = 770

for y in range(height):
    left_pixel = pixels[x_left_anchor, y]
    right_pixel = pixels[x_right_anchor, y]
    
    for x in range(width):
        mask_val = mask_pixels[x, y] / 255.0
        if mask_val > 0:
            # Interpolated clean background color
            t_horiz = (x - x_left_anchor) / (x_right_anchor - x_left_anchor)
            t_horiz = max(0.0, min(1.0, t_horiz))
            
            interp_r = int(left_pixel[0] * (1 - t_horiz) + right_pixel[0] * t_horiz)
            interp_g = int(left_pixel[1] * (1 - t_horiz) + right_pixel[1] * t_horiz)
            interp_b = int(left_pixel[2] * (1 - t_horiz) + right_pixel[2] * t_horiz)
            interp_a = int(left_pixel[3] * (1 - t_horiz) + right_pixel[3] * t_horiz)
            
            # Original pixel color
            orig_r, orig_g, orig_b, orig_a = pixels[x, y]
            
            # Blend
            final_r = int(orig_r * (1 - mask_val) + interp_r * mask_val)
            final_g = int(orig_g * (1 - mask_val) + interp_g * mask_val)
            final_b = int(orig_b * (1 - mask_val) + interp_b * mask_val)
            final_a = int(orig_a * (1 - mask_val) + interp_a * mask_val)
            
            pixels[x, y] = (final_r, final_g, final_b, final_a)

print("Step 4: Resizing and overlaying the official logo in the center...")
# Load the official logo
logo_img = Image.open(logo_png_path).convert("RGBA")
# Resize logo to fit nicely (size 370)
logo_size = 370
logo_resized = logo_img.resize((logo_size, logo_size), Image.Resampling.LANCZOS)

# Paste the logo with transparency mask
paste_x = center_x - (logo_size // 2)
paste_y = center_y - (logo_size // 2)
img.paste(logo_resized, (paste_x, paste_y), logo_resized)

# Save the final transparent PNG
img.save(target_png, format="PNG")
print(f"Final PNG saved successfully to: {target_png}")

# Save the final transparent ICO (multi-size)
icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(target_ico, format="ICO", sizes=icon_sizes)
print(f"Final ICO saved successfully to: {target_ico}")
