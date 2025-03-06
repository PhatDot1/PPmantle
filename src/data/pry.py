import json

file_path = "numberbatch-en-19.08.json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Print the number of keys and the first 10 keys with a sample of their vectors
print("Total words:", len(data))
for key in list(data.keys())[:10]:
    # Print the key and the first 5 numbers of its vector
    print(key, data[key][:5])
