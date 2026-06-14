"""
Account scoring: Score accounts based on overlap sources and keyword tiers
"""

import pandas as pd
import sqlite3


class AccountScorer:
    """Score accounts based on keyword tier and data source overlap"""

    # Scoring configuration
    KEYWORD_TIER_SCORES = {
        1: {'base': 55, 'ce_bonus': 10},      # Brand keywords
        2: {'base': 40, 'ce_bonus': 10},      # Competitor keywords
        3: {'base': 25, 'ce_bonus': 5},       # Generic keywords
        4: {'base': 10, 'ce_bonus': 0},       # Industry keywords
    }

    OVERLAP_SCORES = {
        3: 40,  # All 3 sources (intent + CE + MAL)
        2: 25,  # 2 sources
        1: 10,  # 1 source
    }

    # Default keyword lists (user configurable)
    KEYWORD_TIERS = {
        1: ['evergreen', 'nested lovable', 'number one', 'empower', 'say go'],
        2: ['deltek', 'elite', 'adorant', 'jd8', 'consolation'],
        3: ['project management', 'erp', 'crm', 'service centric', 'homebuilders'],
        4: ['software', 'solution', 'platform', 'tool'],
    }

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.load_keyword_config()

    def load_keyword_config(self):
        """Load keyword configuration from database if available"""
        try:
            df = pd.read_sql_query("SELECT * FROM scoring_keywords", self.conn)
            if not df.empty:
                for _, row in df.iterrows():
                    tier = row['tier']
                    keywords = row['keyword_list'].split(',')
                    self.KEYWORD_TIERS[tier] = [k.strip().lower() for k in keywords]
        except Exception as e:
            print(f"No custom keywords found, using defaults: {e}")

    def detect_keyword_tier(self, keywords_text: str) -> tuple:
        """
        Detect keyword tier from keywords_text.
        Returns (tier, matched_keywords)
        """
        if not keywords_text:
            return 4, []  # Default to tier 4 (industry)

        keywords_lower = str(keywords_text).lower()
        matched_keywords = []

        # Check tiers in order (1 = highest priority)
        for tier in [1, 2, 3, 4]:
            tier_keywords = self.KEYWORD_TIERS.get(tier, [])
            for keyword in tier_keywords:
                if keyword.lower() in keywords_lower:
                    matched_keywords.append(keyword)
            if matched_keywords:
                return tier, matched_keywords

        return 4, []  # Default to tier 4

    def score_account(self, row: pd.Series) -> dict:
        """
        Calculate final score for an account.
        Returns dict with score breakdown.
        """
        # Extract components
        overlap_count = row['overlap_count']
        ce_id = row['ce_id']
        intent_keywords = row['intent_keywords']

        # Detect keyword tier
        keyword_tier, matched_keywords = self.detect_keyword_tier(intent_keywords)

        # Calculate overlap score
        overlap_score = self.OVERLAP_SCORES.get(overlap_count, 0)

        # Calculate keyword score
        keyword_config = self.KEYWORD_TIER_SCORES.get(keyword_tier, {})
        keyword_score = keyword_config.get('base', 0)

        # CE bonus (account already in CRM)
        ce_bonus = keyword_config.get('ce_bonus', 0) if pd.notna(ce_id) else 0

        # Final score (capped at 100)
        final_score = min(100, overlap_score + keyword_score + ce_bonus)

        return {
            'keyword_tier': keyword_tier,
            'matched_keywords': ', '.join(matched_keywords) if matched_keywords else None,
            'overlap_score': overlap_score,
            'keyword_score': keyword_score,
            'ce_bonus': ce_bonus,
            'final_score': final_score,
            'reasoning': self._generate_reasoning(overlap_count, keyword_tier, matched_keywords, ce_id)
        }

    def _generate_reasoning(self, overlap_count: int, tier: int, keywords: list, has_ce: bool) -> str:
        """Generate human-readable reasoning for the score"""
        reasons = []

        # Overlap reason
        if overlap_count == 3:
            reasons.append("In all 3 sources (intent+CE+MAL)")
        elif overlap_count == 2:
            reasons.append("In 2 sources")
        elif overlap_count == 1:
            reasons.append("In intent data only")

        # Tier reason
        tier_names = {
            1: "Brand keywords detected",
            2: "Competitor keywords detected",
            3: "Generic solution keywords",
            4: "Industry keywords only"
        }
        reasons.append(tier_names.get(tier, "Unknown tier"))

        # CE reason
        if has_ce:
            reasons.append("Already in CRM")

        return " | ".join(reasons)

    def score_all_accounts(self) -> pd.DataFrame:
        """Score all matched accounts"""
        # Load matched accounts
        scored_df = pd.read_sql_query("SELECT * FROM matched_accounts_scored", self.conn)

        if scored_df.empty:
            return scored_df

        # Score each account
        scores = []
        for _, row in scored_df.iterrows():
            score_data = self.score_account(row)
            scores.append(score_data)

        scores_df = pd.DataFrame(scores)
        result_df = pd.concat([scored_df, scores_df], axis=1)

        return result_df

    def save_scores(self, scored_df: pd.DataFrame):
        """Save scores back to database"""
        c = self.conn.cursor()

        for _, row in scored_df.iterrows():
            c.execute("""
                UPDATE matched_accounts_scored
                SET keyword_tier = ?, matched_keywords = ?, final_score = ?, reasoning = ?
                WHERE intent_id = ?
            """, (
                row['keyword_tier'],
                row['matched_keywords'],
                row['final_score'],
                row['reasoning'],
                row['intent_id']
            ))

        self.conn.commit()
