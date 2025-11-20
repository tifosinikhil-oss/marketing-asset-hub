import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime, timedelta
import io
import plotly.express as px

# --- CONFIGURATION ---
st.set_page_config(page_title="Content Command Center", layout="wide", page_icon="🚀")

# --- STYLING CSS ---
st.markdown("""
<style>
    .status-badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; color: white; }
    .status-Idea { background-color: #6c757d; }
    .status-Drafting { background-color: #007bff; }
    .status-Review { background-color: #ffc107; color: black !important; }
    .status-Published { background-color: #28a745; }
    .block-container { padding-top: 2rem; }
    .stButton>button { width: 100%; }
</style>
""", unsafe_allow_html=True)

# --- DATABASE ENGINE ---
class DB:
    def __init__(self, db_name='content_hub_v2.db'):
        self.conn = sqlite3.connect(db_name, check_same_thread=False)
        self.create_tables()

    def create_tables(self):
        c = self.conn.cursor()
        # Assets Table with rich metadata
        c.execute('''CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            owner TEXT,
            asset_type TEXT,
            industry TEXT,
            brief TEXT,
            status TEXT DEFAULT 'Idea',
            created_date DATE,
            published_date DATE,
            buying_stage TEXT
        )''')
        
        # Comments Table
        c.execute('''CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER,
            user TEXT,
            comment TEXT,
            timestamp DATETIME
        )''')
        
        # Attachments/Drafts Table (Storing files as BLOBs for portability)
        c.execute('''CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER,
            filename TEXT,
            file_data BLOB,
            uploaded_by TEXT,
            timestamp DATETIME
        )''')

        # Notifications Table
        c.execute('''CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT,
            is_read BOOLEAN DEFAULT 0,
            timestamp DATETIME
        )''')
        self.conn.commit()

    def query(self, query, params=()):
        return pd.read_sql_query(query, self.conn, params=params)

    def execute(self, query, params=()):
        c = self.conn.cursor()
        c.execute(query, params)
        self.conn.commit()
        return c.lastrowid

    def seed_data(self):
        if len(self.query("SELECT * FROM assets")) == 0:
            # Seeding a few initial items from your excel context
            seed_items = [
                ("AI unscripted with sa.global | Episode 3", "Revathy", "Podcast", "AE", "Discussing the four phases of AI journey.", "Published", "2025-09-26"),
                ("Why law firms are leaving Elite behind", "Vipin", "Video", "Legal", "Explainer video on legacy migration.", "Drafting", "2025-10-01"),
                ("Modern ERP for CFOs", "Akshata", "Whitepaper", "Finance", "Guide for modern CFOs on digital transformation.", "Review", "2025-10-05"),
                ("Q4 Social Media Kit", "Archana", "Social Media", "Across", "Linkedin posts for Q4 campaigns.", "Idea", "2025-10-10")
            ]
            for item in seed_items:
                self.execute(
                    "INSERT INTO assets (title, owner, asset_type, industry, brief, status, created_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    item
                )

# Initialize DB
db = DB()
db.seed_data()

# --- UTILS ---
def add_notification(msg):
    db.execute("INSERT INTO notifications (message, timestamp) VALUES (?, ?)", (msg, datetime.now()))

# --- VIEWS ---

def sidebar():
    st.sidebar.title("Content Hub")
    
    # User Profile
    with st.sidebar.expander("👤 User Profile", expanded=True):
        username = st.text_input("Your Name", value="MarketingUser")
        role = st.selectbox("Role", ["Content Creator", "Editor", "Head of Marketing"])
        st.session_state['user'] = username
        st.session_state['role'] = role

    # Notifications
    notifs = db.query("SELECT * FROM notifications ORDER BY id DESC LIMIT 5")
    if not notifs.empty:
        st.sidebar.subheader("🔔 Recent Activity")
        for _, row in notifs.iterrows():
            st.sidebar.caption(f"{row['timestamp'][:16]}")
            st.sidebar.info(row['message'])

    return st.sidebar.radio("Go to", ["Dashboard", "Kanban Board", "Create Content", "Workspace (Collab)", "Reports"])

def view_dashboard():
    st.title("📊 Executive Dashboard")
    
    df = db.query("SELECT * FROM assets")
    
    # Top Metrics
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Assets", len(df))
    c2.metric("In Progress", len(df[df['status'].isin(['Drafting', 'Review'])]))
    c3.metric("Published", len(df[df['status'] == 'Published']))
    c4.metric("Ideas", len(df[df['status'] == 'Idea']))

    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Assets by Status")
        status_counts = df['status'].value_counts().reset_index()
        status_counts.columns = ['Status', 'Count']
        fig = px.pie(status_counts, values='Count', names='Status', hole=0.4, color='Status',
                     color_discrete_map={'Idea':'#6c757d', 'Drafting':'#007bff', 'Review':'#ffc107', 'Published':'#28a745'})
        st.plotly_chart(fig, use_container_width=True)
        
    with col2:
        st.subheader("Assets by Type")
        type_counts = df['asset_type'].value_counts().reset_index()
        type_counts.columns = ['Type', 'Count']
        fig2 = px.bar(type_counts, x='Type', y='Count', color='Type')
        st.plotly_chart(fig2, use_container_width=True)

    st.subheader("Recent Assets")
    st.dataframe(df[['title', 'owner', 'status', 'asset_type', 'created_date']].sort_values('created_date', ascending=False).head(5), use_container_width=True)

def view_create():
    st.title("✨ Create New Content Asset")
    st.markdown("Start a new project here. Fill in the brief to kick off the workflow.")
    
    with st.form("create_asset_form"):
        c1, c2 = st.columns(2)
        title = c1.text_input("Project Title", placeholder="e.g., Q3 Market Trends Report")
        owner = c2.text_input("Asset Owner", value=st.session_state.get('user', ''))
        
        c3, c4, c5 = st.columns(3)
        a_type = c3.selectbox("Asset Type", ["Article", "Video", "Whitepaper", "Social Media", "Podcast", "Case Study"])
        industry = c4.selectbox("Industry/Vertical", ["Legal", "Finance", "AE", "Retail", "Cross-Industry"])
        stage = c5.selectbox("Buying Stage", ["TOFU (Awareness)", "MOFU (Consideration)", "BOFU (Decision)"])
        
        brief = st.text_area("Content Brief", placeholder="Describe the goal, target audience, and key takeaways...", height=150)
        
        submitted = st.form_submit_button("🚀 Launch Project")
        
        if submitted:
            if title and owner:
                db.execute(
                    "INSERT INTO assets (title, owner, asset_type, industry, brief, buying_stage, created_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Idea')",
                    (title, owner, a_type, industry, brief, stage, datetime.now().date())
                )
                add_notification(f"New project started: '{title}' by {owner}")
                st.success("Asset created successfully! Head to the Kanban board to track it.")
            else:
                st.error("Please enter a Title and Owner.")

def view_kanban():
    st.title("📋 Content Workflow Board")
    
    # Filters
    f1, f2 = st.columns(2)
    owner_filter = f1.multiselect("Filter by Owner", db.query("SELECT DISTINCT owner FROM assets")['owner'].tolist())
    
    query = "SELECT * FROM assets"
    if owner_filter:
        # Simple filter construction
        formatted_owners = "', '".join(owner_filter)
        query += f" WHERE owner IN ('{formatted_owners}')"
        
    df = db.query(query)
    
    cols = st.columns(4)
    stages = ["Idea", "Drafting", "Review", "Published"]
    colors = ["gray", "blue", "orange", "green"]
    
    for i, stage in enumerate(stages):
        with cols[i]:
            st.markdown(f"<h3 style='border-bottom: 3px solid {colors[i]}'>{stage}</h3>", unsafe_allow_html=True)
            stage_items = df[df['status'] == stage]
            
            for _, row in stage_items.iterrows():
                with st.expander(f"**{row['asset_type']}**: {row['title']}", expanded=True):
                    st.caption(f"👤 {row['owner']} | 📅 {row['created_date']}")
                    st.write(row['brief'][:60] + "...")
                    
                    # Move actions
                    c_move, c_open = st.columns([2, 1])
                    with c_move:
                        if stage != "Published":
                            next_stage = stages[i+1]
                            if st.button(f"→ {next_stage}", key=f"move_{row['id']}"):
                                db.execute("UPDATE assets SET status = ? WHERE id = ?", (next_stage, row['id']))
                                if next_stage == "Published":
                                    db.execute("UPDATE assets SET published_date = ? WHERE id = ?", (datetime.now().date(), row['id']))
                                    add_notification(f"🎉 Asset Published: {row['title']}")
                                else:
                                    add_notification(f"Asset '{row['title']}' moved to {next_stage}")
                                st.rerun()
                    with c_open:
                        st.button("Details", key=f"det_{row['id']}", help="Go to Workspace to edit")
                        # Note: In a real app, this would redirect. 
                        # Here we rely on the user going to Workspace tab to pick the specific ID.

def view_workspace():
    st.title("🛠️ Collaboration Workspace")
    
    # Asset Selector
    assets = db.query("SELECT id, title FROM assets ORDER BY id DESC")
    asset_map = {f"{row['id']}: {row['title']}": row['id'] for _, row in assets.iterrows()}
    
    selected_label = st.selectbox("Select Asset to Work On", options=list(asset_map.keys()))
    
    if selected_label:
        asset_id = asset_map[selected_label]
        asset = db.query("SELECT * FROM assets WHERE id = ?", (asset_id,)).iloc[0]
        
        st.divider()
        
        # --- HEADER ---
        c1, c2, c3 = st.columns([3, 1, 1])
        with c1:
            st.header(asset['title'])
            st.markdown(f"**Brief:** {asset['brief']}")
        with c2:
            st.info(f"Status: **{asset['status']}**")
        with c3:
            st.write(f"**Owner:** {asset['owner']}")
            st.write(f"**Type:** {asset['asset_type']}")

        # --- TABS ---
        tab_files, tab_comments, tab_settings = st.tabs(["📂 Files & Drafts", "💬 Review Comments", "⚙️ Settings"])
        
        # TAB 1: FILES
        with tab_files:
            st.subheader("Version Control")
            
            # Upload
            uploaded_file = st.file_uploader("Upload Draft / Asset File")
            if uploaded_file:
                if st.button("Save File"):
                    binary_data = uploaded_file.getvalue()
                    db.execute(
                        "INSERT INTO files (asset_id, filename, file_data, uploaded_by, timestamp) VALUES (?, ?, ?, ?, ?)",
                        (asset_id, uploaded_file.name, binary_data, st.session_state.get('user', 'User'), datetime.now())
                    )
                    st.success("File uploaded successfully!")
                    st.rerun()
            
            # List Files
            files = db.query("SELECT * FROM files WHERE asset_id = ? ORDER BY id DESC", (asset_id,))
            if not files.empty:
                for _, f in files.iterrows():
                    col_f1, col_f2 = st.columns([4, 1])
                    with col_f1:
                        st.write(f"📄 **{f['filename']}** (Uploaded by {f['uploaded_by']} on {f['timestamp'][:16]})")
                    with col_f2:
                        st.download_button("Download", f['file_data'], file_name=f['filename'], key=f"dl_{f['id']}")
            else:
                st.info("No drafts uploaded yet.")

        # TAB 2: COMMENTS
        with tab_comments:
            st.subheader("Team Discussion")
            
            # Input
            new_comment = st.text_input("Add a review comment")
            if st.button("Post Comment"):
                if new_comment:
                    db.execute("INSERT INTO comments (asset_id, user, comment, timestamp) VALUES (?, ?, ?, ?)",
                               (asset_id, st.session_state.get('user', 'User'), new_comment, datetime.now()))
                    st.rerun()
            
            # List
            comments = db.query("SELECT * FROM comments WHERE asset_id = ? ORDER BY id DESC", (asset_id,))
            for _, c in comments.iterrows():
                st.markdown(f"""
                <div style="background-color: #f0f2f6; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
                    <small><b>{c['user']}</b> - {c['timestamp'][:16]}</small><br>
                    {c['comment']}
                </div>
                """, unsafe_allow_html=True)

        # TAB 3: SETTINGS (Delete/Edit)
        with tab_settings:
            st.warning("Danger Zone")
            if st.button("Delete Project"):
                db.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
                db.execute("DELETE FROM comments WHERE asset_id = ?", (asset_id,))
                db.execute("DELETE FROM files WHERE asset_id = ?", (asset_id,))
                st.error("Project deleted.")
                st.rerun()

def view_reports():
    st.title("📈 Advanced Reporting")
    
    df = db.query("SELECT * FROM assets")
    df['created_date'] = pd.to_datetime(df['created_date'])
    df['Month'] = df['created_date'].dt.strftime('%Y-%m')
    
    # Report 1: Creation Velocity
    st.subheader("1. Monthly Asset Creation")
    monthly_counts = df.groupby('Month').size().reset_index(name='Count')
    fig1 = px.bar(monthly_counts, x='Month', y='Count', title="Assets Created per Month")
    st.plotly_chart(fig1, use_container_width=True)
    
    # Report 2: Type by Status
    st.subheader("2. Content Mix Analysis")
    fig2 = px.sunburst(df, path=['industry', 'asset_type'], title="Distribution by Industry & Type")
    st.plotly_chart(fig2, use_container_width=True)
    
    # Report 3: Raw Data Export
    st.subheader("3. Export Data")
    st.write("Download the full register for Excel analysis.")
    st.dataframe(df)
    st.download_button(
        "📥 Download CSV",
        df.to_csv(index=False).encode('utf-8'),
        "marketing_assets_report.csv",
        "text/csv"
    )

# --- MAIN ROUTER ---
if __name__ == "__main__":
    page = sidebar()
    
    if page == "Dashboard":
        view_dashboard()
    elif page == "Create Content":
        view_create()
    elif page == "Kanban Board":
        view_kanban()
    elif page == "Workspace (Collab)":
        view_workspace()
    elif page == "Reports":
        view_reports()
