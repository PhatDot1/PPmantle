import json
file_path = "numberbatch-en-19.08.json"
with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)
print("Total words:", len(data))
print("Vector for 'banana':", data.get("banana", "Not found"))
