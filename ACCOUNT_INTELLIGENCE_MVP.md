# Hot Accounts Intelligence MVP

**Version 1.0 - MVP Prototype** 🔥

Account prioritization based on intent signals (6sense), CRM data (CE), and marketing account lists (MAL).

## Overview

This MVP enables regional sales managers to identify and prioritize high-value accounts based on:
- **Intent signals** from 6sense (90-day window)
- **CRM data** from Microsoft Dynamics (existing opportunities, deal stages)
- **Marketing lists** from internal MAL systems
- **Keyword-based scoring** (brand, competitor, generic, industry keywords)

## How It Works

### 1. **Upload Data** (Tab: Upload Data)

Upload Excel files from three sources:

| Source | File | Required Columns | Description |
|--------|------|------------------|-------------|
| **6sense** | Intent export | `company_name`, `domain`, `intent_score`, `keywords`, `search_date` | Intent signals, filtered to last 90 days |
| **CE (CRM)** | Account export | `account_name`, `domain` | CRM accounts from Dynamics 365 |
| **MAL** | Marketing list | `company_name`, `domain`, `region` | Internal marketing account list |

**Optional columns:**
- CE: `region`, `industry`, `opportunity_count`, `customer_status`
- 6sense: Auto-detected from export
- MAL: `region`, `category`

### 2. **Match Accounts**

Click "Match & Score Accounts" to:
1. **Fuzzy match** accounts across the three sources using:
   - Exact domain matching (highest confidence)
   - Company name fuzzy matching (85%+ threshold)
2. **Score each account** based on:
   - **Overlap**: All 3 sources → 40 pts | 2 sources → 25 pts | 1 source → 10 pts
   - **Keywords**: Brand (Tier 1) → 55 pts | Competitor (Tier 2) → 40 pts | Generic (Tier 3) → 25 pts | Industry (Tier 4) → 10 pts
   - **CRM bonus**: +10 pts if account exists in CRM
   - **Final score**: 0-100 (normalized)

### 3. **Filter & View** (Tab: Dashboard)

Filter accounts by:
- **Region**: UK, Germany, US, or custom regions from your CE data
- **Keyword Tier**: Brand, Competitor, Generic, or Industry keywords
- **Score Range**: 0-100
- **Data Sources**: Accounts in 1, 2, or 3 sources

**Color Coding:**
- 🔴 Tier 1 (Brand keywords) - Urgent priority
- 🟠 Tier 2 (Competitor keywords) - Hot lead
- 🟡 Tier 3 (Generic keywords) - Warm lead
- ⚪ Tier 4 (Industry keywords) - Nurture

### 4. **Export Results**

Export filtered account list as CSV with:
- Company name, domain, region
- Intent tier, matched keywords
- Data sources (how many data sources account appears in)
- Final priority score
- CRM status

## Scoring Logic

### Keyword Tiers

**Tier 1 - Brand Keywords** (Base: 50-60 pts)
- Keywords: "evergreen", "nested lovable", "number one", "empower", "say go"
- Interpretation: They're already familiar with your brand
- CE Bonus: +10 pts (already a customer/prospect)

**Tier 2 - Competitor Keywords** (Base: 35-45 pts)
- Keywords: "deltek", "elite", "adorant", "jd8", "consolation"
- Interpretation: Actively evaluating competitors
- CE Bonus: +10 pts (high-value prospect)

**Tier 3 - Generic Solution Keywords** (Base: 20-30 pts)
- Keywords: "project management", "erp", "crm", "service centric", "homebuilders"
- Interpretation: Searching for solution category, not specific vendor
- CE Bonus: +5 pts

**Tier 4 - Industry Keywords** (Base: 5-15 pts)
- Keywords: General industry topics
- Interpretation: Early-stage interest, nurture only
- No CE bonus

### Overlap Scoring

| Sources | Score | Interpretation |
|---------|-------|-----------------|
| 3 (intent + CE + MAL) | 40 | Best: In all 3 sources, high intent + existing relationship |
| 2 (any combination) | 25 | Good: Multiple source confirmation |
| 1 (intent only) | 10 | Nurture: New intent signal, not yet in CRM/MAL |

### Final Score Formula

```
Final Score = min(100, Overlap Score + Keyword Score + CE Bonus)
```

**Examples:**
- Tier 1 + 3 sources + in CE = 40 + 55 + 10 = **100/100** ← Act now
- Tier 2 + 3 sources = 40 + 40 + 10 = **90/100** ← Hot lead
- Tier 2 + 2 sources = 25 + 40 + 0 = **65/100** ← Warm lead
- Tier 3 + 1 source = 10 + 25 + 0 = **35/100** ← Nurture

## Getting Started

### Prerequisites

```bash
pip install -r requirements.txt
```

### Running the MVP

1. **Start the app:**
   ```bash
   streamlit run app.py
   ```

2. **Navigate to:** Sidebar → "🔥 Hot Accounts"

3. **Upload data:**
   - Go to "Upload Data" tab
   - Upload 6sense intent export
   - Upload CE (CRM) accounts export
   - Upload MAL (marketing list) export

4. **Click "Match & Score Accounts"**

5. **View results:** Go to "Dashboard" tab
   - Filter by region, keyword tier, score range
   - Export CSV for sharing with sales teams

### Data Upload Tips

**6sense Export:**
- Ensure the file includes columns: `company_name`, `domain`, `keywords`, `intent_score`
- Data is automatically filtered to last 90 days
- Duplicates by domain are removed

**CE (CRM) Export:**
- From Microsoft Dynamics 365: Accounts → Export to Excel
- Must include: `account_name`, `domain`
- Optional: `region` (critical for regional filtering)

**MAL Export:**
- From your internal marketing system
- Must include: `company_name`, `domain`
- Include `region` for regional segmentation

## Database Schema

All data is stored locally in SQLite (`content_hub_v2.db`):

```
intent_data              → Raw 6sense intent signals
ce_accounts              → CRM accounts from Dynamics
mal_accounts             → Internal marketing account list
matched_accounts_scored  → Final matched + scored accounts
scoring_keywords         → User-configurable keyword tiers
regional_mapping         → Manual region overrides
file_uploads             → Upload audit trail
```

## Customization

### Change Keyword Lists

Edit `scoring_keywords` table in database:

```python
import sqlite3
conn = sqlite3.connect('content_hub_v2.db')
c = conn.cursor()

# Update Tier 1 keywords
c.execute("""UPDATE scoring_keywords SET keyword_list = ? WHERE tier = 1""",
          ("evergreen, nested lovable, number one, empower, custom_keyword",))
conn.commit()
```

### Change Scoring Weights

Modify `KEYWORD_TIER_SCORES` and `OVERLAP_SCORES` dicts in `orchestration/account_scoring.py`

### Add/Change Regions

Regions are auto-detected from CE account data. If needed, manually override in `regional_mapping` table.

## Limitations (MVP)

- ❌ No real-time API integrations (manual Excel uploads only)
- ❌ No scheduling/automation (run manually when needed)
- ❌ No asset recommendations (Phase 2)
- ❌ No Slack notifications (Phase 2)
- ❌ No historical tracking (Phase 2)

## Next Steps

**Phase 2 (Post-MVP):**
1. Real-time 6sense API integration
2. Dynamics 365 API integration
3. Auto-generated asset recommendations
4. Slack notifications for hot accounts
5. Account engagement tracking

---

**Status:** ✅ MVP Complete
**Last Updated:** 2024
**Support:** Contact marketing ops team
