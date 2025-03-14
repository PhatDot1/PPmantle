import os
import re
import json
import math
import random
import nltk
import psycopg2
from nltk.corpus import wordnet as wn
from nltk.corpus import brown
from dotenv import load_dotenv 
from datetime import date  # New import for getting the current date

load_dotenv()

# Download necessary corpora if not already available.
nltk.download('wordnet')
nltk.download('brown')

def cosine_similarity(vecA, vecB):
    # Convert each element to float to avoid mixing Decimal and float types.
    dot_product = sum(float(a) * float(b) for a, b in zip(vecA, vecB))
    normA = math.sqrt(sum(float(a) * float(a) for a in vecA))
    normB = math.sqrt(sum(float(b) * float(b) for b in vecB))
    return dot_product / (normA * normB)

# Build a set of single words from WordNet for nouns, verbs, and adjectives.
wordnet_words = set()
for pos in [wn.NOUN, wn.VERB, wn.ADJ]:
    for syn in wn.all_synsets(pos):
        for lemma in syn.lemma_names():
            # Only add single words (skip if underscore is present)
            if "_" not in lemma:
                wordnet_words.add(lemma.lower())

# Build a frequency distribution from the Brown corpus.
brown_words = [w.lower() for w in brown.words() if w.isalpha()]
fdist = nltk.FreqDist(brown_words)

# Set a frequency threshold (adjust this value to get enough potential words but easy enough - maybe also parse word types to reduce this further)
FREQ_THRESHOLD = 25 

# Only keep words that appear at least FREQ_THRESHOLD times in Brown corpus.
common_words = {word for word in wordnet_words if fdist[word] >= FREQ_THRESHOLD}

print("Number of candidate words:", len(common_words))
if not common_words:
    raise Exception("No common words found based on the frequency threshold.")

# Connect to the PostgreSQL database.
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("DATABASE_URL environment variable not set.")
# Adjust sslmode or add additional parameters as needed.
conn = psycopg2.connect(DATABASE_URL, sslmode="require")
cur = conn.cursor()

def get_embedding(word):
    """Fetch the embedding vector for a word from the database."""
    cur.execute("SELECT vector FROM embeddings WHERE word = %s", (word.lower(),))
    result = cur.fetchone()
    if result is None:
        return None
    return result[0]

def is_valid_target(word):
    """Return True if the word exists in the DB and has at least one noun, verb, or adjective synset."""
    embedding = get_embedding(word)
    if embedding is None:
        return False
    synsets = wn.synsets(word)
    return any(syn.pos() in [wn.NOUN, wn.VERB, wn.ADJ] for syn in synsets)

# Randomly select a target word from common_words that meets the criteria.
target_word = random.choice(list(common_words))
attempts = 0
while not is_valid_target(target_word):
    target_word = random.choice(list(common_words))
    attempts += 1
    if attempts > 1000:
        raise ValueError("Could not find a valid target word after 1000 attempts.")
print(f"Target word '{target_word}' is valid and found in the database.")

target_embedding = get_embedding(target_word)
if target_embedding is None:
    raise ValueError("Target embedding could not be retrieved from the database.")

# Retrieve all embeddings for single words (excluding words containing an underscore)
cur.execute("SELECT word, vector FROM embeddings WHERE word NOT LIKE '%\\_%'")
all_rows = cur.fetchall()

ranking = []
for word, vector in all_rows:
    # Skip if the word is the target (case-insensitive check) or contains underscore.
    if word.lower() == target_word or "_" in word:
        continue
    similarity = cosine_similarity(target_embedding, vector)
    ranking.append({"word": word.lower(), "similarity": similarity})

# Sort in descending order by similarity and take the top 1000.
ranking.sort(key=lambda x: x["similarity"], reverse=True)
top_1000 = ranking[:1000]

# Determine output directory (same directory as this script).
output_dir = os.path.dirname(os.path.abspath(__file__))

# Determine the new index {n} by checking for existing files.
existing_indices = []
pattern_txt = re.compile(r"^(\d+)\.txt$")
pattern_json = re.compile(r"^top1000_(\d+)\.json$")

for filename in os.listdir(output_dir):
    m = pattern_txt.match(filename)
    if m:
        existing_indices.append(int(m.group(1)))
    else:
        m = pattern_json.match(filename)
        if m:
            existing_indices.append(int(m.group(1)))

n = max(existing_indices) + 1 if existing_indices else 1

# Write the target word to {n}.txt.
target_word_filename = os.path.join(output_dir, f"{n}.txt")
with open(target_word_filename, "w", encoding="utf8") as out_txt:
    out_txt.write(target_word)

# Write the top 1000 similar words to top1000_{n}.json.
top_1000_filename = os.path.join(output_dir, f"top1000_{n}.json")
with open(top_1000_filename, "w", encoding="utf8") as out_json:
    json.dump(top_1000, out_json)

print(f"Target word '{target_word}' saved to {target_word_filename}.")
print(f"Top 1000 similar words saved to {top_1000_filename}.")

# Update dailyCount.json with the current date and the current count (n)
daily_count = {"date": date.today().strftime("%Y-%m-%d"), "count": n}
daily_count_filename = os.path.join(output_dir, "dailyCount.json")
with open(daily_count_filename, "w", encoding="utf8") as dc_file:
    json.dump(daily_count, dc_file)
print(f"Daily count updated in {daily_count_filename} with: {daily_count}")

# Close the database connection.
cur.close()
conn.close()
