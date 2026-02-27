import os
import pandas as pd
import google.generativeai as genai
import random
import time
from datetime import datetime
from google.api_core import exceptions

# 1. Setup Gemini API
# Note: I've removed the specific key for security—replace with yours!
# 1. Look for BOTH common naming conventions
api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

if not api_key:
    # If running locally and forgot to set the env var,
    # you can temporarily hardcode it here:
    # api_key = "AIza..."
    raise ValueError("❌ No API Key found! Set GOOGLE_API_KEY in your terminal.")

# 2. Configure with the explicit keyword argument
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash') # Updated to current stable versioning

def generate_with_retry(model, prompt, max_retries=1):
    """
    Attempts to generate content with exponential backoff if rate limited.
    """
    for n in range(max_retries):
        try:
            response = model.generate_content(prompt)
            return response.text
        except exceptions.ResourceExhausted as e:
            # This is the 429 "Too Many Requests" error
            wait_time = (2 ** n) + random.random()
            print(f"⚠️ Rate limit hit. Retrying in {wait_time:.2f} seconds...")
            time.sleep(wait_time)
        except Exception as e:
            # For other errors (like connection issues), stop and report
            print(f"❌ An unexpected error occurred: {e}")
            return None

    print("🛑 Max retries reached. Could not get a response.")
    return None

# --- DISPLAY SETTINGS ---
pd.set_option('display.max_colwidth', None)
pd.set_option('display.max_columns', None)

# 2. Read the Excel file
# Ensure this file exists in your directory
df = pd.read_excel('atu.xlsx')

# 3. Pick a random range of rows
x1, x2 = 3, 3
num_rows = random.randint(x1, x2)
selected_rows = df.sample(n=num_rows).copy()

print(f"--- Selected {num_rows} Folklore Elements ---")
# display(selected_rows) # Use print if not in a Jupyter Notebook

# 4. Concatenate the "Variation Example" text
combined_variations = " ".join(selected_rows['Variation Example'].astype(str).tolist())

# 5. Construct the Prompt
prompt = f"""
i am providing you with several variation snippets from the aarne-thompson-uther (atu) index.
synthesize these specific elements into a single, brand-new folktale or folktale archetype.

inputs: {combined_variations}

requirements:
- style: write a short self-contained story in the style of 'post-internet folktale.'
use a 'scorsby' tone — whimsical and peppy.
incorporate occasional 'glong-speak' (phonetic, musical nonsense like 'rrombo dombo di di dai!') as if it were a high-status formal language.
characters are elastic, smile-centric entities who prioritize 'the big glong' (a state of total euphoria) over logic.
make no reference to the big glong.
at least one character must be named scorsby, and is preferably the more free-spirited character.
- no more than a tweet length.
- provide a unique title.
- important! format as markdown with all lowercase text (including title, denoted as h3 tag)
"""

# 6. Generate the Story with Retry Logic
print("\n...Generating your folktale...")
story_text = generate_with_retry(model, prompt)

if story_text:
    print("\n--- Result ---")
    print(story_text)

    # --- SAVE TO FILES ---
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    with open("current.md", "w", encoding="utf-8") as f:
        f.write(story_text)

    # Ensure the /archive folder exists or this might throw an error
    import os
    if not os.path.exists('./archive'):
        os.makedirs('./archive')

    with open(f"./archive/story_{timestamp}.md", "w", encoding="utf-8") as f:
        f.write(story_text)

    # 7. Save to a New Timestamped Excel File
    output_filename = f"./archive/folklore_gen_{timestamp}.xlsx"
    selected_rows['Generated Story'] = story_text
    selected_rows.to_excel(output_filename, index=False)

    print(f"\n✅ Success!")
    print(f"1. Markdown updated: current.md")
    print(f"2. Archive created: {output_filename}")
else:
    print("\n❌ Process failed due to API limitations.")
