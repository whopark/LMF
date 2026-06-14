// §5 — clean-year common_key → classification map.
// Design Ref: §3.2 — priority high→low, dirty source years excluded. Plan SC: SC-2.
const CLEAN_YEARS = [2026, 2025, 2024, 2023, 2022];

// Build common_key → classification from clean years only (2026 wins, then older).
// Excludes dirty source years (2020/2021) and empty classifications.
function buildClassMap(docs, years = CLEAN_YEARS) {
  const map = new Map();
  for (const year of years) {
    for (const d of docs) {
      if (d.year !== year) continue;
      const key = d.common_key;
      const cls = d.classification;
      if (!key || !cls) continue;
      if (!map.has(key)) map.set(key, cls);
    }
  }
  return map;
}

module.exports = { buildClassMap, CLEAN_YEARS };
