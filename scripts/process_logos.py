import os
from PIL import Image

src_dir = r"C:\Users\NITRO\Videos\New folder (2)"
dest_dir = r"e:\New folder (5)\Anarchy Ai 0.07\src\assets"

files_map = {
    "3ds max.png": "3dsmax.png",
    "revit.png": "revit.png",
    "SketchUp.png": "sketchup.png",
    "archicad.jpg": "archicad.png"
}

def clean_bg(img):
    img = img.convert("RGBA")
    datas = img.getdata()
    
    # Find dominant corner color
    width, height = img.size
    corners = [
        img.getpixel((0, 0)),
        img.getpixel((width - 1, 0)),
        img.getpixel((0, height - 1)),
        img.getpixel((width - 1, height - 1))
    ]
    
    # Check if corner is white or black
    # We will compute threshold distance to white (255, 255, 255) or black (0, 0, 0)
    bg_color = None
    for c in corners:
        # If corner is white-ish (sum > 700)
        if c[0] + c[1] + c[2] > 700:
            bg_color = "white"
            break
        # If corner is black-ish (sum < 50)
        elif c[0] + c[1] + c[2] < 50:
            bg_color = "black"
            break
            
    if not bg_color:
        return img  # Keep as is
        
    new_data = []
    for item in datas:
        if bg_color == "white":
            # If pixel is very close to white, make it transparent
            if item[0] > 230 and item[1] > 230 and item[2] > 230:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
        elif bg_color == "black":
            # If pixel is very close to black, make it transparent
            if item[0] < 25 and item[1] < 25 and item[2] < 25:
                new_data.append((0, 0, 0, 0))
            else:
                new_data.append(item)
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    return img

for src_name, dest_name in files_map.items():
    src_path = os.path.join(src_dir, src_name)
    dest_path = os.path.join(dest_dir, dest_name)
    
    if os.path.exists(src_path):
        print(f"Processing {src_name} -> {dest_name}...")
        img = Image.open(src_path)
        processed_img = clean_bg(img)
        processed_img.save(dest_path, "PNG")
        print(f"Saved {dest_name} to assets.")
    else:
        print(f"Source file not found: {src_path}")
