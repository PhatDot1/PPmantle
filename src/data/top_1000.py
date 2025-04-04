import os
import re
import json
import math
import random
import nltk
from nltk.corpus import wordnet as wn
from nltk.corpus import brown

# Download necessary corpora if not already available.
nltk.download('wordnet')
nltk.download('brown')

def cosine_similarity(vecA, vecB):
    dot_product = sum(a * b for a, b in zip(vecA, vecB))
    normA = math.sqrt(sum(a * a for a in vecA))
    normB = math.sqrt(sum(b * b for b in vecB))
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

# Set a frequency threshold (adjust this value to get ~10,000 candidate words)
FREQ_THRESHOLD = 5  # You can experiment with this number.

# Only keep words that appear at least FREQ_THRESHOLD times in Brown corpus.
common_words = {word for word in wordnet_words if fdist[word] >= FREQ_THRESHOLD}

print("Number of candidate words:", len(common_words))
# If the number is not around 10,000, adjust FREQ_THRESHOLD accordingly.

if not common_words:
    raise Exception("No common words found based on the frequency threshold.")

# Load the full embeddings file.
with open("numberbatch-en-19.08.json", "r", encoding="utf8") as f:
    embeddings = json.load(f)

# Ensure all keys are lowercase.
embeddings = {k.lower(): v for k, v in embeddings.items()}

# Helper function to check if a word is a noun, verb, or adjective and exists in the embeddings.
def is_valid_target(word):
    # Check if word is in embeddings.
    if word not in embeddings:
        return False
    # Check if there is at least one synset for the word with pos noun, verb, or adjective.
    synsets = wn.synsets(word)
    if any(syn.pos() in [wn.NOUN, wn.VERB, wn.ADJ] for syn in synsets):
        return True
    return False

# Randomly select a target word from the filtered set that meets the criteria.
target_word = random.choice(list(common_words))
attempts = 0
while not is_valid_target(target_word):
    target_word = random.choice(list(common_words))
    attempts += 1
    if attempts > 1000:
        raise ValueError("Could not find a valid target word after 1000 attempts.")
print(f"Target word '{target_word}' is valid and found in embeddings.")

target_vector = embeddings[target_word]
ranking = []

for word, vector in embeddings.items():
    # Only consider single words (skip if the word has an underscore) and skip the target word.
    if word == target_word or "_" in word:
        continue
    similarity = cosine_similarity(target_vector, vector)
    ranking.append({"word": word, "similarity": similarity})

# Sort in descending order by similarity and take the top 1000.
ranking.sort(key=lambda x: x["similarity"], reverse=True)
top_1000 = ranking[:1000]

# Set output directory as the same directory as this script.
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
