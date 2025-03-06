import json
import os
import psycopg2
from dotenv import load_dotenv
load_dotenv()
# Read database URL from environment variables
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("DATABASE_URL environment variable not set.")

# Path to your JSON file with embeddings
EMBEDDINGS_FILE = "numberbatch-en-19.08.json"

# Connect to PostgreSQL
conn = psycopg2.connect(DATABASE_URL, sslmode="require")
cur = conn.cursor()

# Load embeddings JSON data
print("Loading embeddings from file...")
with open(EMBEDDINGS_FILE, "r", encoding="utf8") as f:
    embeddings = json.load(f)

print(f"Total embeddings to insert: {len(embeddings)}")

# Insert each embedding into the database.
# We force keys to lowercase for consistency.
count = 0
for word, vector in embeddings.items():
    word_lower = word.lower()
    try:
        cur.execute(
            "INSERT INTO embeddings (word, vector) VALUES (%s, %s) ON CONFLICT (word) DO NOTHING;",
            (word_lower, vector)
        )
        count += 1
        if count % 10000 == 0:
            print(f"Inserted {count} entries...")
    except Exception as e:
        print(f"Error inserting word {word_lower}: {e}")

conn.commit()
cur.close()
conn.close()

print(f"Inserted {count} embeddings into the database.")
