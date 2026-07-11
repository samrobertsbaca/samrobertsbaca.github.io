#!/usr/bin/env python3
"""
compress_images.py

Compresses a PNG image or all PNG images in a directory to a max file size of 10MB,
saving results to a 'compressed_<max_size>MB' subdirectory.

If the --webp option is enabled, it converts the output format to .webp and 
uses WebP quality reduction before resorting to downscaling.

Usage:
    python compress_images.py <input_path>
    python compress_images.py <input_path> --max-size 5  # custom max size in MB
    python compress_images.py <input_path> --webp        # convert to compressed webp
"""

import io
import sys
import argparse
import shutil
from pathlib import Path
from PIL import Image

SUPPORTED_EXTENSIONS = {".png"}


def get_file_size_mb(filepath: Path) -> float:
    return filepath.stat().st_size / (1024 * 1024)


def try_save(img: Image.Image, fmt_kwargs: dict) -> bytes:
    buf = io.BytesIO()
    img.save(buf, **fmt_kwargs)
    return buf.getvalue()


def compress_to_webp(input_path: Path, output_path: Path, max_size_mb: float = 10.0):
    """
    Convert and compress a PNG to a WebP file under max_size_mb using quality steps,
    then resolution downscaling if necessary.
    """
    max_bytes = max_size_mb * 1024 * 1024
    img = Image.open(input_path)

    # --- Step 1: Quality Reduction ---
    # Try high quality down to low quality in steps of 5
    for quality in range(100, 9, -5):
        base_kwargs = dict(format="WEBP", quality=quality, method=6) # method 6 is slowest/best compression
        data = try_save(img, base_kwargs)
        if len(data) <= max_bytes:
            output_path.write_bytes(data)
            print(f"  ✓ WebP conversion successful at quality {quality} "
                  f"({len(data)/(1024*1024):.2f} MB)")
            return

    # --- Step 2: Resolution downscaling (Fallback if quality 10 is still too big) ---
    scale = 0.9
    while scale >= 0.05:
        new_w = max(1, int(img.width * scale))
        new_h = max(1, int(img.height * scale))
        resized = img.resize((new_w, new_h), Image.LANCZOS)
        
        # Keep WebP quality at a reasonable floor (20) when scaling down
        base_kwargs = dict(format="WEBP", quality=20, method=6)
        data = try_save(resized, base_kwargs)
        if len(data) <= max_bytes:
            output_path.write_bytes(data)
            print(f"  ✓ Scaled to {scale:.0%} — {new_w}x{new_h}px at quality 20 "
                  f"({len(data)/(1024*1024):.2f} MB)")
            return
        scale = round(scale - 0.1, 1)

    # Last resort
    output_path.write_bytes(data)
    final_mb = len(data) / (1024 * 1024)
    warn = "  ⚠️  Still over limit!" if final_mb > max_size_mb else ""
    print(f"  ✓ Saved WebP at minimum scale ({final_mb:.2f} MB){warn}")


def compress_png(input_path: Path, output_path: Path, max_size_mb: float = 10.0):
    """
    Compress a PNG to <= max_size_mb using lossless then lossy strategies.
    """
    original_mb = get_file_size_mb(input_path)

    # Already small enough — copy as-is
    if original_mb <= max_size_mb:
        shutil.copy2(input_path, output_path)
        print(f"  ✓ Already under limit — copied as-is ({original_mb:.2f} MB)")
        return

    max_bytes = max_size_mb * 1024 * 1024
    img = Image.open(input_path)
    has_alpha = img.mode in ("RGBA", "LA", "PA") or (
        img.mode == "P" and "transparency" in img.info
    )

    # --- Step 1: Lossless PNG optimisation (max zlib compression) ---
    base_kwargs = dict(format="PNG", optimize=True, compress_level=9)
    data = try_save(img, base_kwargs)
    if len(data) <= max_bytes:
        output_path.write_bytes(data)
        print(f"  ✓ Lossless optimisation sufficient "
              f"({len(data)/(1024*1024):.2f} MB)")
        return

    # --- Step 2: Palette quantisation + Forced Dithering (fixes gradient banding) ---
    colours = 256
    while colours >= 16:
        if has_alpha:
            rgba_img = img.convert("RGBA")
            alpha = rgba_img.getchannel('A')
            rgb_img = rgba_img.convert("RGB")
            
            palette_map = rgb_img.quantize(colors=colours, method=Image.Quantize.MAXCOVERAGE)
            quantized_rgb = rgb_img.convert("P", dither=Image.FLOYDSTEINBERG, palette=palette_map)
            
            quantized = quantized_rgb.convert("RGBA")
            quantized.putalpha(alpha)
        else:
            rgb_img = img.convert("RGB")
            palette_map = rgb_img.quantize(colors=colours, method=Image.Quantize.MAXCOVERAGE)
            quantized = rgb_img.convert("P", dither=Image.FLOYDSTEINBERG, palette=palette_map)
            
        data = try_save(quantized, base_kwargs)
        if len(data) <= max_bytes:
            output_path.write_bytes(data)
            print(f"  ✓ Dithered palette quantisation to {colours} colours "
                  f"({len(data)/(1024*1024):.2f} MB)")
            return
        colours //= 2

    # --- Step 3: Resolution downscaling ---
    scale = 0.9
    while scale >= 0.05:
        new_w = max(1, int(img.width * scale))
        new_h = max(1, int(img.height * scale))
        resized = img.resize((new_w, new_h), Image.LANCZOS)
        data = try_save(resized, base_kwargs)
        if len(data) <= max_bytes:
            output_path.write_bytes(data)
            print(f"  ✓ Scaled to {scale:.0%} — {new_w}x{new_h}px "
                  f"({len(data)/(1024*1024):.2f} MB)")
            return
        scale = round(scale - 0.1, 1)

    # Last resort
    output_path.write_bytes(data)
    final_mb = len(data) / (1024 * 1024)
    warn = "  ⚠️  Still over limit!" if final_mb > max_size_mb else ""
    print(f"  ✓ Saved at minimum scale ({final_mb:.2f} MB){warn}")


def process_input(input_target: str, max_size_mb: float = 10.0, use_webp: bool = False):
    input_path = Path(input_target).resolve()

    if not input_path.exists():
        print(f"❌ Path not found: {input_path}")
        sys.exit(1)

    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            print(f"❌ Unsupported file format: {input_path.suffix}. Only PNGs are supported as inputs.")
            sys.exit(1)
        images = [input_path]
        base_dir = input_path.parent
    elif input_path.is_dir():
        images = [
            f for f in input_path.iterdir()
            if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
        ]
        base_dir = input_path
    else:
        print(f"❌ Invalid path type: {input_path}")
        sys.exit(1)

    size_suffix = f"{int(max_size_mb)}" if max_size_mb.is_integer() else f"{max_size_mb}"
    folder_name = f"compressed_{size_suffix}MB"
    if use_webp:
        folder_name += "_webp"
        
    output_dir = base_dir / folder_name
    output_dir.mkdir(exist_ok=True)
    
    print(f"📁 Input   : {input_path}")
    print(f"📁 Output  : {output_dir}")
    print(f"📏 Max size: {max_size_mb} MB")
    print(f"🖼️  Format  : {'WEBP' if use_webp else 'PNG'}\n")

    if not images:
        print("⚠️  No supported images found to process.")
        return

    print(f"Found {len(images)} image(s) to process.\n")
    success, skipped = 0, 0

    for img_path in sorted(images):
        stem = img_path.stem
        # Swap extension out if user chose webp
        out_ext = ".webp" if use_webp else img_path.suffix.lower()
        out_name = f"{stem}_compressed{out_ext}"
        out_path = output_dir / out_name

        print(f"→ {img_path.name} ({get_file_size_mb(img_path):.2f} MB)")
        try:
            if use_webp:
                compress_to_webp(img_path, out_path, max_size_mb)
            else:
                compress_png(img_path, out_path, max_size_mb)
            success += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            skipped += 1

    print(f"\n✅ Done! {success} compressed, {skipped} failed.")
    print(f"    Saved to: {output_dir}")


def main():
    parser = argparse.ArgumentParser(
        description="Compress a single PNG image or an entire directory of PNG images to a maximum file size."
    )
    parser.add_argument("input_path", help="Path to a PNG file or a directory containing images")
    parser.add_argument(
        "--max-size", type=float, default=10.0,
        metavar="MB",
        help="Maximum file size in MB (default: 10)"
    )
    parser.add_argument(
        "--webp", action="store_true",
        help="Convert images to highly optimized WebP format instead of keeping them as PNG"
    )
    args = parser.parse_args()
    process_input(args.input_path, args.max_size, args.webp)


if __name__ == "__main__":
    main()