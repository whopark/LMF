#!/usr/bin/env python3
"""
Transform checklist_items_final.json to structured_sections format
and upload to MongoDB Atlas.
"""

import json
import os
from collections import defaultdict
from datetime import datetime
from pymongo import MongoClient

# Configuration
JSON_FILE = "checklist_items_final.json"
MONGO_URI = os.environ.get("MONGO_URI", "")
DB_NAME = "lab_accreditation"
COLLECTION_NAME = "lab_checklists_2026_v8"

def load_data():
    """Load the flat JSON data."""
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def transform_to_structured(items):
    """
    Transform flat items to structured_sections format.

    Input format:
    {
        "area": "01 검사실운영",
        "sub_category": "심사범위",
        "about_item": {
            "item_number": "01.010.020",
            "item_type": null,
            "score": null,
            "question": "...",
            "description": "",
            "section": "심사범위"
        },
        "metadata": {
            "page": 9,
            "source": "01 검사실운영\\2020.pdf",
            "year": 2020
        }
    }

    Output format:
    {
        "year": 2020,
        "category": "01",
        "title": "01.검사실운영_2020",
        "structured_sections": [
            {
                "title": "심사범위",
                "items": [
                    {
                        "item_code": "01.010.020",
                        "requirement": "...",
                        "raw_line": "...",
                        "type": "필수",
                        "max_score": 10
                    }
                ]
            }
        ],
        "total_items": N
    }
    """
    # Group by (year, area)
    grouped = defaultdict(lambda: defaultdict(list))

    for item in items:
        year = item['metadata']['year']
        area = item['area']  # e.g., "01 검사실운영"
        section = item['about_item'].get('section', item.get('sub_category', 'Unknown'))

        grouped[(year, area)][section].append(item)

    # Transform to documents
    documents = []

    for (year, area), sections in grouped.items():
        # Extract category code (e.g., "01" from "01 검사실운영")
        parts = area.split(' ', 1)
        category_code = parts[0] if parts else area
        category_name = parts[1] if len(parts) > 1 else area

        # Build structured_sections
        structured_sections = []
        total_items = 0

        for section_title, section_items in sections.items():
            items_list = []
            for si in section_items:
                about = si['about_item']
                item = {
                    'item_code': about.get('item_number', ''),
                    'requirement': about.get('question', ''),
                    'raw_line': about.get('description', ''),
                    'type': about.get('item_type') or '필수',
                    'max_score': about.get('score') or 0,
                }
                items_list.append(item)
                total_items += 1

            structured_sections.append({
                'title': section_title,
                'items': items_list
            })

        # Sort sections by title for consistency
        structured_sections.sort(key=lambda x: x['title'])

        doc = {
            'year': year,
            'category': category_code,
            'title': f"{category_code}.{category_name}_{year}",
            'filename': f"{area}/{year}.pdf",
            'page_count': 0,
            'parsed_at': datetime.now().isoformat(),
            'parser_version': 'transform_v1',
            'structured_sections': structured_sections,
            'total_items': total_items,
            'tags': [category_name],
            'status': 'imported',
            'imported_at': datetime.now().isoformat(),
            'imported_via': 'transform_and_upload.py'
        }
        documents.append(doc)

    # Sort by year and category for predictable order
    documents.sort(key=lambda x: (x['year'], x['category']))

    return documents

def upload_to_mongodb(documents):
    """Upload documents to MongoDB Atlas."""
    if not MONGO_URI:
        print("ERROR: MONGO_URI environment variable not set")
        print("Please set it to your MongoDB Atlas connection string:")
        print("  export MONGO_URI='mongodb+srv://...'")
        return False

    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
        # Test connection
        client.server_info()
        print(f"Connected to MongoDB Atlas")

        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]

        # Clear existing data
        result = collection.delete_many({})
        print(f"Cleared {result.deleted_count} existing documents")

        # Insert new documents
        result = collection.insert_many(documents)
        print(f"Inserted {len(result.inserted_ids)} documents")

        # Create indexes
        collection.create_index('year')
        collection.create_index('category')
        collection.create_index('structured_sections.items.item_code')
        print("Created indexes")

        client.close()
        return True

    except Exception as e:
        print(f"MongoDB Error: {e}")
        return False

def save_transformed_json(documents, filename="transformed_data.json"):
    """Save transformed data to JSON for verification."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(documents, f, ensure_ascii=False, indent=2)
    print(f"Saved transformed data to {filename}")

def main():
    print("=" * 60)
    print("PDF Data Transformation and Upload Script")
    print("=" * 60)

    # Load data
    print("\n[1/3] Loading data from checklist_items_final.json...")
    items = load_data()
    print(f"     Loaded {len(items)} items")

    # Transform
    print("\n[2/3] Transforming to structured_sections format...")
    documents = transform_to_structured(items)
    print(f"     Created {len(documents)} documents")

    # Summary
    years = sorted(set(d['year'] for d in documents))
    categories = sorted(set(d['category'] for d in documents))
    total_items = sum(d['total_items'] for d in documents)

    print(f"\n     Summary:")
    print(f"       - Years: {years}")
    print(f"       - Categories: {categories}")
    print(f"       - Total items: {total_items}")

    # Save JSON for verification
    save_transformed_json(documents)

    # Upload
    print("\n[3/3] Uploading to MongoDB Atlas...")
    if upload_to_mongodb(documents):
        print("\n" + "=" * 60)
        print("SUCCESS: Data uploaded to MongoDB Atlas")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("FAILED: Could not upload to MongoDB")
        print("Transformed data saved to transformed_data.json")
        print("=" * 60)

if __name__ == "__main__":
    main()
