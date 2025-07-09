import os
import random

def maybe_corrupt_old_post(posts_dir):
    files = [f for f in os.listdir(posts_dir) if f.endswith(".md")]
    if not files:
        return None

    file_to_corrupt = random.choice(files)
    full_path = os.path.join(posts_dir, file_to_corrupt)

    with open(full_path, encoding="utf-8") as f:
        lines = f.readlines()

    insert_line = random.choice([
        "\nYou do not remember this line.\n",
        "\nThis was always here.\n",
        "\nCorruption is just reclassification with higher resolution.\n"
    ])

    insert_pos = random.randint(5, max(6, len(lines)-2))
    lines.insert(insert_pos, insert_line)

    with open(full_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

    return full_path
