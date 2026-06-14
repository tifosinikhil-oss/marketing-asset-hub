"""
Hot Accounts Intelligence Dashboard
MVP for account prioritization based on intent + CRM + marketing data
"""

import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime, timedelta
import io
from orchestration.db_utils import init_account_intelligence_tables, get_upload_stats
from orchestration.account_matching import AccountMatcher
from orchestration.account_scoring import AccountScorer

# Initialize session state
if 'db_path' not in st.session_state:
    st.session_state.db_path = 'content_hub_v2.db'

if 'matched_refresh' not in st.session_state:
    st.session_state.matched_refresh = False

if 'hot_accounts_page' not in st.session_state:
    st.session_state.hot_accounts_page = 'dashboard'


def get_conn():
    """Get database connection"""
    conn = sqlite3.connect(st.session_state.db_path, check_same_thread=False)
    init_account_intelligence_tables(conn)
    return conn


def parse_6sense_upload(uploaded_file) -> pd.DataFrame:
    """Parse 6sense Excel export"""
    try:
        df = pd.read_excel(uploaded_file)

        # Expected columns: company_name, domain, intent_score, keywords, search_date
        required_cols = ['company_name', 'domain']
        missing = [col for col in required_cols if col not in df.columns]

        if missing:
            st.error(f"Missing columns in 6sense file: {missing}")
            st.info(f"Expected columns: company_name, domain, intent_score, keywords, search_date")
            return None

        # Filter for last 90 days
        if 'search_date' in df.columns:
            df['search_date'] = pd.to_datetime(df['search_date'], errors='coerce')
            cutoff_date = datetime.now() - timedelta(days=90)
            df = df[df['search_date'] >= cutoff_date]

        # Clean and validate
        df = df[df['company_name'].notna()].drop_duplicates(subset=['domain'])

        return df
    except Exception as e:
        st.error(f"Error parsing 6sense file: {e}")
        return None


def parse_ce_upload(uploaded_file) -> pd.DataFrame:
    """Parse CE (CRM) account export"""
    try:
        df = pd.read_excel(uploaded_file)

        # Expected columns: account_name, domain, region, industry, opportunity_count, customer_status
        required_cols = ['account_name']
        missing = [col for col in required_cols if col not in df.columns]

        if missing:
            st.error(f"Missing columns in CE file: {missing}")
            return None

        df = df[df['account_name'].notna()].drop_duplicates(subset=['account_name'])
        return df
    except Exception as e:
        st.error(f"Error parsing CE file: {e}")
        return None


def parse_mal_upload(uploaded_file) -> pd.DataFrame:
    """Parse MAL (Marketing Account List) export"""
    try:
        df = pd.read_excel(uploaded_file)

        # Expected columns: company_name, domain, region, category
        required_cols = ['company_name']
        missing = [col for col in required_cols if col not in df.columns]

        if missing:
            st.error(f"Missing columns in MAL file: {missing}")
            return None

        df = df[df['company_name'].notna()].drop_duplicates(subset=['company_name'])
        return df
    except Exception as e:
        st.error(f"Error parsing MAL file: {e}")
        return None


def save_6sense_data(conn: sqlite3.Connection, df: pd.DataFrame, uploaded_filename: str):
    """Save 6sense data to database"""
    try:
        # Clear previous data
        c = conn.cursor()
        c.execute("DELETE FROM intent_data")

        # Insert new data
        for _, row in df.iterrows():
            c.execute("""
                INSERT INTO intent_data (company_name, domain, intent_score, keywords, search_date)
                VALUES (?, ?, ?, ?, ?)
            """, (
                row['company_name'],
                row.get('domain', ''),
                row.get('intent_score', None),
                row.get('keywords', ''),
                row.get('search_date', None)
            ))

        # Log upload
        c.execute("""
            INSERT INTO file_uploads (file_type, filename, row_count)
            VALUES (?, ?, ?)
        """, ('6sense', uploaded_filename, len(df)))

        conn.commit()
        return True
    except Exception as e:
        st.error(f"Error saving 6sense data: {e}")
        return False


def save_ce_data(conn: sqlite3.Connection, df: pd.DataFrame, uploaded_filename: str):
    """Save CE account data to database"""
    try:
        c = conn.cursor()
        c.execute("DELETE FROM ce_accounts")

        for _, row in df.iterrows():
            c.execute("""
                INSERT INTO ce_accounts (account_name, domain, region, industry, opportunity_count, customer_status)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                row['account_name'],
                row.get('domain', ''),
                row.get('region', ''),
                row.get('industry', ''),
                row.get('opportunity_count', None),
                row.get('customer_status', '')
            ))

        c.execute("""
            INSERT INTO file_uploads (file_type, filename, row_count)
            VALUES (?, ?, ?)
        """, ('ce', uploaded_filename, len(df)))

        conn.commit()
        return True
    except Exception as e:
        st.error(f"Error saving CE data: {e}")
        return False


def save_mal_data(conn: sqlite3.Connection, df: pd.DataFrame, uploaded_filename: str):
    """Save MAL data to database"""
    try:
        c = conn.cursor()
        c.execute("DELETE FROM mal_accounts")

        for _, row in df.iterrows():
            c.execute("""
                INSERT INTO mal_accounts (company_name, domain, region, category)
                VALUES (?, ?, ?, ?)
            """, (
                row['company_name'],
                row.get('domain', ''),
                row.get('region', ''),
                row.get('category', '')
            ))

        c.execute("""
            INSERT INTO file_uploads (file_type, filename, row_count)
            VALUES (?, ?, ?)
        """, ('mal', uploaded_filename, len(df)))

        conn.commit()
        return True
    except Exception as e:
        st.error(f"Error saving MAL data: {e}")
        return False


def page_upload():
    """Upload & Sync page"""
    st.subheader("Upload Excel Data")
    st.markdown("Upload Excel files for 6sense intent data, CE accounts, and MAL. Data is stored locally.")

    conn = get_conn()
    stats = get_upload_stats(conn)

    # Show current data stats
    st.subheader("📊 Current Data Status")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("6sense Accounts", stats.get('intent_count', 0))
    col2.metric("CE Accounts", stats.get('ce_count', 0))
    col3.metric("MAL Accounts", stats.get('mal_count', 0))
    col4.metric("Matched Accounts", stats.get('matched_count', 0))

    if stats.get('last_upload'):
        st.caption(f"Last upload: {stats['last_upload']}")

    st.divider()

    # Upload sections
    col1, col2, col3 = st.columns(3)

    with col1:
        st.subheader("6sense Intent")
        uploaded_6sense = st.file_uploader("Upload 6sense export", type=['xlsx', 'xls'], key='6sense_uploader')
        if uploaded_6sense:
            df = parse_6sense_upload(uploaded_6sense)
            if df is not None:
                st.write(f"✅ Parsed {len(df)} accounts (filtered for 90 days)")
                st.dataframe(df.head(5), use_container_width=True)
                if st.button("💾 Save 6sense Data", key='save_6sense'):
                    if save_6sense_data(conn, df, uploaded_6sense.name):
                        st.success("✅ 6sense data saved!")
                        st.session_state.matched_refresh = True
                        st.rerun()

    with col2:
        st.subheader("CE Accounts (CRM)")
        uploaded_ce = st.file_uploader("Upload CE accounts export", type=['xlsx', 'xls'], key='ce_uploader')
        if uploaded_ce:
            df = parse_ce_upload(uploaded_ce)
            if df is not None:
                st.write(f"✅ Parsed {len(df)} accounts")
                st.dataframe(df.head(5), use_container_width=True)
                if st.button("💾 Save CE Data", key='save_ce'):
                    if save_ce_data(conn, df, uploaded_ce.name):
                        st.success("✅ CE data saved!")
                        st.session_state.matched_refresh = True
                        st.rerun()

    with col3:
        st.subheader("MAL (Marketing List)")
        uploaded_mal = st.file_uploader("Upload MAL export", type=['xlsx', 'xls'], key='mal_uploader')
        if uploaded_mal:
            df = parse_mal_upload(uploaded_mal)
            if df is not None:
                st.write(f"✅ Parsed {len(df)} accounts")
                st.dataframe(df.head(5), use_container_width=True)
                if st.button("💾 Save MAL Data", key='save_mal'):
                    if save_mal_data(conn, df, uploaded_mal.name):
                        st.success("✅ MAL data saved!")
                        st.session_state.matched_refresh = True
                        st.rerun()

    st.divider()

    # Match button
    if stats.get('intent_count', 0) > 0:
        if st.button("🔗 Match & Score Accounts", key='match_button', use_container_width=True):
            with st.spinner("Matching accounts..."):
                matcher = AccountMatcher(conn)
                matched_df = matcher.match_accounts()
                matcher.save_matched_accounts(matched_df)

                with st.spinner("Scoring accounts..."):
                    scorer = AccountScorer(conn)
                    scored_df = scorer.score_all_accounts()
                    scorer.save_scores(scored_df)

                st.success(f"✅ Matched and scored {len(scored_df)} accounts!")
                st.session_state.matched_refresh = True
                st.rerun()
    else:
        st.info("📌 Upload 6sense data first to match accounts")


def page_dashboard():
    """Hot Accounts Dashboard page"""
    st.subheader("Account Priority Rankings")
    st.markdown("View and filter high-priority accounts by region and intent.")

    conn = get_conn()

    # Load scored accounts
    try:
        scored_df = pd.read_sql_query("SELECT * FROM matched_accounts_scored ORDER BY final_score DESC", conn)
    except Exception as e:
        st.error(f"Error loading accounts: {e}")
        return

    if scored_df.empty:
        st.info("📌 No matched accounts yet. Go to Upload & Sync to load data.")
        return

    # Filters
    st.subheader("🔍 Filters")
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        selected_region = st.multiselect(
            "Region",
            options=[''] + sorted(scored_df[scored_df['region'].notna()]['region'].unique().tolist()),
            default=[]
        )

    with col2:
        selected_tier = st.multiselect(
            "Keyword Tier",
            options=[1, 2, 3, 4],
            default=[1, 2],
            format_func=lambda x: f"Tier {x} {'(Brand)' if x==1 else '(Competitor)' if x==2 else '(Generic)' if x==3 else '(Industry)'}"
        )

    with col3:
        min_score, max_score = st.slider(
            "Score Range",
            min_value=0,
            max_value=100,
            value=(60, 100)
        )

    with col4:
        overlap_filter = st.multiselect(
            "Data Sources",
            options=[1, 2, 3],
            default=[1, 2, 3],
            format_func=lambda x: f"{x} source{'s' if x > 1 else ''}"
        )

    # Apply filters
    filtered_df = scored_df.copy()

    if selected_region:
        filtered_df = filtered_df[filtered_df['region'].isin(selected_region)]

    if selected_tier:
        filtered_df = filtered_df[filtered_df['keyword_tier'].isin(selected_tier)]

    filtered_df = filtered_df[(filtered_df['final_score'] >= min_score) & (filtered_df['final_score'] <= max_score)]

    if overlap_filter:
        filtered_df = filtered_df[filtered_df['overlap_count'].isin(overlap_filter)]

    # Display results
    st.subheader(f"📋 Results ({len(filtered_df)} accounts)")

    if filtered_df.empty:
        st.warning("No accounts match the selected filters.")
    else:
        # Color mapping
        def tier_color(tier):
            if tier == 1:
                return '🔴'
            elif tier == 2:
                return '🟠'
            elif tier == 3:
                return '🟡'
            else:
                return '⚪'

        # Display table
        display_df = filtered_df[[
            'company_name', 'domain', 'region', 'keyword_tier',
            'matched_keywords', 'overlap_count', 'final_score', 'ce_status'
        ]].copy()

        display_df['Tier'] = display_df['keyword_tier'].apply(tier_color)
        display_df = display_df.drop('keyword_tier', axis=1)
        display_df = display_df.rename(columns={
            'company_name': 'Company',
            'domain': 'Domain',
            'region': 'Region',
            'matched_keywords': 'Keywords',
            'overlap_count': 'Sources',
            'final_score': 'Score',
            'ce_status': 'CRM Status'
        })

        st.dataframe(display_df, use_container_width=True, hide_index=True)

        # Export button
        export_csv = display_df.to_csv(index=False)
        st.download_button(
            label="📥 Export as CSV",
            data=export_csv,
            file_name=f"hot_accounts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )


def main():
    """Main entry point for hot accounts dashboard"""
    st.title("🔥 Hot Accounts Intelligence")
    st.markdown("Account prioritization based on intent signals, CRM data, and marketing lists")

    # Tabs for navigation
    tab_dashboard, tab_upload = st.tabs(["📊 Dashboard", "📤 Upload Data"])

    with tab_dashboard:
        page_dashboard()

    with tab_upload:
        page_upload()


if __name__ == "__main__":
    main()
