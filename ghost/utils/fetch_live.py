import os
from pathlib import Path

def get_recent_posts(method="local", limit=5):
    if method == "local":
        return fetch_from_local(limit)
    else:
        return fetch_from_web(limit)

def fetch_from_local(limit=5):
    posts_dir = Path("./_posts")
    posts = sorted(posts_dir.glob("*.md"), reverse=True)
    chunks = []
    for post in posts[:limit]:
        with open(post, encoding="utf-8") as f:
            chunks.append(f.read())
    return "\n\n---\n\n".join(chunks)

def fetch_from_web(limit=5):
    import requests
    from bs4 import BeautifulSoup

    domain = "https://4511932.com"
    try:
        resp = requests.get(domain)
        soup = BeautifulSoup(resp.text, "html.parser")
        links = [a['href'] for a in soup.select("a[href*='/20']")][:limit]
        bodies = []
        for url in links:
            full_resp = requests.get(url)
            full_soup = BeautifulSoup(full_resp.text, "html.parser")
            bodies.append(full_soup.get_text())
        return "\n\n---\n\n".join(bodies)
    except Exception as e:
        print(f"Failed to fetch live posts: {e}")
        return ""
