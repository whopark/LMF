require('dotenv').config();

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const ChecklistItem = require('./models/ChecklistItem');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lab_accreditation';
const JSON_FILE = process.env.IMPORT_JSON || path.join(__dirname, '../../pdf/checklist_items_final.json');

async function importData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    console.log('Reading JSON file...');
    const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
    console.log(`Loaded ${data.length} items`);

    console.log('Clearing existing data...');
    await ChecklistItem.deleteMany({});

    console.log('Importing data...');
    const result = await ChecklistItem.insertMany(data);
    console.log(`Imported ${result.length} items`);

    const count = await ChecklistItem.countDocuments();
    const years = await ChecklistItem.distinct('metadata.year');
    const areas = await ChecklistItem.distinct('area');

    console.log('\n--- Import Summary ---');
    console.log(`Total items: ${count}`);
    console.log(`Years: ${years.sort().join(', ')}`);
    console.log(`Areas: ${areas.length}`);

    await mongoose.disconnect();
    console.log('\nImport completed successfully!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

importData();
