#!/usr/bin/env python3
"""
Lab Accreditation Dashboard (종합검증 분석)
Final polished version with charts.
"""

import json
from pathlib import Path
from collections import defaultdict
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from datetime import datetime

# ====================== CONFIG ======================
DATA_FILE = Path("verification_reports_v4.json")
OUTPUT_DIR = Path("dashboard_output")
OUTPUT_DIR.mkdir(exist_ok=True)

# Korean font configuration (Windows: Malgun Gothic, macOS: AppleGothic, Linux: NanumGothic)
def set_korean_font():
    """Configure matplotlib to use a Korean font."""
    korean_fonts = ['Malgun Gothic', 'AppleGothic', 'NanumGothic', 'NanumBarunGothic', 'Gulim']
    available_fonts = [f.name for f in fm.fontManager.ttflist]

    for font in korean_fonts:
        if font in available_fonts:
            plt.rcParams['font.family'] = font
            plt.rcParams['axes.unicode_minus'] = False  # Fix minus sign display
            print(f"Using Korean font: {font}")
            return font

    print("Warning: No Korean font found. Korean text may not display correctly.")
    return None

plt.style.use('seaborn-v0_8-darkgrid')
plt.rcParams['figure.figsize'] = (12, 8)
plt.rcParams['font.size'] = 11

# Set Korean font AFTER style.use() to prevent override
set_korean_font()

# ====================== LOAD DATA ======================
print("Loading data...")
data = json.loads(DATA_FILE.read_text(encoding="utf-8"))

records = []
for report in data:
    year = report["year"]
    for item in report.get("checklist_items", []):
        records.append({
            "year": year,
            "section": (item.get("section") or "Unknown").strip() or "Unknown",
            "item_code": item.get("item_code"),
            "category": item.get("category"),
            "max_points": item.get("max_points") or 0,
            "awarded_points": item.get("awarded_points") or 0,
            "result": item.get("result"),
            "description": item.get("description", "")[:80]
        })

df = pd.DataFrame(records)
print(f"Loaded {len(df)} checklist items from {len(data)} reports.\n")

# ====================== ANALYSIS ======================
print("=== LAB ACCREDITATION DASHBOARD ===\n")
print(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

# 1. Summary
print("SUMMARY")
print("="*50)
print(f"Total Reports          : {len(data)}")
print(f"Total Checklist Items : {len(df)}")
print(f"Years Covered          : {sorted(df['year'].unique())}")
print(f"Items with scores      : {(df['max_points'] > 0).sum()}")
print()

# 2. Weakest Sections by Year
print("WEAKEST SECTIONS BY YEAR")
print("="*80)
year_section = df.groupby(['year', 'section']).agg(
    items=('item_code', 'count'),
    total_max=('max_points', 'sum'),
    total_awarded=('awarded_points', 'sum'),
    failed=('result', lambda x: (x == '아니오').sum())
).reset_index()

year_section['compliance'] = (year_section['total_awarded'] / year_section['total_max'] * 100).round(1)
year_section = year_section.sort_values(['year', 'compliance'])

for year in sorted(year_section['year'].unique(), reverse=True):
    subset = year_section[year_section['year'] == year].head(6)
    print(f"\nYear {year}:")
    for _, row in subset.iterrows():
        print(f"  {row['compliance']:5.1f}% | {row['section'][:48]:48} | {row['items']:2} items | {row['failed']} failed")

# 3. Overall Weakest Sections
print("\n\nOVERALL WEAKEST SECTIONS (All Years)")
print("="*80)
overall = df.groupby('section').agg(
    items=('item_code', 'count'),
    total_max=('max_points', 'sum'),
    total_awarded=('awarded_points', 'sum'),
    failed=('result', lambda x: (x == '아니오').sum())
).reset_index()

overall['compliance'] = (overall['total_awarded'] / overall['total_max'] * 100).round(1)
overall = overall.sort_values('compliance').head(10)

for _, row in overall.iterrows():
    print(f"  {row['compliance']:5.1f}% | Failed: {row['failed']:2} | {row['section']}")

# 4. Top 10 Most Problematic Items
print("\n\nTOP 10 MOST PROBLEMATIC ITEMS")
print("="*80)
problem_items = df[df['result'] == '아니오'].groupby(['item_code', 'description']).size().reset_index(name='fail_count')
problem_items = problem_items.sort_values('fail_count', ascending=False).head(10)

for _, row in problem_items.iterrows():
    print(f"  {row['fail_count']} times | {row['item_code']} | {row['description']}")

# ====================== CHARTS ======================
print("\nGenerating charts...")

# Chart 1: Compliance Trend by Year
fig, axes = plt.subplots(2, 2, figsize=(15, 12))
fig.suptitle('Lab Accreditation Analysis Dashboard\n우수검사실 종합검증 보고서 분석', fontsize=16, fontweight='bold')

# 1. Overall Compliance by Year
year_compliance = df.groupby('year').apply(
    lambda x: (x['awarded_points'].sum() / x['max_points'].sum() * 100) if x['max_points'].sum() > 0 else 0
).round(1)

year_compliance.plot(kind='bar', ax=axes[0,0], color='steelblue')
axes[0,0].set_title('Overall Compliance Rate by Year')
axes[0,0].set_ylabel('Compliance (%)')
axes[0,0].set_ylim(0, 100)

# 2. Failed Items by Year
failed_by_year = df[df['result'] == '아니오'].groupby('year').size()
failed_by_year.plot(kind='bar', ax=axes[0,1], color='darkred')
axes[0,1].set_title('Number of Failed Items by Year')
axes[0,1].set_ylabel('Failed Items')

# 3. Top Weak Sections
top_weak = overall.head(8).set_index('section')['compliance']
top_weak.plot(kind='barh', ax=axes[1,0], color='coral')
axes[1,0].set_title('Top 8 Weakest Sections (Lower is Worse)')
axes[1,0].invert_yaxis()

# 4. Category Performance
if 'category' in df.columns:
    cat_perf = df.groupby('category').apply(
        lambda x: (x['awarded_points'].sum() / x['max_points'].sum() * 100) if x['max_points'].sum() > 0 else 0
    ).round(1)
    cat_perf.plot(kind='bar', ax=axes[1,1], color=['green','orange','blue'])
    axes[1,1].set_title('Performance by Category (Core / Required / Basic)')
    axes[1,1].set_ylabel('Compliance (%)')
    axes[1,1].set_ylim(0, 100)

plt.tight_layout(rect=[0, 0, 1, 0.96])
plt.savefig(OUTPUT_DIR / "dashboard_charts.png", dpi=300, bbox_inches='tight')
print(f"Charts saved to: {OUTPUT_DIR}/dashboard_charts.png")

print("\n" + "="*80)
print("🎉 DASHBOARD COMPLETE!")
print(f"Output directory : {OUTPUT_DIR}")
print("Main chart        : dashboard_charts.png")
print("\nYou can re-run this script anytime with: python dashboard.py")
