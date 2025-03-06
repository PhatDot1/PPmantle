import os
import nltk
from nltk.corpus import wordnet as wn
from nltk.corpus import brown

# Ensure required corpora are downloaded.
nltk.download('wordnet')
nltk.download('brown')

# Build a set of single words (without underscores) from WordNet (nouns, verbs, adjectives).
wordnet_words = set()
for pos in [wn.NOUN, wn.VERB, wn.ADJ]:
    for syn in wn.all_synsets(pos):
        for lemma in syn.lemma_names():
            if "_" not in lemma:  # Only single words.
                wordnet_words.add(lemma.lower())

# Build a frequency distribution from the Brown corpus.
brown_words = [w.lower() for w in brown.words() if w.isalpha()]
fdist = nltk.FreqDist(brown_words)

# Set the frequency threshold.
FREQ_THRESHOLD = 6

# Keep only words that occur at least FREQ_THRESHOLD times in the Brown corpus.
common_words = {word for word in wordnet_words if fdist[word] >= FREQ_THRESHOLD}

print("Number of candidate words:", len(common_words))

# Write the candidate words to a text file, one word per line.
output_path = os.path.join(os.getcwd(), "candidate_words.txt")
with open(output_path, "w", encoding="utf8") as f:
    for word in sorted(common_words):
        f.write(word + "\n")

print(f"Candidate words saved to {output_path}")
