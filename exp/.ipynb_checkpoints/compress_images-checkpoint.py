#!/usr/bin/env python3
"""
compress_images.py

Compresses all PNG images in a directory to a max file size of 10MB,
saving results to a 'compressed_<max_size>MB' subdirectory with '_compressed' appended to filenames.

PNG compression strategy (in order):
  1. Lossless PNG optimization (max zlib compression + filter tuning)
  2. Palette quantization with forced Floyd-Steinberg Dithering (fixes gradient banding)
  3. Resolution downscaling (10% steps) until under the size limit

Usage:
    python compress_images.py <input_directory>
    python compress_images.py <input_directory> --max-size 5  # custom max size in MB
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
            # Separate alpha channel so dithering doesn't bleed into empty spaces
            alpha = rgba_img.getchannel('A')
            rgb_img = rgba_img.convert("RGB")
            
            # 1. Generate an adaptive custom palette map
            palette_map = rgb_img.quantize(colors=colours, method=Image.Quantize.MAXCOVERAGE)
            # 2. Force true Floyd-Steinberg dithering map against that custom palette
            quantized_rgb = rgb_img.convert("P", dither=Image.FLOYDSTEINBERG, palette=palette_map)
            
            # Reattach alpha mask back into RGBA space
            quantized = quantized_rgb.convert("RGBA")
            quantized.putalpha(alpha)
        else:
            rgb_img = img.convert("RGB")
            # 1. Generate an adaptive custom palette map
            palette_map = rgb_img.quantize(colors=colours, method=Image.Quantize.MAXCOVERAGE)
            # 2. Force true Floyd-Steinberg dithering map against that custom palette
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

    # Last resort — save the most-scaled version anyway
    output_path.write_bytes(data)
    final_mb = len(data) / (1024 * 1024)
    warn = " ⚠️  Still over limit!" if final_mb > max_size_mb else ""
    print(f"  ✓ Saved at minimum scale ({final_mb:.2f} MB){warn}")


def process_directory(input_dir: str, max_size_mb: float = 10.0):
    input_path = Path(input_dir).resolve()

    if not input_path.exists():
        print(f"❌ Directory not found: {input_path}")
        sys.exit(1)
    if not input_path.is_dir():
        print(f"❌ Not a directory: {input_path}")
        sys.exit(1)

    # Format the size cleanly (e.g., '10MB' instead of '10.0MB' if it's a whole number)
    size_suffix = f"{int(max_size_mb)}" if max_size_mb.is_integer() else f"{max_size_mb}"
    output_dir = input_path / f"compressed_{size_suffix}MB"
    
    output_dir.mkdir(exist_ok=True)
    print(f"📁 Input  : {input_path}")
    print(f"📁 Output : {output_dir}")
    print(f"📏 Max size: {max_size_mb} MB\n")

    images = [
        f for f in input_path.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not images:
        print("⚠️  No supported images found in the directory.")
        print(f"   Supported formats: {', '.join(SUPPORTED_EXTENSIONS)}")
        return

    print(f"Found {len(images)} image(s) to process.\n")
    success, skipped = 0, 0

    for img_path in sorted(images):
        stem = img_path.stem
        ext = img_path.suffix.lower()
        out_name = f"{stem}_compressed{ext}"
        out_path = output_dir / out_name

        print(f"→ {img_path.name} ({get_file_size_mb(img_path):.2f} MB)")
        try:
            compress_png(img_path, out_path, max_size_mb)
            success += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            skipped += 1

    print(f"\n✅ Done! {success} compressed, {skipped} failed.")
    print(f"   Saved to: {output_dir}")


def main():
    parser = argparse.ArgumentParser(
        description="Compress images in a directory to a maximum file size."
    )
    parser.add_argument("input_dir", help="Path to directory containing images")
    parser.add_argument(
        "--max-size", type=float, default=10.0,
        metavar="MB",
        help="Maximum file size in MB (default: 10)"
    )
    args = parser.parse_args()
    process_directory(args.input_dir, args.max_size)


if __name__ == "__main__":
    main()