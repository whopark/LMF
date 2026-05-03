#!/bin/bash
set -e

echo "=================================================="
echo "  MongoDB + Import Script for Verification Reports"
echo "=================================================="
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not available."
    echo "   Please make sure Docker Desktop is installed and running on Windows."
    echo "   Then run this script again."
    exit 1
fi

echo "✅ Docker detected."

# Start MongoDB container if not already running
if [ "$(docker ps -q -f name=mongodb)" ]; then
    echo "✅ MongoDB container is already running."
else
    echo "🚀 Starting MongoDB container..."
    docker run -d \
        --name mongodb \
        -p 27017:27017 \
        --restart unless-stopped \
        -v mongodb-data:/data/db \
        mongo:7
    
    echo "⏳ Waiting 8 seconds for MongoDB to initialize..."
    sleep 8
fi

echo "✅ MongoDB is running on port 27017"

# Run the import
cd /mnt/d/LMF_all/pdf

echo "📤 Importing verification_reports_v4.json into lab_accreditation.verification_reports..."

# Drop existing collection (safe)
docker run --rm \
    -v "$(pwd)":/data \
    mongo:7 mongosh --host host.docker.internal << 'EOF'
use lab_accreditation
db.verification_reports.drop()
print("Collection dropped successfully.")
EOF

# Import the data
docker run --rm \
    -v "$(pwd)":/data \
    mongo:7 mongoimport \
    --host host.docker.internal \
    --db lab_accreditation \
    --collection verification_reports \
    --file /data/verification_reports_v4.json \
    --jsonArray

echo ""
echo "✅ Data import completed!"

# Create indexes
echo "📊 Creating recommended indexes..."
docker run --rm \
    -v "$(pwd)":/data \
    mongo:7 mongosh --host host.docker.internal << 'EOF'
use lab_accreditation

db.verification_reports.createIndex({ year: 1 })
db.verification_reports.createIndex({ "checklist_items.item_code": 1 })
db.verification_reports.createIndex({ "checklist_items.category": 1 })
db.verification_reports.createIndex({ "checklist_items.section": 1 })
db.verification_reports.createIndex({ full_markdown: "text" })

print("✅ All indexes created.")

db.verification_reports.countDocuments()
EOF

echo ""
echo "=================================================="
echo "🎉 IMPORT SUCCESSFUL"
echo "=================================================="
echo "Database   : lab_accreditation"
echo "Collection : verification_reports"
echo "Data File  : verification_reports_v4.json"
echo ""
echo "You can now query with:"
echo "  mongosh --host host.docker.internal"
echo "  use lab_accreditation"
echo "  db.verification_reports.find({year: 2026}).pretty()"
echo ""
echo "To stop MongoDB later: docker stop mongodb"
echo "To start again   : docker start mongodb"
echo "=================================================="
