"""
Account matching engine: Match accounts across 6sense intent, CE (CRM), and MAL (Marketing Account List)
"""

import pandas as pd
import sqlite3
from fuzzywuzzy import fuzz
from datetime import datetime, timedelta


class AccountMatcher:
    """Fuzzy match accounts across multiple data sources"""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.domain_match_threshold = 95
        self.company_name_threshold = 85

    def extract_domain(self, email_or_url: str) -> str:
        """Extract domain from email or URL"""
        if not email_or_url:
            return ""
        if "@" in str(email_or_url):
            return str(email_or_url).split("@")[-1].lower()
        if "http" in str(email_or_url):
            return str(email_or_url).replace("http://", "").replace("https://", "").split("/")[0].lower()
        return str(email_or_url).lower()

    def clean_company_name(self, name: str) -> str:
        """Normalize company name for matching"""
        if not name:
            return ""
        return name.lower().strip().replace(" ", "").replace(",", "").replace(".", "")

    def match_company_pair(self, name1: str, name2: str, domain1: str, domain2: str) -> int:
        """
        Score match between two company records.
        Returns 100 for exact domain match, fuzzy match score for names.
        """
        # Exact domain match (highest confidence)
        if domain1 and domain2:
            if domain1.lower() == domain2.lower():
                return 100
            # Partial domain match (e.g., subdomain)
            if domain1.lower() in domain2.lower() or domain2.lower() in domain1.lower():
                return 90

        # Fuzzy match on company name
        if name1 and name2:
            score = fuzz.token_sort_ratio(
                self.clean_company_name(name1),
                self.clean_company_name(name2)
            )
            return score

        return 0

    def match_accounts(self) -> pd.DataFrame:
        """
        Match accounts across intent_data, ce_accounts, and mal_accounts.
        Returns dataframe with matched accounts.
        """
        # Load data from all three sources
        intent_df = pd.read_sql_query("SELECT * FROM intent_data", self.conn)
        ce_df = pd.read_sql_query("SELECT * FROM ce_accounts", self.conn)
        mal_df = pd.read_sql_query("SELECT * FROM mal_accounts", self.conn)

        # Extract/normalize domains
        intent_df['domain_norm'] = intent_df['domain'].apply(self.extract_domain)
        ce_df['domain_norm'] = ce_df['domain'].apply(self.extract_domain)
        mal_df['domain_norm'] = mal_df['domain'].apply(self.extract_domain)

        # Start with intent data as base (most important signal)
        matched = []

        for _, intent_row in intent_df.iterrows():
            match_record = {
                'intent_id': intent_row['id'],
                'ce_id': None,
                'mal_id': None,
                'company_name': intent_row['company_name'],
                'domain': intent_row['domain_norm'],
                'intent_score': intent_row['intent_score'],
                'intent_tier': intent_row.get('intent_tier', None),
                'intent_keywords': intent_row.get('keywords', None),
                'ce_status': None,
                'mal_category': None,
                'region': None,
                'overlap_sources': ['intent'],
                'last_matched': datetime.now().isoformat()
            }

            # Try to match with CE account
            ce_match = None
            ce_match_score = 0
            for _, ce_row in ce_df.iterrows():
                score = self.match_company_pair(
                    intent_row['company_name'],
                    ce_row['account_name'],
                    intent_row['domain_norm'],
                    ce_row['domain_norm']
                )
                if score > ce_match_score and score >= self.company_name_threshold:
                    ce_match = ce_row
                    ce_match_score = score

            if ce_match is not None:
                match_record['ce_id'] = ce_match['id']
                match_record['ce_status'] = ce_match.get('customer_status', None)
                match_record['region'] = ce_match.get('region', None)
                match_record['overlap_sources'].append('ce')

            # Try to match with MAL
            mal_match = None
            mal_match_score = 0
            for _, mal_row in mal_df.iterrows():
                score = self.match_company_pair(
                    intent_row['company_name'],
                    mal_row['company_name'],
                    intent_row['domain_norm'],
                    mal_row['domain_norm']
                )
                if score > mal_match_score and score >= self.company_name_threshold:
                    mal_match = mal_row
                    mal_match_score = score

            if mal_match is not None:
                match_record['mal_id'] = mal_match['id']
                match_record['mal_category'] = mal_match.get('category', None)
                if not match_record['region']:
                    match_record['region'] = mal_match.get('region', None)
                match_record['overlap_sources'].append('mal')

            matched.append(match_record)

        return pd.DataFrame(matched)

    def save_matched_accounts(self, matched_df: pd.DataFrame):
        """Save matched accounts to matched_accounts_scored table"""
        c = self.conn.cursor()

        # Clear previous matches
        c.execute("DELETE FROM matched_accounts_scored")

        for _, row in matched_df.iterrows():
            overlap_count = len(row['overlap_sources'])

            c.execute("""
                INSERT INTO matched_accounts_scored
                (intent_id, ce_id, mal_id, company_name, domain, region,
                 intent_tier, intent_score, intent_keywords, ce_status, mal_category,
                 overlap_count, overlap_sources, last_matched)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row['intent_id'],
                row['ce_id'],
                row['mal_id'],
                row['company_name'],
                row['domain'],
                row['region'],
                row['intent_tier'],
                row['intent_score'],
                row['intent_keywords'],
                row['ce_status'],
                row['mal_category'],
                overlap_count,
                ','.join(row['overlap_sources']),
                row['last_matched']
            ))

        self.conn.commit()
