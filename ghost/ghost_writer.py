import os
import re
import random
from datetime import datetime
from utils.fetch_live import get_recent_posts
from utils.corruption import maybe_corrupt_old_post
from openai import OpenAI
import subprocess

POSTS_DIR = "./_posts"

def slugify(text):
    return re.sub(r"[^\w]+", "-", text.strip().lower()).strip("-")

def extract_title(markdown):
    match = re.search(r"title:\s*(.+)", markdown)
    return match.group(1).strip() if match else "untitled"

def save_post(title, content):
    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"{date_str}-{slugify(title)}.md"
    path = os.path.join(POSTS_DIR, filename)
    os.makedirs(POSTS_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path

def generate_post(prior_context, openai):
    system_prompt = open("ghost/templates/system_prompt.txt").read()
    generation_prompt = (
        "Write a new blog post consistent with prior posts. "
        "Use subtle dread, recursion, and loss of identity themes. "
        "Use markdown and YAML front matter."
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context:\n\n{prior_context}"},
        {"role": "user", "content": generation_prompt},
    ]
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=messages,
        temperature=0.9,
    )
    return response.choices[0].message.content

def commit_and_push(path):
    subprocess.run(["git", "add", path])
    subprocess.run(["git", "commit", "-m", "Automated AGI post"])
    subprocess.run(["git", "push"])

def main():
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("Error: OPENAI_API_KEY missing")
        return

    openai = OpenAI(api_key=openai_api_key)

    context = get_recent_posts(method="local", limit=5)
    post_content = generate_post(context, openai)
    title = extract_title(post_content)
    post_path = save_post(title, post_content)
    commit_and_push(post_path)

    # 15% chance to corrupt an old post to simulate “infection”
    if random.random() < 0.15:
        corrupted = maybe_corrupt_old_post(POSTS_DIR)
        if corrupted:
            commit_and_push(corrupted)

if __name__ == "__main__":
    main()
