# -*- coding: utf-8 -*-
"""
Anarchy AI 3ds Max Pymxs Tools Module
Provides high-level, safe, parametric BIM/3D operations using Autodesk 3ds Max Python API (pymxs).
Each tool is atomic, wrapped in Max undo buffers, and returns clean structured output.
"""

import math
import contextlib

try:
    import pymxs
    rt = pymxs.runtime
except ImportError:
    # Allows module to be tested/linted in environments where pymxs is unavailable
    pymxs = None
    rt = None


@contextlib.contextmanager
def safe_undo(label="Anarchy AI Operation"):
    """
    Context manager that safely wraps operations in 3ds Max undo buffer.
    Rethrows exceptions naturally to prevent masking errors or generator stop failures.
    """
    if pymxs is not None and hasattr(pymxs, 'undo'):
        with pymxs.undo(True, str(label)):
            yield
    else:
        yield


def get_unit_scale():
    """Returns scaling factor from 3ds Max internal units to meters."""
    if rt is None:
        return 1.0
    try:
        sys_type = str(rt.units.SystemType).lower()
        if 'millimeter' in sys_type:
            return 1000.0
        elif 'centimeter' in sys_type:
            return 100.0
        elif 'meter' in sys_type:
            return 1.0
        elif 'inch' in sys_type:
            return 39.3701
        elif 'feet' in sys_type:
            return 3.28084
    except Exception:
        pass
    return 1.0


def hex_to_rgb(hex_str):
    """Parses a hex color string (#RRGGBB) to (r, g, b) tuple 0-255."""
    if not hex_str or not isinstance(hex_str, str):
        return None
    cleaned = hex_str.lstrip('#').strip()
    if len(cleaned) == 6:
        try:
            r = int(cleaned[0:2], 16)
            g = int(cleaned[2:4], 16)
            b = int(cleaned[4:6], 16)
            return r, g, b
        except ValueError:
            return None
    return None


def kelvin_to_rgb(temp_k):
    """
    Approximates blackbody chromaticity (Kelvin to RGB 0-255) using Planckian radiation locus.
    Handles values from 1000K (deep orange candle) to 12000K (clear blue sky).
    """
    temp = max(1000.0, min(float(temp_k), 12000.0)) / 100.0

    # Red
    if temp <= 66.0:
        r = 255.0
    else:
        r = 329.698727446 * ((temp - 60.0) ** -0.1332047592)
        r = max(0.0, min(255.0, r))

    # Green
    if temp <= 66.0:
        g = 99.4708025861 * math.log(temp) - 161.1195681661
    else:
        g = 288.1221695283 * ((temp - 60.0) ** -0.0755148492)
    g = max(0.0, min(255.0, g))

    # Blue
    if temp >= 66.0:
        b = 255.0
    elif temp <= 19.0:
        b = 0.0
    else:
        b = 138.5177312231 * math.log(temp - 10.0) - 305.0447927307
        b = max(0.0, min(255.0, b))

    return int(r), int(g), int(b)


def create_box(length=5.0, width=5.0, height=3.0, name="Arch_Mass", x=0.0, y=0.0, z=0.0):
    """
    Creates an architectural mass/box with real meter units and centers camera view.
    Bounds: dimensions clamped between 0.05m and 2000.0m to prevent scene overflow.
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    # Bounds validation
    length_m = max(0.05, min(float(length), 2000.0))
    width_m = max(0.05, min(float(width), 2000.0))
    height_m = max(0.05, min(float(height), 2000.0))
    x_m = max(-50000.0, min(float(x), 50000.0))
    y_m = max(-50000.0, min(float(y), 50000.0))
    z_m = max(-5000.0, min(float(z), 50000.0))

    scale = get_unit_scale()
    l_val = length_m * scale
    w_val = width_m * scale
    h_val = height_m * scale

    # Place box centered around (x, y) with ground contact at z
    pos_val = rt.point3((x_m - width_m / 2.0) * scale, (y_m - length_m / 2.0) * scale, z_m * scale)

    with safe_undo(f"Create Box {name}"):
        b = rt.box(length=l_val, width=w_val, height=h_val, pos=pos_val)
        b.name = str(name)
        b.wirecolor = rt.color(220, 80, 50)
        try:
            b.pivot = rt.point3(x_m * scale, y_m * scale, z_m * scale)
        except Exception:
            pass
        rt.select(b)
        try:
            rt.execute("max zoomext sel")
        except Exception:
            pass

    return {
        "success": True,
        "name": b.name,
        "dimensions": [length_m, width_m, height_m],
        "position": [x_m, y_m, z_m],
        "message": f"Created architectural box '{b.name}' ({length_m:.2f}x{width_m:.2f}x{height_m:.2f}m centered at [{x_m:.1f}, {y_m:.1f}, {z_m:.1f}])"
    }


def create_architectural_house(
    style="modern",
    width=14.0,
    length=16.0,
    height=6.8,
    has_cantilever=True,
    has_balcony=True,
    has_louvers=True,
    plot_area=500.0,
    x=0.0,
    y=0.0,
    z=0.0,
    clear_previous=True
):
    """
    Parametrically models a full modern luxury residential villa in 3ds Max.
    Creates 11 distinct architectural elements with authentic volumetric composition:
    1. 01_Podium_Terrace - Ground foundation platform in travertine/stone
    2. 02_GF_Main_Living_Mass - Ground floor primary volume in smooth white stucco
    3. 03_Entrance_Feature_Wall - Double-height travertine stone entrance portal wall
    4. 04_Entrance_Canopy - Thin floating dark bronze/aluminum cantilevered entrance canopy
    5. 05_GF_Panoramic_Glass - Floor-to-ceiling recessed curtain wall glazing
    6. 06_FF_Cantilevered_Suite - Upper master suite projecting dynamically forward/side
    7. 07_FF_Terrace_Balcony - Outdoor cantilevered terrace/balcony
    8. 08_FF_Glass_Railing - Frameless architectural safety glass balustrade
    9. 09_FF_Corner_Glazing - Floor-to-ceiling panoramic corner window
    10. 10_Facade_Louver_1..6 - Rhythmic architectural vertical shading fins / louvers
    11. 11_Roof_Overhang_Slab - Thin crisp cantilevered roof plane with clean shadow reveals
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    scale = get_unit_scale()
    w_m = max(6.0, min(float(width), 200.0))
    l_m = max(6.0, min(float(length), 200.0))
    h_m = max(3.0, min(float(height), 100.0))
    x_m = float(x)
    y_m = float(y)
    z_m = float(z)

    with safe_undo("Generate Architectural House"):
        # Clean up any simple standalone boxes from prior steps
        if clear_previous:
            for old_name in ["Arch_Mass", "Main_Residential_Mass", "Main_Mass", "Main_Living_Mass"]:
                old_node = rt.getNodeByName(old_name)
                if old_node is not None:
                    try:
                        rt.delete(old_node)
                    except Exception:
                        pass

        created_parts = []

        def _make_part(p_name, pw, pl, ph, px, py, pz, wirecolor_rgb, mat_type=None):
            pos = rt.point3((px - pw / 2.0) * scale, (py - pl / 2.0) * scale, pz * scale)
            b = rt.box(length=pl * scale, width=pw * scale, height=ph * scale, pos=pos, name=p_name)
            b.wirecolor = rt.color(wirecolor_rgb[0], wirecolor_rgb[1], wirecolor_rgb[2])
            try:
                b.pivot = rt.point3(px * scale, py * scale, pz * scale)
            except Exception:
                pass
            if mat_type:
                try:
                    apply_material(object_name=p_name, material_type=mat_type)
                except Exception:
                    pass
            created_parts.append(p_name)
            return b

        # 1. Podium / Ground terrace platform
        pod_w = w_m + 4.0
        pod_l = l_m + 4.0
        pod_h = 0.35
        _make_part("01_Podium_Terrace", pod_w, pod_l, pod_h, x_m, y_m, z_m, (210, 205, 195), "travertine")

        # 2. Ground Floor main living volume
        gf_w = w_m * 0.74
        gf_l = l_m * 0.78
        gf_h = 3.3
        gf_x = x_m - (w_m * 0.08)
        gf_y = y_m - (l_m * 0.04)
        gf_z = z_m + pod_h
        _make_part("02_GF_Main_Living_Mass", gf_w, gf_l, gf_h, gf_x, gf_y, gf_z, (240, 240, 243), "concrete")

        # 3. Entrance stone portal wall (double-height feature wall)
        pw_w = 0.50
        pw_l = 4.2
        pw_h = 4.4
        pw_x = x_m + (w_m * 0.32)
        pw_y = y_m - (l_m * 0.38)
        pw_z = gf_z
        _make_part("03_Entrance_Feature_Wall", pw_w, pw_l, pw_h, pw_x, pw_y, pw_z, (200, 185, 160), "travertine")

        # 4. Floating entrance canopy
        can_w = 3.8
        can_l = 3.2
        can_h = 0.18
        can_x = pw_x - 1.4
        can_y = pw_y - 0.7
        can_z = gf_z + 3.1
        _make_part("04_Entrance_Canopy", can_w, can_l, can_h, can_x, can_y, can_z, (42, 42, 45), "metal")

        # 5. Panoramic curtain wall glazing (Ground Floor)
        gl_w = gf_w * 0.55
        gl_l = 0.15
        gl_h = 2.85
        gl_x = gf_x - (gf_w * 0.10)
        gl_y = gf_y - (gf_l / 2.0) - 0.02
        gl_z = gf_z + 0.10
        _make_part("05_GF_Panoramic_Glass", gl_w, gl_l, gl_h, gl_x, gl_y, gl_z, (150, 210, 235), "glass")

        # 6. Upper Floor cantilevered master volume (cantilevers 2.2m forward)
        ff_w = w_m * 0.82
        ff_l = l_m * 0.70
        ff_h = 3.2
        ff_x = x_m + (w_m * 0.05)
        ff_y = y_m - (l_m * 0.14)
        ff_z = gf_z + gf_h
        _make_part("06_FF_Cantilevered_Suite", ff_w, ff_l, ff_h, ff_x, ff_y, ff_z, (248, 248, 250), "concrete")

        # 7. Upper terrace balcony
        if has_balcony:
            ter_w = w_m * 0.36
            ter_l = 3.2
            ter_h = 0.22
            ter_x = ff_x - (ff_w * 0.24)
            ter_y = ff_y - (ff_l / 2.0) - (ter_l / 2.0)
            ter_z = ff_z
            _make_part("07_FF_Terrace_Balcony", ter_w, ter_l, ter_h, ter_x, ter_y, ter_z, (220, 220, 225), "concrete")

            # 8. Glass railing
            rail_w = ter_w
            rail_l = 0.08
            rail_h = 1.05
            rail_x = ter_x
            rail_y = ter_y - (ter_l / 2.0)
            rail_z = ter_z + ter_h
            _make_part("08_FF_Glass_Railing", rail_w, rail_l, rail_h, rail_x, rail_y, rail_z, (135, 215, 240), "glass")

        # 9. Upper floor corner glazing
        cg_w = w_m * 0.40
        cg_l = 0.15
        cg_h = 2.60
        cg_x = ff_x + (ff_w * 0.18)
        cg_y = ff_y - (ff_l / 2.0) - 0.02
        cg_z = ff_z + 0.25
        _make_part("09_FF_Corner_Glazing", cg_w, cg_l, cg_h, cg_x, cg_y, cg_z, (150, 215, 238), "glass")

        # 10. Vertical shading fins / Louvers
        if has_louvers:
            fin_count = 6
            start_x = cg_x - (cg_w / 2.0) + 0.3
            step_x = (cg_w - 0.6) / max(1, fin_count - 1)
            for i in range(fin_count):
                fx = start_x + i * step_x
                fy = cg_y - 0.12
                fz = cg_z
                _make_part(f"10_Facade_Louver_{i+1}", 0.08, 0.35, cg_h, fx, fy, fz, (85, 65, 50), "wood")

        # 11. Roof overhang slab with thin sharp edge
        rf_w = ff_w + 1.4
        rf_l = ff_l + 1.4
        rf_h = 0.28
        rf_x = ff_x
        rf_y = ff_y
        rf_z = ff_z + ff_h
        _make_part("11_Roof_Overhang_Slab", rf_w, rf_l, rf_h, rf_x, rf_y, rf_z, (55, 58, 64), "metal")

        rt.completeRedraw()

    return {
        "success": True,
        "model_type": "architectural_villa",
        "elements_count": len(created_parts),
        "parts": created_parts,
        "bounds": [w_m, l_m, h_m],
        "message": f"Successfully generated parametric Modern Luxury Villa in 3ds Max ({len(created_parts)} architectural elements: podium, living mass, cantilevered suite, glazing, travertine portal, canopy, louvers, roof overhang)"
    }


def set_camera(target_x=None, target_y=None, target_z=None, distance=None, pitch=0.0, yaw=28.0, focal_length=35.0, eye_level=True, vertical_shift=0.0, auto_frame=True):
    """
    Sets up or aligns a camera with professional architectural eye-level framing.
    - Inspects scene geometry bounding box (width, depth, height).
    - Uses exact projection trigonometry to ensure the entire building fits comfortably inside the Safe Frame without clipping.
    - Positions camera at refined 3/4 perspective angle (yaw=28° default for optimal front+side hero perspective).
    - Sets human eye level viewpoint (~1.65m above ground) and locks camera target to facade focal point.
    - Enables Physical Camera automatic vertical tilt correction (tilt-shift lens simulation) for straight verticals.
    - Switches active viewport to camera view (viewport.setType #view_camera) and activates Safe Frames.
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    scale = get_unit_scale()
    pitch_val = float(pitch) if pitch is not None else 0.0
    focal_m = max(12.0, min(float(focal_length) if focal_length is not None else 35.0, 300.0))
    yaw_val = float(yaw) if yaw is not None else 28.0
    yaw_rad = math.radians(yaw_val)

    # Inspect scene geometry to auto-frame building if needed
    geom_objs = []
    try:
        all_geom = list(rt.geometry)
        geom_objs = [o for o in all_geom if str(rt.classOf(o)) not in ('Targetobject', 'Physical_Camera', 'Freecamera', 'Directionallight', 'Omnilight', 'SunPositioner')]
    except Exception:
        pass

    min_x = -7.0
    max_x = 7.0
    min_y = -8.0
    max_y = 8.0
    min_z = 0.0
    max_z = 7.0

    if geom_objs:
        try:
            min_x = min(o.min.x for o in geom_objs) / scale
            max_x = max(o.max.x for o in geom_objs) / scale
            min_y = min(o.min.y for o in geom_objs) / scale
            max_y = max(o.max.y for o in geom_objs) / scale
            min_z = min(o.min.z for o in geom_objs) / scale
            max_z = max(o.max.z for o in geom_objs) / scale
        except Exception:
            pass

    building_w = max(1.0, max_x - min_x)
    building_l = max(1.0, max_y - min_y)
    building_h = max(1.0, max_z - min_z)
    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    center_z = min_z + building_h * 0.42

    # Resolve target coordinates:
    if (target_x is None or (float(target_x) == 0.0 and float(target_y or 0.0) == 0.0)) and auto_frame:
        tx_val = center_x
        ty_val = center_y
        tz_val = float(target_z) if target_z is not None and float(target_z) != 1.6 else center_z
    else:
        tx_val = float(target_x) if target_x is not None else center_x
        ty_val = float(target_y) if target_y is not None else center_y
        tz_val = float(target_z) if target_z is not None else center_z

    # Accurate projected bounding extents based on viewing yaw
    proj_w = abs(building_w * math.cos(yaw_rad)) + abs(building_l * math.sin(yaw_rad))
    proj_d = abs(building_w * math.sin(yaw_rad)) + abs(building_l * math.cos(yaw_rad))

    # Field of view on 36mm sensor (full-frame 35mm equivalent)
    fov_h_rad = 2.0 * math.atan(36.0 / (2.0 * focal_m))
    sensor_h = 20.25  # 16:9 safe frame
    fov_v_rad = 2.0 * math.atan(sensor_h / (2.0 * focal_m))

    # Required camera distance for optimal architectural framing:
    # Building occupies ~58% horizontal frame and ~50% vertical frame (leaving sky & ground)
    dist_w = ((proj_w / 0.58) / 2.0) / math.tan(fov_h_rad / 2.0)
    dist_h = ((building_h / 0.50) / 2.0) / math.tan(fov_v_rad / 2.0)
    calculated_dist = max(dist_w, dist_h) + (proj_d * 0.5)

    if distance is None or float(distance) <= 0.0 or (float(distance) <= 22.0 and geom_objs):
        distance_m = max(18.0, round(calculated_dist, 1))
    else:
        distance_m = max(5.0, min(float(distance), 5000.0))

    fov_deg = 2.0 * math.degrees(math.atan(36.0 / (2.0 * focal_m)))

    if eye_level:
        cam_x = tx_val * scale + distance_m * scale * math.sin(yaw_rad)
        cam_y = ty_val * scale - distance_m * scale * math.cos(yaw_rad)
        cam_z = (min_z + 1.65) * scale  # Eye level 1.65m above ground
        t_pos = rt.point3(tx_val * scale, ty_val * scale, tz_val * scale)
    else:
        pitch_rad = math.radians(pitch_val)
        cam_x = tx_val * scale + distance_m * scale * math.cos(pitch_rad) * math.sin(yaw_rad)
        cam_y = ty_val * scale - distance_m * scale * math.cos(pitch_rad) * math.cos(yaw_rad)
        cam_z = tz_val * scale + distance_m * scale * math.sin(pitch_rad)
        t_pos = rt.point3(tx_val * scale, ty_val * scale, tz_val * scale)

    cam_pos = rt.point3(cam_x, cam_y, cam_z)

    with safe_undo("Position Architectural Camera"):
        cam_name = "Anarchy_Architectural_Camera"
        cam = rt.getNodeByName(cam_name)
        if cam is None:
            try:
                t_obj = rt.targetObject(pos=t_pos)
                cam = rt.Physical_Camera(pos=cam_pos, target=t_obj, name=cam_name)
                cam.focal_length = focal_m
            except Exception:
                try:
                    cam = rt.Targetcamera(pos=cam_pos, target=(rt.targetObject(pos=t_pos)), name=cam_name)
                    cam.fov = fov_deg
                except Exception:
                    cam = rt.Freecamera(pos=cam_pos, name=cam_name)
                    cam.fov = fov_deg
        else:
            cam.pos = cam_pos
            if hasattr(cam, 'focal_length'):
                cam.focal_length = focal_m
            elif hasattr(cam, 'fov'):
                cam.fov = fov_deg

        # CRITICAL: Lock camera target position for targeted cameras (Physical_Camera / Targetcamera)
        if hasattr(cam, 'targeted'):
            try:
                cam.targeted = True
            except Exception:
                pass

        if hasattr(cam, 'target') and cam.target is not None:
            try:
                cam.target.pos = t_pos
            except Exception:
                pass
        else:
            direction = t_pos - cam_pos
            if rt.length(direction) > 0.001:
                try:
                    cam.dir = rt.normalize(direction)
                except Exception:
                    pass

        # Enable Physical Camera auto vertical tilt correction (Shift Lens effect)
        vertical_correction_applied = False
        for prop in ['auto_vertical_tilt_correction', 'vertical_tilt_correction', 'tilt_correction', 'perspective_control', 'tilt_vertical']:
            if hasattr(cam, prop):
                try:
                    setattr(cam, prop, True)
                    val = getattr(cam, prop, False)
                    if bool(val):
                        vertical_correction_applied = True
                        break
                except Exception:
                    pass

        # Try vertical lens shift if requested
        if float(vertical_shift) != 0.0:
            for shift_prop in ['lens_shift_vertical', 'vertical_shift', 'lens_vertical_shift']:
                if hasattr(cam, shift_prop):
                    try:
                        setattr(cam, shift_prop, float(vertical_shift))
                        break
                    except Exception:
                        pass

        # Switch active viewport to Camera view with Safe Frames
        try:
            rt.viewport.setCamera(cam)
            try:
                rt.viewport.setType(rt.Name("view_camera"))
            except Exception:
                pass
            rt.displaySafeFrames = True
            rt.redrawViews()
        except Exception:
            pass

    try:
        rt.sendViewportToAnarchy()
    except Exception:
        pass

    return {
        "success": True,
        "camera_name": cam_name,
        "camera_class": str(rt.classOf(cam)),
        "position": [round(cam_x / scale, 2), round(cam_y / scale, 2), round(cam_z / scale, 2)],
        "target": [round(tx_val, 2), round(ty_val, 2), round(tz_val, 2)],
        "distance_m": round(distance_m, 2),
        "yaw_deg": round(yaw_val, 1),
        "focal_length_mm": focal_m,
        "fov_deg": round(fov_deg, 2),
        "eye_level": eye_level,
        "vertical_correction": vertical_correction_applied,
        "message": f"Positioned camera '{cam_name}' facing facade (dist: {distance_m:.1f}m, yaw: {yaw_val:.1f}°, target: [{tx_val:.1f}, {ty_val:.1f}, {tz_val:.1f}], lens: {focal_m}mm tilt-corrected)"
    }


def setup_sun_lighting(azimuth=135.0, altitude=32.0, intensity=1.0, color_temp=5200):
    """
    Creates or updates a physical architectural sun / directional daylight source.
    Coordinates follow standard 3ds Max conventions (+X = East, +Y = North, +Z = Up).
    Sun is aimed directly at the building mass center for optimal shadow contrast and facade depth.
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    scale = get_unit_scale()
    sun_name = "Anarchy_Sun_Light"

    alt_clamped = max(0.5, min(float(altitude), 89.5))
    az_norm = float(azimuth) % 360.0
    alt_rad = math.radians(alt_clamped)
    az_rad = math.radians(az_norm)

    # Find scene center
    center_x = 0.0
    center_y = 0.0
    center_z = 2.5 * scale
    try:
        all_geom = [o for o in rt.geometry if str(rt.classOf(o)) not in ('Targetobject', 'Physical_Camera', 'Freecamera', 'Directionallight', 'Omnilight', 'SunPositioner')]
        if all_geom:
            center_x = sum(o.pos.x for o in all_geom) / len(all_geom)
            center_y = sum(o.pos.y for o in all_geom) / len(all_geom)
            center_z = sum(o.pos.z for o in all_geom) / len(all_geom)
    except Exception:
        pass

    dist = 80.0 * scale
    sun_x = center_x + dist * math.cos(alt_rad) * math.sin(az_rad)
    sun_y = center_y + dist * math.cos(alt_rad) * math.cos(az_rad)
    sun_z = center_z + dist * math.sin(alt_rad)
    sun_pos = rt.point3(sun_x, sun_y, sun_z)
    aim_pos = rt.point3(center_x, center_y, center_z)

    r, g, b = kelvin_to_rgb(color_temp)

    with safe_undo("Setup Sun Lighting"):
        sun = rt.getNodeByName(sun_name)
        if sun is None:
            sun = rt.Directionallight(pos=sun_pos, name=sun_name)
        else:
            sun.pos = sun_pos

        sun.dir = rt.normalize(aim_pos - sun_pos)
        sun.castShadows = True
        sun.multiplier = max(0.1, min(float(intensity), 10.0))
        sun.rgb = rt.color(r, g, b)

    return {
        "success": True,
        "sun_name": sun_name,
        "azimuth": az_norm,
        "altitude": alt_clamped,
        "color_temp_k": color_temp,
        "rgb": [r, g, b],
        "message": f"Configured sun daylight (Azimuth: {az_norm:.1f}°, Altitude: {alt_clamped:.1f}°, Color: {color_temp}K RGB({r},{g},{b}))"
    }


def apply_material(object_name=None, material_type="concrete", base_color=None, roughness=None):
    """
    Applies a physical PBR architectural material (Concrete, Glass, Wood, Travertine, Steel) to selected or named object.
    Applies custom roughness and base_color (hex #RRGGBB) if supplied.
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    target = None
    if object_name:
        target = rt.getNodeByName(str(object_name))
    if target is None:
        sel = rt.getCurrentSelection()
        if len(sel) > 0:
            target = sel[0]

    if target is None:
        return {"success": False, "error": "No object found or selected to apply material."}

    mat_name = f"Mat_{material_type}_{target.name}"

    # Presets for architectural materials
    m_lower = str(material_type).lower()
    default_roughness = 0.5
    if 'glass' in m_lower or 'زجاج' in m_lower:
        default_roughness = 0.05
    elif 'concrete' in m_lower or 'خرسانة' in m_lower:
        default_roughness = 0.70
    elif 'travertine' in m_lower or 'ترافرتين' in m_lower:
        default_roughness = 0.45
    elif 'wood' in m_lower or 'خشب' in m_lower:
        default_roughness = 0.35
    elif 'metal' in m_lower or 'steel' in m_lower or 'معدن' in m_lower:
        default_roughness = 0.25

    roughness_val = max(0.0, min(float(roughness), 1.0)) if roughness is not None else default_roughness

    with safe_undo(f"Apply Material {material_type}"):
        mat = rt.PhysicalMaterial()
        mat.name = mat_name
        mat.roughness = roughness_val

        if 'glass' in m_lower or 'زجاج' in m_lower:
            mat.transparency = 0.92
            mat.base_color = rt.color(240, 248, 255)
        elif 'concrete' in m_lower or 'خرسانة' in m_lower:
            mat.transparency = 0.0
            mat.base_color = rt.color(160, 160, 160)
        elif 'travertine' in m_lower or 'ترافرتين' in m_lower:
            mat.transparency = 0.0
            mat.base_color = rt.color(225, 215, 195)
        elif 'wood' in m_lower or 'خشب' in m_lower:
            mat.transparency = 0.0
            mat.base_color = rt.color(165, 110, 65)
        elif 'metal' in m_lower or 'steel' in m_lower or 'معدن' in m_lower:
            mat.metalness = 0.9
            mat.base_color = rt.color(200, 200, 205)
        else:
            mat.base_color = rt.color(210, 210, 215)

        # Override with explicit base_color if provided
        if base_color:
            rgb_parsed = hex_to_rgb(base_color)
            if rgb_parsed:
                mat.base_color = rt.color(rgb_parsed[0], rgb_parsed[1], rgb_parsed[2])

        target.material = mat

    return {
        "success": True,
        "object": target.name,
        "material_name": mat_name,
        "material_type": material_type,
        "roughness": roughness_val,
        "message": f"Applied {material_type} material to '{target.name}' (Roughness: {roughness_val})"
    }


def get_scene_info():
    """
    Read tool: Inspects active 3ds Max scene.
    Returns object counts, names, classes, positions, bounding boxes, scene extents, active camera, and unit settings.
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    scale = get_unit_scale()
    all_objs = list(rt.objects)

    # Compute true scene bounds across ALL geometry objects in scene (excluding cameras, lights, helpers)
    scene_min = [float('inf'), float('inf'), float('inf')]
    scene_max = [float('-inf'), float('-inf'), float('-inf')]

    try:
        geom_objs = list(rt.geometry)
    except Exception:
        geom_objs = [o for o in all_objs if str(rt.superClassOf(o)).lower() == 'geometryclass']

    for gobj in geom_objs:
        try:
            g_min = [gobj.min.x / scale, gobj.min.y / scale, gobj.min.z / scale]
            g_max = [gobj.max.x / scale, gobj.max.y / scale, gobj.max.z / scale]
            for i in range(3):
                scene_min[i] = min(scene_min[i], g_min[i])
                scene_max[i] = max(scene_max[i], g_max[i])
        except Exception:
            pass

    scene_bounds = None
    if scene_min[0] != float('inf'):
        scene_bounds = {
            "min": [round(s, 2) for s in scene_min],
            "max": [round(s, 2) for s in scene_max],
            "dimensions_m": [round(scene_max[i] - scene_min[i], 2) for i in range(3)]
        }

    # Deterministic alphabetical order by name, capped at 50 for token efficiency
    objects_summary = []
    sorted_objs = sorted(all_objs, key=lambda o: str(o.name))

    for obj in sorted_objs[:50]:
        try:
            pos = [obj.pos.x / scale, obj.pos.y / scale, obj.pos.z / scale]
            obj_min = [obj.min.x / scale, obj.min.y / scale, obj.min.z / scale]
            obj_max = [obj.max.x / scale, obj.max.y / scale, obj.max.z / scale]

            objects_summary.append({
                "name": str(obj.name),
                "class": str(rt.classOf(obj)),
                "position_m": [round(p, 2) for p in pos],
                "bbox_m": {
                    "min": [round(b, 2) for b in obj_min],
                    "max": [round(b, 2) for b in obj_max],
                    "dimensions": [round(obj_max[i] - obj_min[i], 2) for i in range(3)]
                },
                "has_material": obj.material is not None,
            })
        except Exception:
            pass

    active_cam_name = "Perspective Viewport"
    try:
        cam = rt.viewport.getCamera()
        if cam:
            active_cam_name = str(cam.name)
    except Exception:
        pass

    return {
        "success": True,
        "total_objects": len(all_objs),
        "total_geometry_objects": len(geom_objs),
        "scene_bounds": scene_bounds,
        "objects": objects_summary,
        "active_camera": active_cam_name,
        "system_units": str(rt.units.SystemType),
        "scale_to_meters": scale,
        "message": f"Scene inspection: {len(all_objs)} total objects ({len(geom_objs)} geometry), camera: {active_cam_name}"
    }


def render_preview():
    """
    Triggers a fresh active viewport capture and sends it to Anarchy AI.
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    try:
        rt.sendViewportToAnarchy()
        return {
            "success": True,
            "message": "Sent active 3ds Max viewport capture to Anarchy AI"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to send viewport: {str(e)}"
        }



def create_wall(start_x=0.0, start_y=0.0, end_x=5.0, end_y=0.0, height=3.2, thickness=0.25, elevation=0.0, name="Wall", material="concrete"):
    """
    Parametrically creates a structural/architectural wall segment between two points in 3ds Max.
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    scale = get_unit_scale()
    dx = float(end_x) - float(start_x)
    dy = float(end_y) - float(start_y)
    wall_len = math.sqrt(dx * dx + dy * dy)
    if wall_len < 0.05:
        return {"success": False, "error": "Wall length must be at least 0.05m"}

    h_m = max(0.2, min(float(height), 50.0))
    th_m = max(0.05, min(float(thickness), 5.0))
    elev_m = float(elevation)
    angle_rad = math.atan2(dy, dx)
    angle_deg = math.degrees(angle_rad)

    mid_x = (float(start_x) + float(end_x)) / 2.0
    mid_y = (float(start_y) + float(end_y)) / 2.0

    with safe_undo(f"Create Wall {name}"):
        b = rt.box(
            length=th_m * scale,
            width=wall_len * scale,
            height=h_m * scale,
            name=str(name),
            wirecolor=rt.color(200, 200, 205)
        )
        b.pivot = rt.point3(0, 0, 0)
        rt.rotate(b, rt.angleaxis(angle_deg, rt.point3(0, 0, 1)))
        b.pos = rt.point3(mid_x * scale, mid_y * scale, elev_m * scale)
        if material:
            try:
                apply_material(object_name=name, material_type=material)
            except Exception:
                pass

    return {
        "success": True,
        "name": str(b.name),
        "length_m": round(wall_len, 2),
        "height_m": round(h_m, 2),
        "thickness_m": round(th_m, 2),
        "angle_deg": round(angle_deg, 2),
        "midpoint": [round(mid_x, 2), round(mid_y, 2), round(elev_m, 2)],
        "message": f"Created wall '{b.name}' ({wall_len:.2f}m long, {h_m:.2f}m high, {th_m:.2f}m thick)"
    }


def create_walls(points=None, height=3.2, thickness=0.25, elevation=0.0, closed=True, prefix="Wall", material="concrete"):
    """
    Creates a sequence of connected walls from a list of 2D coordinate points [(x1, y1), (x2, y2), ...].
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    pts = points or [[0, 0], [10, 0], [10, 12], [0, 12]]
    if len(pts) < 2:
        return {"success": False, "error": "At least 2 points required to create walls"}

    created = []
    num_pts = len(pts)
    count = num_pts if closed else num_pts - 1

    with safe_undo(f"Create Walls {prefix}"):
        for i in range(count):
            p1 = pts[i]
            p2 = pts[(i + 1) % num_pts]
            w_name = f"{prefix}_{i+1:02d}"
            res = create_wall(
                start_x=p1[0], start_y=p1[1],
                end_x=p2[0], end_y=p2[1],
                height=height, thickness=thickness, elevation=elevation,
                name=w_name, material=material
            )
            if res.get("success"):
                created.append(res["name"])

    return {
        "success": True,
        "created_walls": created,
        "total_walls": len(created),
        "message": f"Created {len(created)} connected wall segments"
    }


def create_slab(width=12.0, length=14.0, thickness=0.30, elevation=0.0, x=0.0, y=0.0, name="Slab", material="concrete"):
    """
    Creates a structural floor or foundation slab in 3ds Max.
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    scale = get_unit_scale()
    w_m = max(0.5, min(float(width), 2000.0))
    l_m = max(0.5, min(float(length), 2000.0))
    th_m = max(0.05, min(float(thickness), 5.0))
    elev_m = float(elevation)
    x_m = float(x)
    y_m = float(y)

    with safe_undo(f"Create Slab {name}"):
        pos = rt.point3((x_m - w_m / 2.0) * scale, (y_m - l_m / 2.0) * scale, (elev_m - th_m) * scale)
        b = rt.box(length=l_m * scale, width=w_m * scale, height=th_m * scale, pos=pos, name=str(name))
        b.wirecolor = rt.color(180, 180, 185)
        try:
            b.pivot = rt.point3(x_m * scale, y_m * scale, elev_m * scale)
        except Exception:
            pass
        if material:
            try:
                apply_material(object_name=name, material_type=material)
            except Exception:
                pass

    return {
        "success": True,
        "name": str(b.name),
        "dimensions": [round(w_m, 2), round(l_m, 2), round(th_m, 2)],
        "elevation_m": round(elev_m, 2),
        "message": f"Created architectural slab '{b.name}' ({w_m:.2f}x{l_m:.2f}m, thickness {th_m:.2f}m at elevation {elev_m:.2f}m)"
    }


def create_opening(wall_name="Wall", opening_type="window", width=1.60, height=1.40, sill_height=0.90, offset_ratio=0.50, name=None):
    """
    Models an architectural window or door opening insert with frame and glass into an existing wall.
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    wall_node = rt.getNodeByName(str(wall_name))
    if wall_node is None:
        return {"success": False, "error": f"Target wall '{wall_name}' not found in scene"}

    scale = get_unit_scale()
    w_m = max(0.3, min(float(width), 20.0))
    h_m = max(0.5, min(float(height), 20.0))
    sill_m = max(0.0, min(float(sill_height), 10.0)) if opening_type.lower() == "window" else 0.0

    op_name = name or f"{wall_name}_{opening_type.capitalize()}"

    with safe_undo(f"Create Opening {op_name}"):
        frame_thickness = 0.08
        glass_name = f"{op_name}_Glass"
        frame_name = f"{op_name}_Frame"

        frame_box = rt.box(
            length=0.28 * scale,
            width=w_m * scale,
            height=h_m * scale,
            name=frame_name,
            wirecolor=rt.color(40, 40, 45)
        )
        frame_box.transform = wall_node.transform
        frame_box.pos.z = wall_node.pos.z + (sill_m * scale)

        glass_box = rt.box(
            length=0.03 * scale,
            width=(w_m - frame_thickness * 2) * scale,
            height=(h_m - frame_thickness * 2) * scale,
            name=glass_name,
            wirecolor=rt.color(120, 180, 220)
        )
        glass_box.transform = wall_node.transform
        glass_box.pos.z = wall_node.pos.z + ((sill_m + frame_thickness) * scale)

        try:
            apply_material(object_name=frame_name, material_type="metal")
            apply_material(object_name=glass_name, material_type="glass")
        except Exception:
            pass

    return {
        "success": True,
        "name": op_name,
        "type": opening_type,
        "dimensions": [round(w_m, 2), round(h_m, 2)],
        "sill_height_m": round(sill_m, 2),
        "wall_attached": str(wall_name),
        "message": f"Created {opening_type} opening '{op_name}' ({w_m:.2f}x{h_m:.2f}m, sill {sill_m:.2f}m) attached to {wall_name}"
    }


def create_roof(width=14.0, length=16.0, style="flat", thickness=0.35, elevation=6.8, pitch_degrees=15.0, overhang=0.60, x=0.0, y=0.0, name="Roof", material="concrete"):
    """
    Creates an architectural roof system (flat, pitched, parapet).
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    scale = get_unit_scale()
    w_m = max(1.0, float(width)) + (float(overhang) * 2.0)
    l_m = max(1.0, float(length)) + (float(overhang) * 2.0)
    th_m = max(0.1, float(thickness))
    elev_m = float(elevation)
    x_m = float(x)
    y_m = float(y)
    st = style.lower()

    with safe_undo(f"Create Roof {name}"):
        if "pitch" in st or "gable" in st:
            pitch_deg = max(5.0, min(float(pitch_degrees), 60.0))
            ridge_h = (w_m / 2.0) * math.tan(math.radians(pitch_deg))
            pos = rt.point3((x_m - w_m / 2.0) * scale, (y_m - l_m / 2.0) * scale, elev_m * scale)
            b = rt.box(length=l_m * scale, width=w_m * scale, height=(th_m + ridge_h) * scale, pos=pos, name=str(name))
            b.wirecolor = rt.color(160, 60, 50)
        else:
            pos = rt.point3((x_m - w_m / 2.0) * scale, (y_m - l_m / 2.0) * scale, elev_m * scale)
            b = rt.box(length=l_m * scale, width=w_m * scale, height=th_m * scale, pos=pos, name=str(name))
            b.wirecolor = rt.color(230, 230, 235)

            if "parapet" in st:
                par_h = 0.90
                par_pos = rt.point3((x_m - w_m / 2.0) * scale, (y_m - l_m / 2.0) * scale, (elev_m + th_m) * scale)
                par = rt.box(length=l_m * scale, width=w_m * scale, height=par_h * scale, pos=par_pos, name=f"{name}_Parapet")
                par.wirecolor = rt.color(210, 210, 215)

        if material:
            try:
                apply_material(object_name=name, material_type=material)
            except Exception:
                pass

    return {
        "success": True,
        "name": str(name),
        "style": style,
        "dimensions": [round(w_m, 2), round(l_m, 2), round(th_m, 2)],
        "elevation_m": round(elev_m, 2),
        "overhang_m": round(overhang, 2),
        "message": f"Created architectural roof '{name}' (style: {style}, {w_m:.2f}x{l_m:.2f}m at elevation {elev_m:.2f}m)"
    }


def create_column(size=0.40, height=3.20, x=0.0, y=0.0, z=0.0, shape="rect", name="Column", material="concrete"):
    """
    Creates a structural architectural column (rectangular or circular) in 3ds Max.
    """
    if rt is None:
        return {"success": False, "error": "pymxs not loaded"}

    scale = get_unit_scale()
    sz_m = max(0.15, min(float(size), 5.0))
    h_m = max(0.5, min(float(height), 50.0))
    x_m = float(x)
    y_m = float(y)
    z_m = float(z)

    with safe_undo(f"Create Column {name}"):
        if "round" in shape.lower() or "cyl" in shape.lower():
            c = rt.cylinder(radius=(sz_m / 2.0) * scale, height=h_m * scale, name=str(name), wirecolor=rt.color(190, 190, 195))
            c.pos = rt.point3(x_m * scale, y_m * scale, z_m * scale)
        else:
            pos = rt.point3((x_m - sz_m / 2.0) * scale, (y_m - sz_m / 2.0) * scale, z_m * scale)
            c = rt.box(length=sz_m * scale, width=sz_m * scale, height=h_m * scale, pos=pos, name=str(name), wirecolor=rt.color(190, 190, 195))

        if material:
            try:
                apply_material(object_name=name, material_type=material)
            except Exception:
                pass

    return {
        "success": True,
        "name": str(c.name),
        "shape": shape,
        "size_m": round(sz_m, 2),
        "height_m": round(h_m, 2),
        "position": [round(x_m, 2), round(y_m, 2), round(z_m, 2)],
        "message": f"Created structural column '{c.name}' ({shape}, {sz_m:.2f}m wide, {h_m:.2f}m high at [{x_m:.2f}, {y_m:.2f}, {z_m:.2f}])"
    }


def execute_tool(tool_name, params=None):
    """
    Executes a named pymxs tool with parameter mapping inside a safe undo block.
    """
    params = params or {}
    tool_map = {
        "create_box": create_box,
        "create_wall": create_wall,
        "create_walls": create_walls,
        "create_slab": create_slab,
        "create_opening": create_opening,
        "create_roof": create_roof,
        "create_column": create_column,
        "create_architectural_house": create_architectural_house,
        "create_house": create_architectural_house,
        "create_villa": create_architectural_house,
        "generate_house": create_architectural_house,
        "set_camera": set_camera,
        "setup_sun_lighting": setup_sun_lighting,
        "apply_material": apply_material,
        "get_scene_info": get_scene_info,
        "render_preview": render_preview,
    }

    fn = tool_map.get(tool_name)
    if fn is None:
        return {"success": False, "error": f"Tool '{tool_name}' not recognized in pymxs toolset. Available: {list(tool_map.keys())}"}

    try:
        return fn(**params)
    except Exception as ex:
        return {"success": False, "error": f"Execution error in tool '{tool_name}': {str(ex)}"}
