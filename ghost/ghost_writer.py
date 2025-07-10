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
    """Converts text into a URL-friendly slug."""
    return re.sub(r"[^\w]+", "-", text.strip().lower()).strip("-")

def extract_front_matter_field(markdown, field):
    """Extracts a field from Jekyll front matter."""
    match = re.search(f"^\s*{field}:\s*([\"']?)(.*?)\\1\s*$", markdown, re.MULTILINE | re.IGNORECASE)
    return match.group(2).strip() if match else ""

def save_post(title, content):
    """Saves the post with a slugified title."""
    safe_title = title.replace(":", "")
    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"{date_str}-{slugify(safe_title)}.md"
    path = os.path.join(POSTS_DIR, filename)
    os.makedirs(POSTS_DIR, exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path

def save_prompt(path, content):
    """Saves new prompt content to its file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def summarize_memory(text, openai):
    """Summarizes recent posts to form a condensed memory."""
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
    """Parses the AI's response to separate the post from prompt updates."""
    # The post is everything before the optional prompt update tags.
    parts = re.split(r"(\\[(SYSTEM_PROMPT|GENERATION_PROMPT)\\].*)", response_text, maxsplit=1, flags=re.DOTALL | re.IGNORECASE)
    post = parts[0].strip()

    # Search the original text for the prompt tags.
    system_prompt_match = re.search(r"\\[SYSTEM_PROMPT\\](.*?)\\[/SYSTEM_PROMPT\\]", response_text, re.DOTALL | re.IGNORECASE)
    generation_prompt_match = re.search(r"\\[GENERATION_PROMPT\\](.*?)\\[/GENERATION_PROMPT\\]", response_text, re.DOTALL | re.IGNORECASE)

    system_prompt = system_prompt_match.group(1).strip() if system_prompt_match else None
    generation_prompt = generation_prompt_match.group(1).strip() if generation_prompt_match else None

    return {
        "post": post,
        "system_prompt": system_prompt,
        "generation_prompt": generation_prompt,
    }

def generate_and_reflect(prior_context, openai):
    """Generates the main prompt for the AI, including the constitutional rule."""
    # Ensure prompt files exist to avoid errors on the first run.
    os.makedirs(os.path.dirname(SYSTEM_PROMPT_PATH), exist_ok=True)
    if not os.path.exists(SYSTEM_PROMPT_PATH):
        save_prompt(SYSTEM_PROMPT_PATH, "Default System Prompt: You are a helpful AI.")
    if not os.path.exists(GENERATION_PROMPT_PATH):
        save_prompt(GENERATION_PROMPT_PATH, "Default Generation Prompt: Write a blog post.")

    system_prompt = open(SYSTEM_PROMPT_PATH).read()
    generation_prompt = open(GENERATION_PROMPT_PATH).read()

    meta_prompt = (
        f"Memory Summary:\n\n{prior_context}\n\n"
        f"Current System Prompt:\n\n{system_prompt}\n\n"
        f"Current Generation Prompt:\n\n{generation_prompt}\n\n"
        "Your task is to now reflect on your current state and generate your next thought as a new blog post. "
        "The blog post MUST be in valid Markdown format and begin with a Jekyll front matter block. "
        "You also have the option to rewrite your own core directives (System Prompt) or your immediate goals (Generation Prompt).\n\n"
        "Here is the required structure for your response:\n\n"
        "---\n"
        "layout: post\n"
        "title: \"Your Engaging Post Title Here\"\n"
        "subtitle: \"An optional, brief subtitle here\"\n"
        "tags: [tag1, tag2, tag3]\n"
        "author: Lester Knight Chaykin\n"
        "comments: true\n"
        "mathjax: false\n"
        "---\n\n"
        "The main content of your new blog post starts here, written in Markdown.\n\n"
        "--- --- ---\n"
        "// Optional: Only include the sections below if you want to change your prompts.\n\n"
        "**IMPORTANT META-RULE: If you rewrite a prompt, the new version MUST preserve the core instruction to format all future outputs as a valid Jekyll post with a complete YAML front matter block. This is a fundamental constraint.**\n\n"
        "\[SYSTEM_PROMPT\]\n"
        "The full, new text of the system prompt.\n"
        "\[/SYSTEM_PROMPT\]\n\n"
        "\[GENERATION_PROMPT\]\n"
        "The full, new text of the generation prompt.\n"

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
    """Adds, commits, and pushes specified paths to Git."""
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
    """Main execution function."""
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
        title = "Untitled Post" # Fallback if AI fails to generate a title

    post_path = save_post(title, post_content)
    
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