#!/usr/bin/env python
"""
Quick test of core account intelligence functionality
"""

import sqlite3
import pandas as pd
from datetime import datetime, timedelta
from orchestration.db_utils import init_account_intelligence_tables
from orchestration.account_matching import AccountMatcher
from orchestration.account_scoring import AccountScorer


def test_database_setup():
    """Test that database tables are created correctly"""
    print("Testing database setup...")
    conn = sqlite3.connect(':memory:')
    init_account_intelligence_tables(conn)

    # Check tables exist
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in c.fetchall()]

    expected_tables = [
        'intent_data', 'ce_accounts', 'mal_accounts',
        'matched_accounts_scored', 'scoring_keywords', 'regional_mapping',
        'file_uploads'
    ]

    for table in expected_tables:
        assert table in tables, f"Missing table: {table}"

    print(f"✅ Database setup OK - {len(tables)} tables created")
    return conn


def test_account_matching(conn):
    """Test account matching logic"""
    print("\nTesting account matching...")

    # Insert test data
    c = conn.cursor()

    # Intent data
    c.execute("""INSERT INTO intent_data (company_name, domain, intent_score, keywords, search_date)
                 VALUES (?, ?, ?, ?, ?)""",
              ('Acme Corp', 'acme.com', 85.0, 'evergreen project management', datetime.now().date()))

    # CE data
    c.execute("""INSERT INTO ce_accounts (account_name, domain, region, industry, opportunity_count)
                 VALUES (?, ?, ?, ?, ?)""",
              ('Acme Corporation', 'acme.com', 'US-East', 'Tech', 2))

    # MAL data
    c.execute("""INSERT INTO mal_accounts (company_name, domain, region, category)
                 VALUES (?, ?, ?, ?)""",
              ('Acme Corp', 'acme.com', 'US-East', 'Enterprise'))

    conn.commit()

    # Test matching
    matcher = AccountMatcher(conn)
    matched_df = matcher.match_accounts()

    assert len(matched_df) > 0, "No accounts matched"
    assert matched_df.iloc[0]['overlap_sources'] == ['intent', 'ce', 'mal'], "Should match all 3 sources"

    print(f"✅ Account matching OK - matched {len(matched_df)} accounts")
    print(f"   Sample: {matched_df.iloc[0]['company_name']} (overlap: {len(matched_df.iloc[0]['overlap_sources'])} sources)")


def test_account_scoring(conn):
    """Test account scoring logic"""
    print("\nTesting account scoring...")

    # First ensure we have matched accounts
    c = conn.cursor()
    c.execute("""INSERT INTO matched_accounts_scored
                 (intent_id, ce_id, mal_id, company_name, domain, region,
                  intent_tier, intent_score, intent_keywords, ce_status,
                  overlap_count, overlap_sources)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
              (1, 1, 1, 'Acme Corp', 'acme.com', 'US-East',
               1, 85.0, 'evergreen project management', 'Active',
               3, 'intent,ce,mal'))
    conn.commit()

    scorer = AccountScorer(conn)
    scored_df = scorer.score_all_accounts()

    assert len(scored_df) > 0, "No accounts scored"
    final_score = scored_df.iloc[0]['final_score']
    keyword_tier = scored_df.iloc[0]['keyword_tier']
    assert int(final_score) > 0, f"Score should be > 0, got {final_score}"
    assert int(keyword_tier) == 1, f"Should detect Tier 1, got {keyword_tier}"

    print(f"✅ Account scoring OK")
    print(f"   Sample score: {scored_df.iloc[0]['final_score']}/100")
    print(f"   Keywords matched: {scored_df.iloc[0]['matched_keywords']}")
    print(f"   Reasoning: {scored_df.iloc[0]['reasoning']}")


def main():
    """Run all tests"""
    print("=" * 60)
    print("ACCOUNT INTELLIGENCE MVP - CORE FUNCTIONALITY TEST")
    print("=" * 60)

    try:
        conn = test_database_setup()
        test_account_matching(conn)
        test_account_scoring(conn)

        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    exit(main())
