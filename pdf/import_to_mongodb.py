import json
from pathlib import Path
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Configuration
JSON_FILE = Path("/mnt/d/LMF_all/pdf/verification_reports_v4.json")
MONGO_URI = "mongodb://127.0.0.1:27017/"
DB_NAME = "lab_accreditation"
COLLECTION_NAME = "verification_reports"

def main():
    print("🚀 Starting MongoDB Import for Comprehensive Verification Reports")
    print("=" * 70)
    
    # Load JSON data
    try:
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            documents = json.load(f)
        print(f"✅ Loaded {len(documents)} verification reports from {JSON_FILE.name}")
    except Exception as e:
        print(f"❌ Failed to load JSON: {e}")
        return

    # Connect to MongoDB
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.server_info()  # Test connection
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        print(f"✅ Connected to MongoDB: {DB_NAME}.{COLLECTION_NAME}")
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        print(f"❌ MongoDB Connection Failed: {e}")
        print("   Make sure mongod is running on localhost:27017")
        return
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return

    # Clear existing data (change to False if you want to append)
    clear_existing = True
    if clear_existing:
        result = collection.delete_many({})
        print(f"🗑️  Cleared {result.deleted_count} existing documents")

    # Insert new documents
    try:
        result = collection.insert_many(documents)
        print(f"✅ Successfully inserted {len(result.inserted_ids)} documents")
    except Exception as e:
        print(f"❌ Insert failed: {e}")
        return

    # Create indexes (as per schema)
    print("\n📊 Creating recommended indexes...")
    indexes = [
        ("year", 1),
        ("checklist_items.item_code", 1),
        ("checklist_items.category", 1),
        ("checklist_items.section", 1),
        ("full_markdown", "text")
    ]
    
    for field, direction in indexes:
        try:
            if field == "full_markdown":
                collection.create_index([("full_markdown", "text")])
                print(f"   Created text index on full_markdown")
            else:
                collection.create_index([(field, direction)])
                print(f"   Created index on {field}")
        except Exception as e:
            print(f"   Warning creating index on {field}: {e}")

    # Final statistics
    total_docs = collection.count_documents({})
    total_items = sum(len(doc.get('checklist_items', [])) for doc in documents)
    
    print("\n" + "=" * 70)
    print("🎉 IMPORT COMPLETED SUCCESSFULLY")
    print("=" * 70)
    print(f"Database          : {DB_NAME}")
    print(f"Collection        : {COLLECTION_NAME}")
    print(f"Documents imported: {total_docs}")
    print(f"Total checklist items: {total_items}")
    print(f"Years covered     : {sorted([doc.get('year') for doc in documents])}")
    print(f"Imported at       : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\nRecommended queries:")
    print("  - db.verification_reports.find({year: 2026})")
    print("  - db.verification_reports.aggregate([{$unwind: '$checklist_items'}, {$group: {_id: '$checklist_items.category', count: {$sum: 1}}}])")
    
    client.close()

if __name__ == "__main__":
    main()
