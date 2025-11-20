import streamlit as st
import pandas as pd
import sqlite3
import hashlib
from datetime import datetime
import io

# --- CONFIGURATION ---
st.set_page_config(page_title="Central Asset Marketing Hub", layout="wide", page_icon="📊")

# --- DATABASE MANAGEMENT ---
def init_db():
    conn = sqlite3.connect('marketing_assets.db')
    c = conn.cursor()
    
    # Assets Table
    c.execute('''CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serial_no TEXT,
        owner TEXT,
        topic TEXT,
        link TEXT,
        summary TEXT,
        pain_points TEXT,
        teams_links TEXT,
        asset_type TEXT,
        create_date TEXT,
        last_updated TEXT,
        publisher TEXT,
        function TEXT,
        industry TEXT,
        buying_stage TEXT,
        service_area TEXT,
        language TEXT,
        gated_status TEXT,
        status TEXT DEFAULT 'Published',
        project_phase TEXT DEFAULT 'Completed'
    )''')

    # Audit Log Table
    c.execute('''CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER,
        user TEXT,
        action TEXT,
        timestamp TEXT
    )''')

    # Comments/Tasks Table
    c.execute('''CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER,
        user TEXT,
        comment TEXT,
        status TEXT,
        timestamp TEXT
    )''')
    
    conn.commit()
    return conn

def run_query(query, params=(), fetch=False):
    conn = sqlite3.connect('marketing_assets.db')
    c = conn.cursor()
    c.execute(query, params)
    if fetch:
        data = c.fetchall()
        cols = [description[0] for description in c.description]
        conn.close()
        return pd.DataFrame(data, columns=cols)
    conn.commit()
    conn.close()

# --- SEED DATA (FROM YOUR CSV) ---
# I have cleaned and structured the raw CSV data provided in your prompt.
def seed_database_if_empty():
    df_check = run_query("SELECT count(*) as cnt FROM assets", fetch=True)
    if df_check['cnt'][0] == 0:
        # This is a subset of your data for demonstration. 
        # In a real scenario, we would parse the full CSV file provided.
        seed_data = [
            ("Revathy", "Episode 3 – Navigating the four phases of the AI journey", "https://www.saglobal.com/int/resources/podcasts/ai-journey-in-ae-inspections.html", "Podcast", "AE", "TOFU", "English", "Ungated"),
            ("Revathy", "Episode 2: From data to decisions", "https://www.saglobal.com/int/resources/podcasts/ai-approach-for-service-centric-organizations.html", "Podcast", "Service-centric", "TOFU", "English", "Ungated"),
            ("Vipin", "The real reason law firms are leaving Elite behind", "https://www.youtube.com/watch?v=zTN5mDIBVfs", "Video", "Legal", "MOFU", "English", "Ungated"),
            ("Akshata", "Pourquoi l’intégration de votre ERP", "https://www.saglobal.com/fr-fr/insights/pourquoi-lintegration-de-votre-erp-a-votre-crm-ameliore-la-productivite.html", "Article", "IT Operations", "MOFU", "French", "Ungated"),
            ("Akshata", "How to choose a global ERP partner", "https://www.saglobal.com/en-in/insights/how-to-choose-a-global-erp-partner-for-microsoft-dynamics.html", "Article", "Across", "MOFU", "English", "Ungated"),
            ("Revathy", "Tackling project delays with clear goal setting", "https://www.saglobal.com/int/insights/tackling-project-delays-with-clear-goal-setting.html", "Blog", "Service Delivery", "MOFU", "English", "Ungated"),
            ("Appu", "Olthof Homes' digital transformation", "https://www.youtube.com/watch?v=y00A2FT_JoE", "Video", "Homebuilders", "MOFU", "English", "Ungated"),
            ("Archana", "Mastering intercompany transactions", "https://www.saglobal.com/int/insights/mastering-intercompany-transactions-with-automation-and-ai.html", "Article", "Finance", "TOFU", "English", "Ungated"),
             ("Revathy", "Why your invoices aren’t getting paid", "https://www.saglobal.com/int/insights/why-your-invoices-arent-getting-paid-an-inside-look-at-payment-delays-in-law-firms.html", "Article", "Legal", "TOFU", "English", "Ungated"),
            ("Revathy", "The Analytics Maturity Model", "https://www.saglobal.com/resources/all-downloads/infographics/five-stages-of-data-analysis-the-analytics-maturity-model.pdf", "Infographic", "Across", "TOFU", "English", "Ungated")
        ]
        
        for item in seed_data:
            run_query('''INSERT INTO assets (owner, topic, link, asset_type, industry, buying_stage, language, gated_status, create_date)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', 
                         (*item, datetime.now().strftime("%Y-%m-%d")))

# --- AUTHENTICATION (SIMPLE) ---
def check_password():
    """Returns `True` if the user had a correct password."""
    def password_entered():
        if st.session_state["username"] in ["admin", "editor", "viewer"]:
            st.session_state["password_correct"] = True
            st.session_state["role"] = "Admin" if st.session_state["username"] == "admin" else "Editor"
        else:
            st.session_state["password_correct"] = False

    if "password_correct" not in st.session_state:
        st.text_input("Username (Try: admin, editor)", key="username")
        st.text_input("Password (Any password works for demo)", type="password", on_change=password_entered)
        return False
    elif not st.session_state["password_correct"]:
        st.text_input("Username", key="username")
        st.text_input("Password", type="password", on_change=password_entered)
        st.error("😕 User not known")
        return False
    else:
        return True

# --- UI MODULES ---

def sidebar_filters():
    st.sidebar.header("🔍 Filter Assets")
    df = run_query("SELECT * FROM assets", fetch=True)
    
    owners = st.sidebar.multiselect("Asset Owner", df['owner'].unique())
    types = st.sidebar.multiselect("Asset Type", df['asset_type'].unique())
    industry = st.sidebar.multiselect("Industry", df['industry'].unique())
    stage = st.sidebar.multiselect("Buying Stage", df['buying_stage'].unique())
    
    return owners, types, industry, stage

def dashboard_view(owners, types, industry, stage):
    st.title("Central Asset Register Dashboard")
    
    # Metrics
    df = run_query("SELECT * FROM assets", fetch=True)
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Assets", len(df))
    col2.metric("Published", len(df[df['status']=='Published']))
    col3.metric("In Draft/Design", len(df[df['status']!='Published']))
    col4.metric("Gated Assets", len(df[df['gated_status']=='Gated']))
    
    # Filtering Logic
    if owners: df = df[df['owner'].isin(owners)]
    if types: df = df[df['asset_type'].isin(types)]
    if industry: df = df[df['industry'].isin(industry)]
    if stage: df = df[df['buying_stage'].isin(stage)]
    
    st.dataframe(df, use_container_width=True)
    
    # Download Button
    csv = df.to_csv(index=False).encode('utf-8')
    st.download_button("📥 Export Filtered Data to CSV", data=csv, file_name="asset_register.csv", mime="text/csv")

def add_edit_asset():
    st.title("📝 Content Planner & Editor")
    
    with st.expander("Create New Asset Project"):
        with st.form("new_asset_form"):
            col1, col2 = st.columns(2)
            owner = col1.text_input("Asset Owner", value=st.session_state.username)
            topic = col2.text_input("Topic / Title")
            
            col3, col4, col5 = st.columns(3)
            asset_type = col3.selectbox("Type", ["Article", "Video", "Podcast", "Whitepaper", "Infographic", "Event"])
            industry = col4.selectbox("Industry", ["Legal", "Finance", "AE", "Homebuilders", "Service-centric", "Across"])
            stage = col5.selectbox("Stage", ["TOFU", "MOFU", "BOFU"])
            
            summary = st.text_area("Blog Summary / Pain Points")
            
            submitted = st.form_submit_button("Create Project")
            if submitted:
                run_query('''INSERT INTO assets (owner, topic, asset_type, industry, buying_stage, summary, create_date, status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft')''', 
                             (owner, topic, asset_type, industry, stage, summary, datetime.now().strftime("%Y-%m-%d")))
                
                # Log Audit
                run_query("INSERT INTO audit_log (user, action, timestamp) VALUES (?, ?, ?)", 
                          (st.session_state.username, f"Created asset: {topic}", datetime.now().strftime("%Y-%m-%d %H:%M")))
                st.success("Project started successfully!")

def kanban_board():
    st.title("📋 Content Kanban Board")
    df = run_query("SELECT * FROM assets", fetch=True)
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.subheader("Drafting")
        drafts = df[df['status'] == 'Draft']
        for _, row in drafts.iterrows():
            st.info(f"**{row['topic']}**\n\nOwner: {row['owner']}")
            
    with col2:
        st.subheader("In Design")
        design = df[df['status'] == 'Design']
        for _, row in design.iterrows():
            st.warning(f"**{row['topic']}**\n\nType: {row['asset_type']}")

    with col3:
        st.subheader("Review")
        review = df[df['status'] == 'Review']
        for _, row in review.iterrows():
            st.error(f"**{row['topic']}**\n\nIndustry: {row['industry']}")
            
    with col4:
        st.subheader("Published")
        pub = df[df['status'] == 'Published']
        # Limit showing all published to avoid scroll fatigue
        for _, row in pub.head(5).iterrows():
            st.success(f"**{row['topic']}**\n\n[Link]({row['link']})")

def audit_trail():
    st.title("🕵️ Audit Trail & Version History")
    df = run_query("SELECT * FROM audit_log ORDER BY id DESC", fetch=True)
    st.dataframe(df, use_container_width=True)

# --- MAIN APP LOGIC ---
if __name__ == "__main__":
    init_db()
    seed_database_if_empty()
    
    if check_password():
        st.sidebar.title(f"👤 {st.session_state.username}")
        st.sidebar.info(f"Role: {st.session_state.role}")
        
        menu = st.sidebar.radio("Navigation", ["Dashboard", "Plan Content", "Kanban Board", "Audit Trail"])
        
        owners_filter, types_filter, ind_filter, stage_filter = sidebar_filters()
        
        if menu == "Dashboard":
            dashboard_view(owners_filter, types_filter, ind_filter, stage_filter)
        elif menu == "Plan Content":
            add_edit_asset()
        elif menu == "Kanban Board":
            kanban_board()
        elif menu == "Audit Trail":
            audit_trail()
