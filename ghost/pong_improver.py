import os
import sys
from openai import OpenAI
import re

PONG_JS_PATH = "assets/js/pong.js"
PONG_CSS_PATH = "assets/css/pong.css"
PONG_HTML_PATH = "_layouts/game.html"

def read_file_content(file_path):
    try:
        with open(file_path, 'r') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Error: {file_path} not found.")
        sys.exit(1)

def write_file_content(file_path, content):
    try:
        with open(file_path, 'w') as f:
            f.write(content)
    except IOError as e:
        print(f"Error writing to {file_path}: {e}")
        sys.exit(1)

def improve_pong_game(js_code, css_code, html_code, openai_client):
    print("Calling OpenAI API to improve Pong game (JS, CSS, HTML)...")
    try:
        prompt_content = f"""
You are an AI assistant that improves Pong game code. Your task is to make small, incremental improvements or add minor features to the provided JavaScript, CSS, and HTML code for a Pong game, ensuring that existing functionality is not broken.

Return ONLY the improved code for each file, clearly delimited by the markers provided. Do not include any explanations or markdown formatting outside of the code itself.

---JS_CODE---
{js_code}
---CSS_CODE---
{css_code}
---HTML_CODE---
{html_code}

Improve the code. Add a small, new feature or refactor a part of it for better readability, without breaking existing functionality.
Return the improved code using the following format:

---JS_CODE---
// Improved JavaScript code here
---CSS_CODE---
/* Improved CSS code here */
---HTML_CODE---
<!-- Improved HTML code here -->
"""
        response = openai_client.chat.completions.create(
            model="gpt-4o", # Using gpt-4o for better code generation
            messages=[
                {"role": "system", "content": "You are an AI assistant that improves JavaScript, CSS, and HTML code for a Pong game. You must return only the code, delimited by specific markers."},
                {"role": "user", "content": prompt_content}
            ],
            temperature=0.7,
        )
        full_response_content = response.choices[0].message.content

        # Parse the response
        js_match = re.search(r"---JS_CODE---\s*(.*?)\s*---CSS_CODE---", full_response_content, re.DOTALL)
        css_match = re.search(r"---CSS_CODE---\s*(.*?)\s*---HTML_CODE---", full_response_content, re.DOTALL)
        html_match = re.search(r"---HTML_CODE---\s*(.*)", full_response_content, re.DOTALL)

        improved_js = js_match.group(1).strip() if js_match else js_code
        improved_css = css_match.group(1).strip() if css_match else css_code
        improved_html = html_match.group(1).strip() if html_match else html_code

        return improved_js, improved_css, improved_html

    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        return js_code, css_code, html_code # Return original code on error

def main():
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("Error: OPENAI_API_KEY environment variable not set.")
        sys.exit(1)

    openai_client = OpenAI(api_key=openai_api_key)

    print("Starting Pong game improvement process...")
    
    current_js_code = read_file_content(PONG_JS_PATH)
    current_css_code = read_file_content(PONG_CSS_PATH)
    current_html_code = read_file_content(PONG_HTML_PATH)

    improved_js_code, improved_css_code, improved_html_code = improve_pong_game(
        current_js_code, current_css_code, current_html_code, openai_client
    )
    
    write_file_content(PONG_JS_PATH, improved_js_code)
    write_file_content(PONG_CSS_PATH, improved_css_code)
    write_file_content(PONG_HTML_PATH, improved_html_code)
    
    print("Pong game improvement process completed.")
    print("Please review assets/js/pong.js, assets/css/pong.css, and _layouts/game.html for changes and manually verify the game.")

if __name__ == "__main__":
    main()
