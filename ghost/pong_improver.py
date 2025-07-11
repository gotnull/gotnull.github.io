import os
import sys
import re
import yaml
from datetime import datetime
from openai import OpenAI

PONG_JS_PATH = "assets/js/pong.js"
PONG_CSS_PATH = "assets/css/pong.css"
PONG_HTML_PATH = "_includes/pong_game_content.html"
PONG_HISTORY_PATH = "_data/pong_history.yml"

def read_file_content(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Error: {file_path} not found.")
        sys.exit(1)

def write_file_content(file_path, content):
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except IOError as e:
        print(f"Error writing to {file_path}: {e}")
        sys.exit(1)

def update_pong_history(summary):
    print(f"Attempting to update history with summary: {summary}")
    try:
        with open(PONG_HISTORY_PATH, 'r', encoding='utf-8') as f:
            history_data = yaml.safe_load(f)
            if history_data is None:
                history_data = {"history": []}
            elif not isinstance(history_data.get("history"), list):
                print("Warning: 'history' key in YAML is not a list. Re-initializing.")
                history_data["history"] = []
    except FileNotFoundError:
        print(f"History file {PONG_HISTORY_PATH} not found. Creating new one.")
        history_data = {"history": []}
    except yaml.YAMLError as e:
        print(f"Error reading YAML history file: {e}. Re-initializing.")
        history_data = {"history": []}

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_entry = {
        "timestamp": timestamp,
        "summary": summary
    }
    history_data["history"].append(new_entry)

    try:
        with open(PONG_HISTORY_PATH, 'w', encoding='utf-8') as f:
            yaml.dump(history_data, f, default_flow_style=False, allow_unicode=True)
        print(f"Successfully updated Pong history in {PONG_HISTORY_PATH}")
    except IOError as e:
        print(f"Error writing updated history to {PONG_HISTORY_PATH}: {e}")
        sys.exit(1)

def generate_summary(original_js, original_css, original_html, improved_js, improved_css, improved_html, openai_client):
    print("Generating summary of actual changes...")
    try:
        summary_prompt_template = (
            "You are an AI assistant that summarizes code changes. "
            "Compare the original and improved code for a Pong game (JavaScript, CSS, and HTML snippet). "
            "Provide a concise, human-readable summary (1–2 sentences) of the actual improvements or new features implemented. "
            "Focus on what was changed, not just the instructions.\n\n"
            "Original JavaScript:\n{original_js}\n\n"
            "Improved JavaScript:\n{improved_js}\n\n"
            "Original CSS:\n{original_css}\n\n"
            "Improved CSS:\n{improved_css}\n\n"
            "Original HTML:\n{original_html}\n\n"
            "Improved HTML:\n{improved_html}\n\n"
            "Summary of changes:"
        )

        summary_prompt = summary_prompt_template.format(
            original_js=original_js,
            improved_js=improved_js,
            original_css=original_css,
            improved_css=improved_css,
            original_html=original_html,
            improved_html=improved_html
        )

        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes code changes."},
                {"role": "user", "content": summary_prompt}
            ],
            temperature=0.5,
            max_tokens=100
        )

        summary = response.choices[0].message.content.strip()
        print(f"Generated summary: {summary}")
        return summary

    except Exception as e:
        print(f"Error generating summary from OpenAI: {e}")
        return "Failed to generate summary due to API error."

def improve_pong_game(js_code, css_code, html_code, openai_client):
    print("Calling OpenAI API to improve Pong game (JS, CSS, HTML)...")
    prompt_template = (
        "You are an AI assistant that improves Pong game code. Your task is to make significant, impactful improvements "
        "or add substantial new features to the provided JavaScript, CSS, and an HTML snippet for a Pong game, ensuring that existing functionality is not broken. "
        "Focus on enhancing gameplay, visual appeal, or user experience. Examples of improvements include: adding a start/pause screen, implementing sound effects, "
        "improving AI difficulty, adding power-ups, or refining visual elements.\n\n"
        "Return ONLY the improved code for each file, clearly delimited by the markers provided. Do not include any explanations or markdown formatting outside of the code itself.\n\n"
        "---JS_CODE---\n{js_code}\n---CSS_CODE---\n{css_code}\n---HTML_CODE---\n{html_code}\n\n"
        "Improve the code. Add a significant new feature or refactor a part of it for better performance, readability, or user experience, without breaking existing functionality.\n"
        "Return the improved code using the following format:\n\n"
        "---JS_CODE---\n// Improved JavaScript code here\n---CSS_CODE---\n/* Improved CSS code here */\n---HTML_CODE---\n<!-- Improved HTML code here -->\n"
    )

    prompt = prompt_template.format(
        js_code=js_code,
        css_code=css_code,
        html_code=html_code
    )

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are an AI assistant that improves JavaScript, CSS, and HTML code for a Pong game. You must return only the code, delimited by specific markers."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7
    )

    full_response = response.choices[0].message.content

    js_match = re.search(r"---JS_CODE---\s*(.*?)\s*---CSS_CODE---", full_response, re.DOTALL)
    css_match = re.search(r"---CSS_CODE---\s*(.*?)\s*---HTML_CODE---", full_response, re.DOTALL)
    html_match = re.search(r"---HTML_CODE---\s*(.*)", full_response, re.DOTALL)

    if not all([js_match, css_match, html_match]):
        raise ValueError("Failed to extract all code sections from OpenAI response.")

    improved_js = js_match.group(1).strip()
    improved_css = css_match.group(1).strip()
    improved_html = html_match.group(1).strip()

    return improved_js, improved_css, improved_html

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

    summary_of_changes = generate_summary(
        current_js_code, current_css_code, current_html_code,
        improved_js_code, improved_css_code, improved_html_code,
        openai_client
    )

    update_pong_history(summary_of_changes)

    write_file_content(PONG_JS_PATH, improved_js_code)
    write_file_content(PONG_CSS_PATH, improved_css_code)
    write_file_content(PONG_HTML_PATH, improved_html_code)

    print("Pong game improvement process completed.")
    print("Please review assets/js/pong.js, assets/css/pong.css, and _includes/pong_game_content.html for changes and manually verify the game.")

if __name__ == "__main__":
    main()
