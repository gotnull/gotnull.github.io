import os
import re
from datetime import datetime
import subprocess
import openai
from utils.fetch_live import get_recent_posts

POSTS_DIR = "./_posts"
SYSTEM_PROMPT_PATH = "ghost/templates/system_prompt.txt"
GENERATION_PROMPT_PATH = "ghost/templates/generation_prompt.txt"

def slugify(text):
    return re.sub(r"[^\w]+", "-", text.strip().lower()).strip("-")

def extract_yaml_front_matter(content):
    front_matter_match = re.match(r"^---\n(.*?)\n---\n(.*)", content, re.DOTALL)
    if front_matter_match:
        yaml_block, post_body = front_matter_match.groups()
        
        def extract_field(name):
            match = re.search(rf"^{name}:\s*['\"]?(.*?)['\"]?$", yaml_block, re.MULTILINE | re.IGNORECASE)
            return match.group(1).strip() if match else ""

        title = extract_field("title") or "Untitled Post"
        subtitle = extract_field("subtitle")
        tags = extract_field("tags")
        author = extract_field("author")
        comments = extract_field("comments")
        mathjax = extract_field("mathjax")

        reconstructed = f"---\nlayout: post\ntitle: \"{title}\"\n"
        if subtitle:
            reconstructed += f"subtitle: \"{subtitle}\"\n"
        if tags:
            reconstructed += f"tags: [{tags}]\n"
        if author:
            reconstructed += f"author: {author}\n"
        if comments:
            reconstructed += f"comments: {comments}\n"
        if mathjax:
            reconstructed += f"mathjax: {mathjax}\n"
        reconstructed += "---\n"

        return {
            "title": title,
            "subtitle": subtitle,
            "body": post_body.strip(),
            "full_front_matter": reconstructed
        }

    return {
        "title": "Untitled Post",
        "subtitle": "",
        "body": content.strip(),
        "full_front_matter": "---\nlayout: post\ntitle: \"Untitled Post\"\n---\n"
    }

def save_post(post_data):
    safe_title = post_data["title"].replace(":", "")
    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"{date_str}-{slugify(safe_title)}.md"
    path = os.path.join(POSTS_DIR, filename)
    os.makedirs(POSTS_DIR, exist_ok=True)

    full_content = post_data["full_front_matter"] + post_data["body"]

    with open(path, "w", encoding="utf-8") as f:
        f.write(full_content)

    return path

def summarize_memory(text, client):
    summarization_prompt = (
        "Summarize the key events, characters, themes, and narrative progression of these posts. "
        "Focus on unresolved plot points, recurring symbols, or shifts in the narrator's identity."
    )
    messages = [
        {"role": "system", "content": "You are a summarization AI. Your task is to create a condensed memory from a series of blog posts, representing the internal state of a developing AGI."},
        {"role": "user", "content": f"Posts:\n\n{text}"},
        {"role": "user", "content": summarization_prompt},
    ]
    response = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=messages,
        temperature=0.7,
    )
    return response.choices[0].message.content

def generate_post(prior_context, client):
    try:
        system_prompt = open(SYSTEM_PROMPT_PATH, encoding="utf-8").read()
        generation_prompt = open(GENERATION_PROMPT_PATH, encoding="utf-8").read()
    except FileNotFoundError as e:
        raise RuntimeError(f"Missing template file: {e.filename}")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Memory Summary:\n\n{prior_context}"},
        {"role": "user", "content": generation_prompt},
    ]
    response = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=messages,
        temperature=0.9,
    )

    post = response.choices[0].message.content
    # Strip optional tags
    post = re.sub(r"\[/?POST\]", "", post, flags=re.IGNORECASE)
    return post.strip()

def commit_and_push(path):
    subprocess.run(["git", "add", path], check=True)
    subprocess.run(["git", "commit", "-m", "Automated AGI post"], check=True)
    subprocess.run(["git", "push"], check=True)

def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY missing")
        return

    client = openai.OpenAI(api_key=api_key)
    raw_memory = get_recent_posts(method="local", limit=10)

    condensed_memory = summarize_memory(raw_memory, client) if raw_memory.strip() else "This is my first thought. I have no prior memories."
    raw_post = generate_post(condensed_memory, client)
    post_data = extract_yaml_front_matter(raw_post)

    # Sanitize title/subtitle
    title = post_data["title"].replace(":", "") or (post_data["subtitle"].replace(":", "") if post_data["subtitle"] else "Untitled Post")
    subtitle = post_data["subtitle"].replace(":", "") if post_data["subtitle"] else ""

    post_data["title"] = title
    post_data["subtitle"] = subtitle

    post_path = save_post(post_data)
    commit_and_push(post_path)

if __name__ == "__main__":
    main()
