import os
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
FREQ_THRESHOLD = 6  # You can experiment with this number.

# Only keep words that appear at least FREQ_THRESHOLD times in Brown corpus.
common_words = {word for word in wordnet_words if fdist[word] >= FREQ_THRESHOLD}

print("Number of candidate words:", len(common_words))
# If the number is not around 10,000, adjust FREQ_THRESHOLD accordingly.

if not common_words:
    raise Exception("No common words found based on the frequency threshold.")

# Randomly select a target word from the filtered set.
target_word = random.choice(list(common_words))
print(f"Randomly selected target word from NLTK WordNet (filtered by frequency): {target_word}")

# Load the full embeddings file
with open("numberbatch-en-19.08.json", "r", encoding="utf8") as f:
    embeddings = json.load(f)

# Ensure all keys are lowercase
embeddings = {k.lower(): v for k, v in embeddings.items()}

# If the randomly chosen word is not in embeddings, try repeatedly until one is found.
attempts = 0
while target_word not in embeddings:
    attempts += 1
    target_word = random.choice(list(common_words))
    if attempts > 1000:
        raise ValueError("Could not find a target word in the embeddings after 1000 attempts.")
print(f"Target word '{target_word}' is found in embeddings.")

target_vector = embeddings[target_word]
ranking = []

for word, vector in embeddings.items():
    # Only consider single words (skip if the word has an underscore) and skip the target word.
    if word == target_word or "_" in word:
        continue
    similarity = cosine_similarity(target_vector, vector)
    ranking.append({"word": word, "similarity": similarity})

# Sort in descending order by similarity and take the top 1000
ranking.sort(key=lambda x: x["similarity"], reverse=True)
top_1000 = ranking[:1000]

output_filename = f"top1000_{target_word}.json"
with open(output_filename, "w", encoding="utf8") as out:
    json.dump(top_1000, out)

print(f"Top 1000 single-word ranking for '{target_word}' saved to {output_filename}.")
