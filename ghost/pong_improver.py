import os
import sys
from openai import OpenAI

PONG_JS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "js", "pong.js")

def read_pong_js():
    try:
        with open(PONG_JS_PATH, 'r') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Error: {PONG_JS_PATH} not found.")
        sys.exit(1)

def write_pong_js(content):
    try:
        with open(PONG_JS_PATH, 'w') as f:
            f.write(content)
    except IOError as e:
        print(f"Error writing to {PONG_JS_PATH}: {e}")
        sys.exit(1)

def improve_pong_game(current_code, openai_client):
    print("Calling OpenAI API to improve Pong game...")
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o", # Using gpt-4o for better code generation
            messages=[
                {"role": "system", "content": "You are an AI assistant that improves JavaScript game code. Your task is to make small, incremental improvements or add minor features to the provided Pong game code, ensuring that existing functionality is not broken. Return ONLY the improved JavaScript code, nothing else. Do not include any explanations or markdown formatting outside of the code itself."},
                {"role": "user", "content": f"Improve the following Pong game JavaScript code. Add a small, new feature or refactor a part of it for better readability, without breaking existing functionality. Here's the code:\n\n```javascript\n{current_code}\n```\n\nReturn only the improved JavaScript code, nothing else."}
            ],
            temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        return current_code # Return original code on error

def main():
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("Error: OPENAI_API_KEY environment variable not set.")
        sys.exit(1)

    openai_client = OpenAI(api_key=openai_api_key)

    print("Starting Pong game improvement process...")
    current_pong_code = read_pong_js()
    if current_pong_code:
        improved_pong_code = improve_pong_game(current_pong_code, openai_client)
        # Clean up potential markdown code block in the response
        if improved_pong_code.startswith("```javascript") and improved_pong_code.endswith("```"):
            improved_pong_code = improved_pong_code[len("```javascript\n"): -len("```")].strip()
        
        write_pong_js(improved_pong_code)
        print("Pong game improvement process completed.")
        print("Please review assets/js/pong.js for changes and manually verify the game.")

if __name__ == "__main__":
    main()
