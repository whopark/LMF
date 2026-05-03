import os
import json
from pymongo import MongoClient

def upload():
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017/")
    client = MongoClient(mongo_uri)
    db = client["lab_accreditation"]
    col = db["checklist_items"]
    
    json_path = r"e:\LMF_all\pdf\checklist_items_final.json"
    
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    print(f"📊 JSON contains {len(data)} items.")
    
    # ── Clear existing ───────────────────────────────────
    print("🗑️  Clearing existing documents and indexes...")
    col.delete_many({})
    
    # Drop all non-ID indexes to avoid schema conflicts
    print("🧹 Dropping old indexes...")
    for idx_name in col.index_information():
        if idx_name != "_id_":
            col.drop_index(idx_name)
    
    # Create the correct NEW index
    print("🎨 Creating new schema-aligned index...")
    col.create_index([
        ("area", 1), 
        ("metadata.year", 1), 
        ("about_item.item_number", 1)
    ], unique=True)
    
    # ── Insert ───────────────────────────────────────────
    print(f"📤 Inserting {len(data)} documents into MongoDB...")
    result = col.insert_many(data)
    print(f"✅ Successfully inserted {len(result.inserted_ids)} documents.")
    
    # Verify count
    final_count = col.count_documents({})
    print(f"📈 Final count in MongoDB: {final_count}")
    client.close()

if __name__ == "__main__":
    upload()
