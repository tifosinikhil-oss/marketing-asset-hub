"""Database utilities for account intelligence system"""

import sqlite3


def init_account_intelligence_tables(conn: sqlite3.Connection):
    """Initialize database tables for account intelligence MVP"""
    c = conn.cursor()

    # Raw intent data (from 6sense exports)
    c.execute('''CREATE TABLE IF NOT EXISTS intent_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        domain TEXT,
        intent_score REAL,
        keywords TEXT,
        search_date DATE,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    # CE (CRM) accounts
    c.execute('''CREATE TABLE IF NOT EXISTS ce_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_name TEXT NOT NULL,
        domain TEXT,
        region TEXT,
        industry TEXT,
        opportunity_count INTEGER,
        customer_status TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    # MAL (Marketing Account List)
    c.execute('''CREATE TABLE IF NOT EXISTS mal_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        domain TEXT,
        region TEXT,
        category TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    # Matched and scored accounts (final output)
    c.execute('''CREATE TABLE IF NOT EXISTS matched_accounts_scored (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent_id INTEGER,
        ce_id INTEGER,
        mal_id INTEGER,
        company_name TEXT NOT NULL,
        domain TEXT,
        region TEXT,
        intent_tier INTEGER,
        intent_score REAL,
        intent_keywords TEXT,
        ce_status TEXT,
        mal_category TEXT,
        overlap_count INTEGER,
        overlap_sources TEXT,
        keyword_tier INTEGER,
        matched_keywords TEXT,
        final_score INTEGER DEFAULT 0,
        reasoning TEXT,
        last_matched DATETIME,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    # Keyword configuration (user customizable)
    c.execute('''CREATE TABLE IF NOT EXISTS scoring_keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tier INTEGER NOT NULL,
        keyword_list TEXT NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    # Manual overrides for region assignment
    c.execute('''CREATE TABLE IF NOT EXISTS regional_mapping (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT UNIQUE,
        assigned_region TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    # File upload tracking
    c.execute('''CREATE TABLE IF NOT EXISTS file_uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_type TEXT NOT NULL,  -- '6sense', 'ce', 'mal'
        filename TEXT,
        row_count INTEGER,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')

    conn.commit()


def clear_intent_data(conn: sqlite3.Connection):
    """Clear raw intent data (for re-uploads)"""
    c = conn.cursor()
    c.execute("DELETE FROM intent_data")
    conn.commit()


def clear_ce_accounts(conn: sqlite3.Connection):
    """Clear CE account data (for re-uploads)"""
    c = conn.cursor()
    c.execute("DELETE FROM ce_accounts")
    conn.commit()


def clear_mal_accounts(conn: sqlite3.Connection):
    """Clear MAL data (for re-uploads)"""
    c = conn.cursor()
    c.execute("DELETE FROM mal_accounts")
    conn.commit()


def get_upload_stats(conn: sqlite3.Connection) -> dict:
    """Get stats on uploaded data"""
    stats = {}

    try:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM intent_data")
        stats['intent_count'] = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM ce_accounts")
        stats['ce_count'] = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM mal_accounts")
        stats['mal_count'] = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM matched_accounts_scored")
        stats['matched_count'] = c.fetchone()[0]

        c.execute("SELECT MAX(upload_date) FROM file_uploads")
        result = c.fetchone()
        stats['last_upload'] = result[0] if result[0] else None
    except Exception as e:
        print(f"Error getting upload stats: {e}")

    return stats
