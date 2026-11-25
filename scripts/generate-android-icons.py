import os
import re
from PIL import Image, ImageDraw

LOGO_PATH = os.path.join("www", "logo.png")
RES_DIR = os.path.join("android", "app", "src", "main", "res")
MANIFEST_PATH = os.path.join("android", "app", "src", "main", "AndroidManifest.xml")
BG_COLOR = (255, 253, 247, 255)  # Growly Warm White #FFFDF7

DENSITIES = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}


def fit_on_canvas(logo: Image.Image, canvas_size: int, inner_ratio: float, bg_rgba) -> Image.Image:
    canvas = Image.new("RGBA", (canvas_size, canvas_size), bg_rgba)
    target = int(canvas_size * inner_ratio)
    copy = logo.copy()
    copy.thumbnail((target, target), Image.Resampling.LANCZOS)
    x = (canvas_size - copy.width) // 2
    y = (canvas_size - copy.height) // 2
    canvas.paste(copy, (x, y), copy)
    return canvas


def make_round(img: Image.Image) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, img.size[0], img.size[1]), fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    if not os.path.exists(LOGO_PATH):
        raise FileNotFoundError(f"Logo not found at {LOGO_PATH}")

    logo = Image.open(LOGO_PATH).convert("RGBA")

    for folder, (legacy_size, fg_size) in DENSITIES.items():
        out_dir = os.path.join(RES_DIR, folder)
        os.makedirs(out_dir, exist_ok=True)

        sq = fit_on_canvas(logo, legacy_size, 0.80, BG_COLOR)
        sq.save(os.path.join(out_dir, "ic_launcher.png"), "PNG")

        rnd = make_round(fit_on_canvas(logo, legacy_size, 0.76, BG_COLOR))
        rnd.save(os.path.join(out_dir, "ic_launcher_round.png"), "PNG")

        # Adaptive icon foreground has 66% safe zone inside 108dp
        fg = fit_on_canvas(logo, fg_size, 0.58, (0, 0, 0, 0))
        fg.save(os.path.join(out_dir, "ic_launcher_foreground.png"), "PNG")

    # Set adaptive icon background color to Growly Warm White (#FFFDF7)
    values_dir = os.path.join(RES_DIR, "values")
    os.makedirs(values_dir, exist_ok=True)
    bg_xml = os.path.join(values_dir, "ic_launcher_background.xml")
    with open(bg_xml, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFDF7</color>\n</resources>\n')

    # Ensure POST_NOTIFICATIONS & SCHEDULE_EXACT_ALARM permissions exist in AndroidManifest.xml
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = f.read()
        perms = [
            '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
            '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
        ]
        for p in perms:
            if p.strip() not in manifest:
                manifest = re.sub(r'(<manifest[^>]*>)', r'\1\n' + p, manifest, count=1)
        with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
            f.write(manifest)

    print("Generated Tutor Grow Android launcher icons & notification permissions successfully.")


if __name__ == "__main__":
    main()
