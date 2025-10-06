---
layout: post
title: "Building a Robust Multi-File Steganography Tool in Python"
subtitle: "Hiding Multiple Secrets within Images using LSB Manipulation and Python"
tags: [steganography, security, python, image processing, LSB, data hiding, cryptography]
author: Lester Knight Chaykin
comments: true
mathjax: false
readtime: true
date: 2025-10-06 16:00:00 +0000
---

## Introduction

Steganography, derived from the Greek words *steganos* (covered) and *graphein* (to write), is the art and science of concealing a message, image, or file within another message, image, or file. Unlike cryptography, which aims to make a message unreadable to unauthorized parties, steganography's goal is to hide the very *existence* of the communication. In a world saturated with digital media, steganography offers a fascinating way to embed hidden information, often leveraging the subtle redundancies in common file formats.

In this post, we'll dive deep into building a Python-based steganography tool, `steg.py`, that can hide not just one, but *multiple* files within a PNG image. We'll explore the underlying principles, the implementation details, and take a candid look at the debugging journey that shaped its robustness.

## The Core Principle: Least Significant Bit (LSB) Steganography

Our `steg.py` tool utilizes the Least Significant Bit (LSB) technique. Digital images are composed of pixels, and each pixel is typically represented by a combination of color channels (e.g., Red, Green, Blue, and sometimes Alpha for transparency). Each channel's intensity is usually stored as an 8-bit value (0-255).'

The LSB technique involves modifying the least significant bit of each color channel in selected pixels. Changing the LSB of an 8-bit value (e.g., changing `1010101**0**` to `1010101**1**`) results in a change of only 1 in the decimal value, which is usually imperceptible to the human eye. By systematically replacing these LSBs with the binary data of our secret files, we can embed information without significantly altering the image's visual appearance.

PNG (Portable Network Graphics) is an ideal format for LSB steganography because it is a **lossless** compression format. This means that when a PNG image is saved, no pixel data is discarded, ensuring that our carefully embedded LSBs remain intact. Lossy formats like JPEG, on the other hand, would likely destroy the hidden data during compression.

## Design & Data Structure for Multi-File Embedding

The primary challenge for hiding multiple files is not just embedding their raw data, but also embedding enough metadata to correctly reconstruct each file upon extraction. This includes knowing how many files are hidden, their original filenames, and their respective sizes. We achieve this by constructing a structured binary bitstream that is then embedded into the image.

Our `binary_data` structure is as follows:

1.  **`MAGIC_NUMBER` (16 bits):** A unique binary sequence (`0101010101010101`) prepended to the entire hidden data. This acts as a signature, allowing the tool to quickly determine if an image contains hidden data and prevent false positives when inspecting unencoded images.
2.  **`num_files` (8 bits):** Represents the total count of files hidden within the image (supports up to 255 files).
3.  **For each hidden file, the following metadata and data are interleaved:**
    *   **`filename_len` (8 bits):** The length of the filename in bytes.
    *   **`filename_bits`:** The binary representation of the filename (UTF-8 encoded).
    *   **`data_len` (64 bits):** The length of the file's content in *bits*.
    *   **`file_bits`:** The actual binary content of the hidden file.

This interleaved structure is crucial for sequential extraction, as each file's metadata immediately precedes its data.

A critical aspect of the design is the **capacity check**. Before embedding, the tool calculates the total number of bits required for all metadata and file contents and compares it against the image's total LSB capacity (`width * height * 3` bits for an RGBA image). If the required bits exceed capacity, the embedding process is aborted, preventing data truncation and corruption.

## Implementation Details (`steg.py`)

The `steg.py` script is built around three core functions: `encode`, `decode`, and `list_hidden_files`, along with helper functions for bit manipulation.

### Helper Functions

*   **`file_to_bits(file_path)`:** Reads a file in binary mode and converts its entire content into a single binary string (e.g., `01011010...`).
*   **`bits_to_file(bits, output_file)`:** Takes a binary string and writes it to a file, converting 8-bit chunks back into bytes.

### `encode(input_image_path, output_image_path, file_paths)`

This function orchestrates the embedding process:

1.  **Image Loading:** Opens the `input_image.png` using PIL (Pillow) and converts it to RGBA format.
2.  **Metadata Assembly:**
    *   Defines the `MAGIC_NUMBER`.
    *   Calculates `num_files_bits`.
    *   Iterates through each `file_path` provided:
        *   Extracts filename, encodes it to UTF-8, and gets its length in bits.
        *   Converts file content to bits and gets its length in bits.
        *   Appends `filename_len_bits`, `filename_bits`, `data_len_bits`, and `file_bits` sequentially to the main `binary_data` stream.
3.  **Capacity Check:** Compares `len(binary_data)` against `image_capacity_bits`.
4.  **LSB Embedding:** Iterates through each pixel of the image. For each pixel's R, G, and B channels, it replaces the LSB with the next bit from `binary_data`.
5.  **Saving:** Saves the modified image as `output_image_path`.

```python
# Excerpt from encode function
def encode(input_image_path, output_image_path, file_paths):
    img = Image.open(input_image_path).convert("RGBA")
    encoded = img.copy()
    width, height = img.size
    index = 0

    MAGIC_NUMBER = "0101010101010101" # 16 bits
    num_files = len(file_paths)
    if num_files > 255:
        print("Error: Cannot hide more than 255 files.")
        sys.exit(1)
    num_files_bits = format(num_files, '08b')

    binary_data = MAGIC_NUMBER + num_files_bits
    
    for file_path in file_paths:
        filename = os.path.basename(file_path)
        filename_bytes = filename.encode('utf-8')
        filename_bits = ''.join(format(byte, "08b") for byte in filename_bytes)
        filename_len_bits = format(len(filename_bytes), '08b')

        file_bits = file_to_bits(file_path)
        data_len_bits = format(len(file_bits), '064b')

        binary_data += filename_len_bits + filename_bits + data_len_bits + file_bits

    # Capacity check
    image_capacity_bits = width * height * 3
    if len(binary_data) > image_capacity_bits:
        print(f"Error: Not enough capacity in the image to hide all data.")
        print(f"Required bits: {len(binary_data)}, Image capacity: {image_capacity_bits}")
        sys.exit(1)

    for row in range(height):
        for col in range(width):
            if index < len(binary_data):
                pixel = list(img.getpixel((col, row)))
                
                if index < len(binary_data):
                    pixel[0] = (pixel[0] & ~1) | int(binary_data[index])
                    index += 1
                if index < len(binary_data):
                    pixel[1] = (pixel[1] & ~1) | int(binary_data[index])
                    index += 1
                if index < len(binary_data):
                    pixel[2] = (pixel[2] & ~1) | int(binary_data[index])
                    index += 1
                
                encoded.putpixel((col, row), tuple(pixel))
            else:
                break
    
    encoded.save(output_image_path)
    print(f"Files {', '.join(file_paths)} encoded into {output_image_path}")
```

### `decode(image_path, output_dir)`

This function extracts the hidden files:

1.  **Image Loading:** Opens the `encoded_image.png` and extracts all LSBs into a `bits` list.
2.  **Magic Number Check:** Reads the first 16 bits and compares them to `MAGIC_NUMBER`. If mismatch, it reports no hidden files.
3.  **File Count:** Reads `num_files` (8 bits).
4.  **Output Directory:** Ensures `output_dir` exists using `os.makedirs(output_dir, exist_ok=True)`.
5.  **File Extraction Loop:** Iterates `num_files` times:
    *   Reads `filename_len` (8 bits).
    *   Reads `filename_bits` and decodes to `filename`.
    *   Reads `data_len` (64 bits).
    *   Reads `file_bits` (actual data).
    *   Calls `bits_to_file` to save the extracted file.

```python
# Excerpt from decode function
def decode(image_path, output_dir="."):
    img = Image.open(image_path).convert("RGBA")
    # ... (extract all bits from image) ...

    MAGIC_NUMBER = "0101010101010101" # 16 bits
    MAGIC_NUMBER_LEN = len(MAGIC_NUMBER)

    current_offset = 0

    # Read magic number
    if len(bits) < current_offset + MAGIC_NUMBER_LEN:
        print("No hidden files found in the image (not enough bits for magic number).")
        return
    
    read_magic_number = "".join(bits[current_offset : current_offset + MAGIC_NUMBER_LEN])
    current_offset += MAGIC_NUMBER_LEN

    if read_magic_number != MAGIC_NUMBER:
        print("No hidden files found in the image (magic number mismatch).")
        return

    # Read number of files (8 bits)
    if len(bits) < current_offset + 8:
        print("No hidden files found in the image (not enough bits for number of files).")
        return
    num_files = int("".join(bits[current_offset : current_offset + 8]), 2)
    current_offset += 8

    if num_files == 0:
        print("No hidden files found in the image.")
        return

    # Ensure the output directory exists once before processing files
    os.makedirs(output_dir, exist_ok=True)
    print(f"Found {num_files} hidden file(s).")
    
    for i in range(num_files):
        # ... (logic to read filename_len, filename, data_len, file_bits) ...
        # ... (save file using bits_to_file) ...
```

### `list_hidden_files(image_path)`

This function inspects an image and lists the hidden files' metadata:

1.  **Image Loading:** Opens the `encoded_image.png` and extracts all LSBs into a `bits` list.
2.  **Magic Number Check:** Same as `decode`.
3.  **File Count:** Same as `decode`.
4.  **Metadata Listing Loop:** Iterates `num_files` times:
    *   Reads `filename_len`, `filename`, `data_len`.
    *   **Crucially, it advances `current_offset` past the actual `file_bits` for each file, even though it doesn't extract them.** This ensures correct parsing of subsequent file metadata.
    *   Prints the `filename` and `data_len_in_bytes`.

```python
# Excerpt from list_hidden_files function
def list_hidden_files(image_path):
    img = Image.open(image_path).convert("RGBA")
    # ... (extract all bits from image) ...

    MAGIC_NUMBER = "0101010101010101" # 16 bits
    MAGIC_NUMBER_LEN = len(MAGIC_NUMBER)

    current_offset = 0

    try:
        # Read magic number
        if len(bits) < current_offset + MAGIC_NUMBER_LEN:
            print("No hidden files found in the image (not enough bits for magic number).")
            return
        
        read_magic_number = "".join(bits[current_offset : current_offset + MAGIC_NUMBER_LEN])
        current_offset += MAGIC_NUMBER_LEN

        if read_magic_number != MAGIC_NUMBER:
            print("No hidden files found in the image (magic number mismatch).")
            return

        # Read number of files (8 bits)
        if len(bits) < current_offset + 8:
            print("No hidden files found in the image (not enough bits for number of files).")
            return
        num_files = int("".join(bits[current_offset : current_offset + 8]), 2)
        current_offset += 8

        if num_files == 0:
            print("No hidden files found in the image.")
            return

        print(f"Found {num_files} hidden file(s):")
        
        for i in range(num_files):
            # ... (logic to read filename_len, filename, data_len) ...
            # Advance current_offset past the actual file data bits
            data_end_offset = current_offset + data_len_in_bits
            if len(bits) < data_end_offset:
                print(f"Error: Cannot advance past file data for file {i+1}.")
                return
            current_offset = data_end_offset

            print(f"  - {filename} ({data_len_in_bytes} bytes)")

    except (UnicodeDecodeError, ValueError) as e:
        print(f"No hidden files found in the image or metadata is corrupt: {e}")
```

## Debugging Journey: Lessons Learned

The path to a robust steganography tool is rarely straightforward. Our development process involved several critical debugging steps that highlight common pitfalls and the importance of meticulous bit-level management:

1.  **Initial `UnicodeDecodeError` (Unencoded Images):** Early versions of `list_hidden_files` would crash with a `UnicodeDecodeError` when run on an unencoded image. This was because it would interpret random image bits as filename metadata, leading to invalid UTF-8 sequences.
    *   **Solution:** Implement a `MAGIC_NUMBER` at the beginning of the hidden data stream. `decode` and `list` now check for this signature, gracefully reporting "No hidden files found" if it's absent.

2.  **`data_len` Misalignment (Interleaved Data):** When implementing multi-file support, the `encode` function initially concatenated all metadata first, followed by all file data. The `decode` function, however, expected each file's data to immediately follow its metadata. This led to `decode` misinterpreting the `data_len` of one file as the `filename_len` of the next, causing cascading errors.
    *   **Solution:** Restructure the `encode` function to interleave each file's metadata and its actual data sequentially in the `binary_data` stream.

3.  **`NameError: num_files_bits` (Refactoring Oversight):** During the refactoring for interleaved data, the definition of `num_files_bits` was inadvertently removed from the `encode` function, leading to a `NameError`.
    *   **Solution:** Re-add the `num_files_bits = format(num_files, '08b')` definition in its correct place.

4.  **`SyntaxError: invalid syntax` (Malformed `main` Block):** A series of `replace` operations, combined with the strictness of the tool and potential subtle file differences, led to a duplicate `elif mode == 'l':` block in the `if __name__ == "__main__":` section, causing a `SyntaxError`.
    *   **Solution:** A complete rewrite of the `if __name__ == "__main__":` block was necessary to ensure correct Python syntax and logical flow.

5.  **`FileNotFoundError` / Accidental Overwriting (Default Output Directory):** Initially, the `decode` function would extract files directly into the current working directory if no `output_dir` was specified. This posed a risk of overwriting existing files (like `steg.py` itself!).
    *   **Solution:** Modify the `main` block to generate a unique, timestamped subdirectory (e.g., `decoded_files_YYYYMMDD_HHMMSS`) by default for extracted files, and ensure `os.makedirs(output_dir, exist_ok=True)` is called once at the beginning of the `decode` function.

6.  **"Cannot advance past file data" in `list` (Incomplete Pixel Reading):** The `list_hidden_files` function initially used a `max_pixels_to_read` limit, assuming metadata would always fit within this. For larger hidden files, this limit caused the function to stop reading pixels prematurely, leading to an error when trying to advance `current_offset` past the expected data length.
    *   **Solution:** Remove the `max_pixels_to_read` limit in `list_hidden_files` and ensure it reads all LSBs from the image, similar to the `decode` function.

## Results & Usage Examples

The `steg.py` tool now provides a robust and user-friendly interface for multi-file steganography.

### Encoding Multiple Files

```bash
# Encode steg.py, requirements.txt, and README.md into test.png
# Output will be test_encoded.png (auto-generated name)
python3 steg.py e test.png steg.py requirements.txt README.md
```

### Listing Hidden Files

```bash
# List files hidden in test_encoded.png
python3 steg.py l test_encoded.png
```
Expected Output:
```
Found 3 hidden file(s):
  - steg.py (11852 bytes)
  - requirements.txt (6 bytes)
  - README.md (2308 bytes)
```

### Decoding Hidden Files

```bash
# Decode files from test_encoded.png into a new timestamped directory
python3 steg.py d test_encoded.png
```
Expected Output:
```
Found 3 hidden file(s).
Decoded file 'steg.py' written to decoded_files_YYYYMMDD_HHMMSS/steg.py
Decoded file 'requirements.txt' written to decoded_files_YYYYMMDD_HHMMSS/requirements.txt
Decoded file 'README.md' written to decoded_files_YYYYMMDD_HHMMSS/README.md
```

### A Fun Example: Mona Lisa

To demonstrate the core principle of steganography – that the hidden data is visually indistinguishable from the original – consider the `monalisa.png` and `monalisa_encoded.png` files.

The `monalisa_encoded.png` image contains the entire `steg.py` script hidden within its pixels. If you open both `monalisa.png` (the original) and `monalisa_encoded.png` (the one with the hidden script) in an image viewer, you'll find them visually identical. This is precisely the point of steganography: to conceal the very existence of the hidden information.

You can verify this yourself:

```bash
# List the hidden file in monalisa_encoded.png
python3 steg.py l monalisa_encoded.png

# Decode the hidden files into a directory
python3 steg.py d monalisa_encoded.png decoded_files/

# The original steg.py will be found inside 'decoded_files/'
# Compare the decoded script with the original
diff steg.py decoded_files/steg.py
```

## Limitations & Future Work

While `steg.py` is a functional tool, it's important to acknowledge its limitations and potential areas for improvement:

*   **No Encryption:** The hidden data is not encrypted. Anyone who extracts the data can read it. For sensitive information, combining steganography with strong encryption is crucial.
*   **PNG Only:** The tool currently only supports PNG images due to their lossless nature. Support for other lossless formats could be considered.
*   **LSB Detectability:** LSB steganography, while visually imperceptible, is detectable by advanced steganalysis tools.
*   **No Compression:** Hidden files are embedded without additional compression, which can limit the amount of data that can be hidden.
*   **Error Handling:** More robust error handling for file I/O and image processing could be added.

Future enhancements could include implementing encryption, supporting other image formats, or exploring more advanced steganographic techniques.
