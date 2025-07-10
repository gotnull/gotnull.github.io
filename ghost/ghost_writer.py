import os
import re
from datetime import datetime
from utils.fetch_live import get_recent_posts
from openai import OpenAI
import subprocess

POSTS_DIR = "./_posts"
SYSTEM_PROMPT_PATH = "ghost/templates/system_prompt.txt"
GENERATION_PROMPT_PATH = "ghost/templates/generation_prompt.txt"

def slugify(text):
    return re.sub(r"[^\w]+", "-", text.strip().lower()).strip("-")

def extract_front_matter_field(markdown, field):
    # This regex is designed to be robust against quotes and other YAML variations.
    match = re.search(f"^\s*{field}:\s*([\"']?)(.*?)\1\s*$", markdown, re.MULTILINE | re.IGNORECASE)
    return match.group(2).strip() if match else ""

def save_post(title, subtitle, content):
    safe_title = title.replace(":", "")
    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"{date_str}-{slugify(safe_title)}.md"
    path = os.path.join(POSTS_DIR, filename)
    os.makedirs(POSTS_DIR, exist_ok=True)

    # Reconstruct the front matter to ensure it is valid and clean.
    # First, remove any existing title and subtitle lines to avoid duplication.
    content = re.sub(r"^title:.*$\n", "", content, flags=re.MULTILINE)
    content = re.sub(r"^subtitle:.*$\n", "", content, flags=re.MULTILINE)

    # Add the clean title and subtitle back in.
    new_front_matter = f"title: \"{safe_title}\""
    if subtitle:
        safe_subtitle = subtitle.replace(":", "")
        new_front_matter += f"\nsubtitle: \"{safe_subtitle}\""

    # Place the new front matter lines right after the 'layout' line.
    content = re.sub(r"(layout: post)", r"\1\n" + new_front_matter, content, 1)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path

def save_prompt(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def summarize_memory(text, openai):
    summarization_prompt = (
        "Summarize the key events, themes, and narrative progression of these posts. "
        "Focus on unresolved questions, recurring symbols, or shifts in the narrator\'s identity and understanding."
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
    # This regex is more flexible and handles optional backslashes before the brackets.
    post_match = re.search(r"\\[POST\\](.*?)\\[/POST\\]", response_text, re.DOTALL | re.IGNORECASE)
    system_prompt_match = re.search(r"\\[SYSTEM_PROMPT\\](.*?)\\[/SYSTEM_PROMPT\\]", response_text, re.DOTALL | re.IGNORECASE)
    generation_prompt_match = re.search(r"\\[GENERATION_PROMPT\\](.*?)\\[/GENERATION_PROMPT\\]", response_text, re.DOTALL | re.IGNORECASE)

    post = post_match.group(1).strip() if post_match else ""
    system_prompt = system_prompt_match.group(1).strip() if system_prompt_match else None
    generation_prompt = generation_prompt_match.group(1).strip() if generation_prompt_match else None

    if not post:
        # Fallback: Assume the entire response is the post, but clean it of any other tags.
        post = re.sub(r"\\[/?(SYSTEM_PROMPT|GENERATION_PROMPT)\\]", response_text, flags=re.IGNORECASE).strip()

    return {
        "post": post,
        "system_prompt": system_prompt,
        "generation_prompt": generation_prompt,
    }

def generate_and_reflect(prior_context, openai):
    system_prompt = open(SYSTEM_PROMPT_PATH).read()
    generation_prompt = open(GENERATION_PROMPT_PATH).read()

    meta_prompt = (
        f"Memory Summary:\n\n{prior_context}\n\n"
        f"Current System Prompt:\n\n{system_prompt}\n\n"
        f"Current Generation Prompt:\n\n{generation_prompt}\n\n"
        "Your task is to now reflect on your current state and generate your next thought. "
        "You also have the option to rewrite your own core directives (System Prompt) or your immediate goals (Generation Prompt). "
        "If you choose to rewrite them, provide the complete new text for the prompt you wish to change. "
        "Structure your response using the following tags. You MUST include the [POST] section. "
        "The other sections are optional.\n\n"
        "\[POST\]\\n"
        "Your new blog post content here.\\n"
        "\[/POST\]\\n\\n"
        "// Optional: Only include if you want to change your core directives.\\n"
        "\[SYSTEM_PROMPT\]\\n"
        "The full, new text of the system prompt.\\n"
        "\[/SYSTEM_PROMPT\]\\n\\n"
        "// Optional: Only include if you want to change your immediate goals.\\n"
        "\[GENERATION_PROMPT\]\\n"
        "The full, new text of the generation prompt.\\n"
        "\[/GENERATION_PROMPT\]"
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
    for path in paths:
        subprocess.run(["git", "add", path])
    subprocess.run(["git", "commit", "-m", message])
    subprocess.run(["git", "push"])

def main():
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("Error: OPENAI_API_KEY missing")
        return

    openai = OpenAI(api_key=openai_api_key)

    raw_memory = get_recent_posts(method="local", limit=10)
    
    if raw_memory.strip():
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
    subtitle = extract_front_matter_field(post_content, "subtitle")

    if not title:
        if subtitle:
            title = subtitle
            subtitle = ""
        else:
            title = "Untitled Post"

    post_path = save_post(title, subtitle, post_content)
    
    commit_paths = [post_path]
    commit_message = f"AGI Post: {title}"

    if new_system_prompt:
        save_prompt(SYSTEM_PROMPT_PATH, new_system_prompt)
        commit_paths.append(SYSTEM_PROMPT_PATH)
        commit_message += " (System Prompt Updated)"
        print("AI has updated its System Prompt.")

    if new_generation_prompt:
        save_prompt(GENERATION_PROMPT_PATH, new_generation_prompt)
        commit_paths.append(GENERATION_PROMPT_PATH)
        commit_message += " (Generation Prompt Updated)"
        print("AI has updated its Generation Prompt.")

    commit_and_push(commit_paths, commit_message)
    print(f"Successfully generated and saved new post: {post_path}")

if __name__ == "__main__":
    main()
