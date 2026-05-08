#!/usr/bin/env node
/**
 * Upload transformed data to production API.
 *
 * Required environment variables:
 *   PRODUCTION_API_URL - Production API base URL
 *   PRODUCTION_API_KEY - API key for authentication
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const TRANSFORMED_FILE = path.join(__dirname, '../../pdf/transformed_data.json');
const PRODUCTION_API = process.env.PRODUCTION_API_URL;
const API_KEY = process.env.PRODUCTION_API_KEY;

// Validate required environment variables
if (!PRODUCTION_API || !API_KEY) {
  console.error('ERROR: Required environment variables not set');
  console.error('Please set the following in your .env file:');
  console.error('  PRODUCTION_API_URL=https://your-api-url.com');
  console.error('  PRODUCTION_API_KEY=your-api-key');
  process.exit(1);
}

async function uploadToProduction() {
  console.log('='.repeat(60));
  console.log('Upload Transformed Data to Production');
  console.log('='.repeat(60));

  // Load transformed data
  console.log('\n[1/3] Loading transformed data...');
  const data = JSON.parse(fs.readFileSync(TRANSFORMED_FILE, 'utf-8'));
  console.log(`     Loaded ${data.length} documents`);

  // Check current status
  console.log('\n[2/3] Checking current production status...');
  try {
    const statusRes = await fetch(`${PRODUCTION_API}/api/import/status`);
    const status = await statusRes.json();
    console.log(`     Current documents: ${status.totalDocuments}`);
    console.log(`     Current years: ${status.years?.join(', ') || 'none'}`);
  } catch (err) {
    console.log(`     Could not fetch status: ${err.message}`);
  }

  // Upload
  console.log('\n[3/3] Uploading to production...');
  console.log(`     Endpoint: ${PRODUCTION_API}/api/import/bulk`);

  try {
    const response = await fetch(`${PRODUCTION_API}/api/import/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        documents: data,
        clearExisting: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    console.log('\n' + '='.repeat(60));
    console.log('SUCCESS: Data uploaded to production');
    console.log('='.repeat(60));
    console.log(`Documents inserted: ${result.stats.documentsInserted}`);
    console.log(`Total in DB: ${result.stats.totalInDB}`);
    console.log(`Years: ${result.stats.years.join(', ')}`);
    console.log(`Categories: ${result.stats.categories.join(', ')}`);

  } catch (err) {
    console.error('\n' + '='.repeat(60));
    console.error('FAILED: Upload error');
    console.error('='.repeat(60));
    console.error(err.message);
    process.exit(1);
  }
}

uploadToProduction();
