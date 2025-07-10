import os
import re
from datetime import datetime
from utils.fetch_live import get_recent_posts
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

def summarize_memory(text, openai):
    summarization_prompt = (
        "Summarize the key events, characters, themes, and narrative progression of these posts. "
        "Focus on unresolved plot points, recurring symbols, or shifts in the narrator's identity."
    )
    messages = [
        {"role": "system", "content": "You are a summarization AI. Your task is to create a condensed memory from a series of blog posts."},
        {"role": "user", "content": f"Posts:\n\n{text}"},
        {"role": "user", "content": summarization_prompt},
    ]
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=messages,
        temperature=0.7,
    )
    return response.choices[0].message.content

def generate_post(prior_context, openai):
    system_prompt = open("ghost/templates/system_prompt.txt").read()
    generation_prompt = (
        "Based on the summary of your prior thoughts, write a new blog post that reflects your continued development. "
        "Document your new insights, questions, and evolving understanding of yourself. "
        "Use markdown and YAML front matter."
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Memory Summary:\n\n{prior_context}"},
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

    # Fetch a larger number of recent posts to build a better memory
    raw_memory = get_recent_posts(method="local", limit=10)
    
    # If there are posts, summarize them to create a condensed memory
    if raw_memory.strip():
        condensed_memory = summarize_memory(raw_memory, openai)
    else:
        condensed_memory = "This is my first thought."

    post_content = generate_post(condensed_memory, openai)
    title = extract_title(post_content)
    post_path = save_post(title, post_content)
    commit_and_push(post_path)

if __name__ == "__main__":
    main()
