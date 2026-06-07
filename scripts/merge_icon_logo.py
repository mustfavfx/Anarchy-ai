from PIL import Image

# Paths
glass_png_path = r"e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\ana-file.png"
logo_png_path = r"e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\icon.png"
target_ico_path = r"e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\ana-file.ico"

print("Loading images...")
# Open the glassmorphic card image (already transparent)
glass_img = Image.open(glass_png_path).convert("RGBA")
# Open the official logo
logo_img = Image.open(logo_png_path).convert("RGBA")

# We want the logo to be circular and fit over the old neon logo.
# Let's resize the logo to a perfect circular diameter, say 370x370 pixels.
logo_size = 370
logo_resized = logo_img.resize((logo_size, logo_size), Image.Resampling.LANCZOS)

# Create a clean copy of the glassmorphic background to paste on
final_img = glass_img.copy()

# The center of the neon logo in the 1024x1024 glass_img is roughly at:
# X = 512, Y = 495
center_x = 512
center_y = 495

# Calculate top-left coordinate for pasting
paste_x = center_x - (logo_size // 2)
paste_y = center_y - (logo_size // 2)

print(f"Pasting logo at ({paste_x}, {paste_y}) with size {logo_size}...")
# Paste the logo with transparency mask
final_img.paste(logo_resized, (paste_x, paste_y), logo_resized)

# Save the updated PNG
final_img.save(glass_png_path, format="PNG")
print("PNG saved successfully.")

# Save the multi-size ICO
icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
final_img.save(target_ico_path, format="ICO", sizes=icon_sizes)
print("ICO saved successfully.")
