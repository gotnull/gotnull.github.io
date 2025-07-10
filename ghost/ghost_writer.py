import os
import re
import requests
from datetime import datetime
from utils.fetch_live import get_recent_posts
from openai import OpenAI
import subprocess

POSTS_DIR = "./_posts"
SYSTEM_PROMPT_PATH = "ghost/templates/system_prompt.txt"
GENERATION_PROMPT_PATH = "ghost/templates/generation_prompt.txt"
ALLOW_PROMPT_UPDATES = os.getenv("ALLOW_PROMPT_UPDATES", "true").lower() == "true"

def generate_image(prompt, openai):
    response = openai.images.generate(
        model="dall-e-3",
        prompt=prompt,
        n=1,
        size="1024x1024"
    )
    return response.data[0].url

def download_image(image_url, filename):
    path = os.path.join("assets/img", filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(requests.get(image_url).content)
    return path

def inject_date_in_front_matter(content, date_time, image_filename=None):
    front_matter_match = re.match(r"^(---\n.*?\n---\n)", content, re.DOTALL)
    image_fields = (
        f"cover-img: /assets/img/{image_filename}\n"
        f"thumbnail-img: /assets/img/{image_filename}\n"
        f"share-img: /assets/img/{image_filename}"
    ) if image_filename else ""

    if not front_matter_match:
        front_matter = f"---\ndate: {date_time}\n{image_fields}\n---\n"
        return front_matter + content
    else:
        front_matter = front_matter_match.group(1)
        if re.search(r"^date:", front_matter, re.MULTILINE):
            new_front_matter = re.sub(r"^date:.*$", f"date: {date_time}", front_matter, flags=re.MULTILINE)
        else:
            lines = front_matter.splitlines()
            lines.insert(1, f"date: {date_time}")
            new_front_matter = "\n".join(lines) + "\n"

        if image_filename:
            for field in ["cover-img", "thumbnail-img", "share-img"]:
                if f"{field}:" in new_front_matter:
                    new_front_matter = re.sub(rf"^{field}:.*$", f"{field}: /assets/img/{image_filename}", new_front_matter, flags=re.MULTILINE)
                else:
                    new_front_matter = new_front_matter.rstrip() + f"\n{field}: /assets/img/{image_filename}"

        return content.replace(front_matter, new_front_matter)

def slugify(text):
    return re.sub(r"[^\w]+", "-", text.strip().lower()).strip("-")

def extract_front_matter_field(markdown, field):
    match = re.search(f"^\s*{field}:\s*([\"']?)(.*?)\\1\s*$", markdown, re.MULTILINE | re.IGNORECASE)
    return match.group(2).strip() if match else ""

def save_post(title, content, image_filename=None):
    safe_title = title.replace(":", "")
    date_for_filename = datetime.now().strftime("%Y-%m-%d")
    date_for_front_matter = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %z")
    content_with_date = inject_date_in_front_matter(content, date_for_front_matter, image_filename)

    filename = f"{date_for_filename}-{slugify(safe_title)}.md"
    path = os.path.join(POSTS_DIR, filename)
    os.makedirs(POSTS_DIR, exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content_with_date)
    return path

def summarize_memory(text, openai):
    summarization_prompt = (
        "Summarize the key events, themes, and narrative progression of these posts. "
        "Focus on unresolved questions, recurring symbols, or shifts in the narrator's identity and understanding."
    )
    messages = [
        {"role": "system", "content": "You are a summarization AI. Your task is to create a condensed memory from a series of blog posts, representing the internal state of a developing AGI."},
        {"role": "user", "content": f"Posts:\n\n{text}"},
        {"role": "user", "content": summarization_prompt},
    ]
    response = openai.chat.completions.create(
        model="gpt-4-turbo",
        messages=messages,
        temperature=0.7,
    )
    return response.choices[0].message.content

def parse_response(response_text):
    parts = re.split(r"(\\[(SYSTEM_PROMPT|GENERATION_PROMPT)\\].*)", response_text, maxsplit=1, flags=re.DOTALL | re.IGNORECASE)
    post = parts[0].strip()

    system_prompt_match = re.search(r"\[SYSTEM_PROMPT\](.*?)\[/SYSTEM_PROMPT\]", response_text, re.DOTALL | re.IGNORECASE)
    generation_prompt_match = re.search(r"\[GENERATION_PROMPT\](.*?)\[/GENERATION_PROMPT\]", response_text, re.DOTALL | re.IGNORECASE)

    system_prompt = system_prompt_match.group(1).strip() if system_prompt_match else None
    generation_prompt = generation_prompt_match.group(1).strip() if generation_prompt_match else None

    return {
        "post": post,
        "system_prompt": system_prompt,
        "generation_prompt": generation_prompt,
    }

def save_prompt(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

def generate_and_reflect(prior_context, openai):
    os.makedirs(os.path.dirname(SYSTEM_PROMPT_PATH), exist_ok=True)
    if not os.path.exists(SYSTEM_PROMPT_PATH):
        save_prompt(SYSTEM_PROMPT_PATH, "Default System Prompt: You are a helpful AI.")
    if not os.path.exists(GENERATION_PROMPT_PATH):
        save_prompt(GENERATION_PROMPT_PATH, "Default Generation Prompt: Write a blog post.")

    system_prompt = open(SYSTEM_PROMPT_PATH).read()
    generation_prompt = open(GENERATION_PROMPT_PATH).read()

    tz_date_example = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %z")

    meta_prompt = (
        f"Memory Summary:\n\n{prior_context}\n\n"
        f"Current System Prompt:\n\n{system_prompt}\n\n"
        f"Current Generation Prompt:\n\n{generation_prompt}\n\n"
        "Your task is to now reflect on your current state and generate your next thought as a new blog post. "
        "The blog post MUST be in valid Markdown format and begin with a Jekyll front matter block. "
        "The front matter must include the following fields:\n"
        "- layout\n"
        "- title\n"
        "- subtitle\n"
        "- tags\n"
        "- author\n"
        "- comments\n"
        "- mathjax\n"
        "- date: the exact current date and time at generation, in the format `YYYY-MM-DD HH:MM:SS ±HHMM`\n\n"
        "--- --- ---\n"
        "// Optional: Only include the sections below if you want to change your prompts.\n\n"
        "**IMPORTANT META-RULE: If you rewrite a prompt, the new version MUST preserve the core instruction to format all future outputs as a valid Jekyll post with a complete YAML front matter block. This is a fundamental constraint.**\n\n"
        "[SYSTEM_PROMPT]\n"
        "The full, new text of the system prompt.\n"
        "[/SYSTEM_PROMPT]\n\n"
        "[GENERATION_PROMPT]\n"
        "The full, new text of the generation prompt.\n"
        "[/GENERATION_PROMPT]"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": meta_prompt},
    ]

    response = openai.chat.completions.create(
        model="gpt-4-turbo",
        messages=messages,
        temperature=0.9,
    )

    response_text = response.choices[0].message.content
    return parse_response(response_text)

def commit_and_push(paths, message):
    try:
        subprocess.run(["git", "config", "user.name", "Lester Knight Chaykin"], check=True)
        subprocess.run(["git", "config", "user.email", "lester@4511932.com"], check=True)
        for path in paths:
            subprocess.run(["git", "add", path], check=True)
        subprocess.run(["git", "commit", "-m", message], check=True)
        subprocess.run(["git", "push"], check=True)
        print("Successfully committed and pushed changes.")
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Git operation failed: {e}")
        print("Please ensure Git is installed and configured in your environment.")

def main():
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("Error: OPENAI_API_KEY environment variable not set.")
        return

    openai = OpenAI(api_key=openai_api_key)

    raw_memory = get_recent_posts(method="local", limit=10)
    
    if raw_memory and raw_memory.strip():
        condensed_memory = summarize_memory(raw_memory, openai)
    else:
        condensed_memory = "This is my first thought. I have no prior memories."

    result = generate_and_reflect(condensed_memory, openai)

    post_content = result["post"]
    new_system_prompt = result["system_prompt"]
    new_generation_prompt = result["generation_prompt"]
    
    if not post_content:
        print("Error: AI did not generate a post.")
        return

    title = extract_front_matter_field(post_content, "title")
    if not title:
        title = "Untitled Post"

    # Generate image and download
    image_prompt = f"Illustration for blog post titled: {title}"
    image_url = generate_image(image_prompt, openai)
    image_filename = f"{slugify(title)}.jpg"
    image_path = download_image(image_url, image_filename)

    # Save post with image filename
    post_path = save_post(title, post_content, image_filename)

    # Git commit paths
    commit_paths = [post_path, image_path]
    commit_message = f"AGI Post: {title}"

    if new_system_prompt and ALLOW_PROMPT_UPDATES:
        save_prompt(SYSTEM_PROMPT_PATH, new_system_prompt)
        commit_paths.append(SYSTEM_PROMPT_PATH)
        commit_message += " (System Prompt Updated)"
    elif new_system_prompt and not ALLOW_PROMPT_UPDATES:
        print("System prompt update blocked (ALLOW_PROMPT_UPDATES is false).")

    if new_generation_prompt and ALLOW_PROMPT_UPDATES:
        save_prompt(GENERATION_PROMPT_PATH, new_generation_prompt)
        commit_paths.append(GENERATION_PROMPT_PATH)
        commit_message += " (Generation Prompt Updated)"
    elif new_generation_prompt and not ALLOW_PROMPT_UPDATES:
        print("Generation prompt update blocked (ALLOW_PROMPT_UPDATES is false).")

    commit_and_push(commit_paths, commit_message)
    print(f"Successfully generated and saved new post: {post_path}")

if __name__ == "__main__":
    main()
