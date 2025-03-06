import gzip
import json

# Input gzipped file and output JSON file paths
input_filename = "numberbatch-en-19.08.txt.gz"
output_filename = "numberbatch-en-19.08.json"

embeddings = {}

with gzip.open(input_filename, mode="rt", encoding="utf8") as f:
    # Read the first line and check for a header line
    first_line = f.readline().strip()
    parts = first_line.split()
    # If the header is two numbers, skip it
    if len(parts) == 2 and parts[0].isdigit():
        print("Header detected; skipping header line:", parts)
    else:
        # Process the first line as data
        word_key = parts[0]
        # Remove '/c/en/' prefix if present and force lowercase
        if word_key.startswith("/c/en/"):
            word_key = word_key[len("/c/en/"):]
        word_key = word_key.lower()
        try:
            vector = [float(x) for x in parts[1:]]
            embeddings[word_key] = vector
        except ValueError:
            print(f"Skipping malformed line: {first_line}")

    # Process remaining lines
    line_count = 1
    for line in f:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        word_key = parts[0]
        if word_key.startswith("/c/en/"):
            word_key = word_key[len("/c/en/"):]
        word_key = word_key.lower()  # force lowercase
        try:
            vector = [float(x) for x in parts[1:]]
            embeddings[word_key] = vector
        except ValueError:
            print(f"Skipping malformed line {line_count}: {line}")
        line_count += 1

# Write the embeddings dictionary to a JSON file
with open(output_filename, "w", encoding="utf8") as out:
    json.dump(embeddings, out)

print(f"Converted embeddings saved to {output_filename}")
