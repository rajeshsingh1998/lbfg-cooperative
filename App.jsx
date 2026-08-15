import React, { useEffect, useState } from "react";

const membersData = [
  {
    id: "LBFG-NP-000001",
    name: "Bikash Lamichhane",
    phone: "98XXXXXXXX",
    savings: 84500,
    loan: 120000,
    status: "Active",
  },
  {
    id: "LBFG-NP-000002",
    name: "Rajesh Lamichhane",
    phone: "97XXXXXXXX",
    savings: 62500,
    loan: 85000,
    status: "Active",
  },
  {
    id: "LBFG-NP-000003",
    name: "Sita Lamichhane",
    phone: "98XXXXXXXX",
    savings: 45000,
    loan: 0,
    status: "Active",
  },
];

function money(value) {
  return "रु. " + Number(value).toLocaleString("en-IN");
}

export default function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [apiStatus, setApiStatus] = useState("Checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(() => setApiStatus("Online"))
      .catch(() => setApiStatus("Offline"));
  }, []);

  const filteredMembers = membersData.filter(
    (member) =>
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.id.toLowerCase().includes(search.toLowerCase())
  );

  const totalSavings = membersData.reduce(
    (total, member) => total + member.savings,
    0
  );

  const totalLoans = membersData.reduce(
    (total, member) => total + member.loan,
    0
  );

  return (
    <div style={styles.app}>
      {/* SIDEBAR */}
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <div style={styles.logo}>LB</div>
          <div>
            <div style={styles.logoTitle}>LBFG</div>
            <div style={styles.logoSub}>Cooperative</div>
          </div>
        </div>

        <div style={styles.menuTitle}>MAIN MENU</div>

        {[
          "Dashboard",
          "Members",
          "Savings",
          "Loans",
          "Payments",
          "Reports",
        ].map((item) => (
          <button
            key={item}
            onClick={() => setActivePage(item)}
            style={{
              ...styles.menuButton,
              ...(activePage === item ? styles.menuActive : {}),
            }}
          >
            <span style={styles.menuIcon}>
              {item === "Dashboard" && "⌂"}
              {item === "Members" && "👥"}
              {item === "Savings" && "💰"}
              {item === "Loans" && "💳"}
              {item === "Payments" && "🧾"}
              {item === "Reports" && "📊"}
            </span>
            {item}
          </button>
        ))}

        <div style={styles.menuTitle}>SYSTEM</div>

        <button
          onClick={() => setActivePage("Settings")}
          style={{
            ...styles.menuButton,
            ...(activePage === "Settings" ? styles.menuActive : {}),
          }}
        >
          <span style={styles.menuIcon}>⚙️</span>
          Settings
        </button>

        <div style={styles.sidebarBottom}>
          <div style={styles.systemStatus}>
            <span style={styles.greenDot}></span>
            Server {apiStatus}
          </div>

          <div style={styles.version}>LBFG Online v1.0</div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={styles.main}>
        {/* TOP BAR */}
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>{activePage}</h1>
            <p style={styles.pageSub}>
              LBFG Cooperative Management System
            </p>
          </div>

          <div style={styles.headerRight}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member..."
              style={styles.search}
            />

            <button style={styles.notification}>🔔</button>

            <div style={styles.profile}>
              <div style={styles.profileAvatar}>R</div>
              <div>
                <strong>Administrator</strong>
                <small style={styles.profileSmall}>Admin</small>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <section style={styles.content}>
          {activePage === "Dashboard" && (
            <>
              <div style={styles.welcome}>
                <div>
                  <h2>Welcome to LBFG Cooperative 👋</h2>
                  <p>
                    Manage members, savings, loans, payments and reports from
                    one place.
                  </p>
                </div>

                <button style={styles.primaryButton}>+ Add Member</button>
              </div>

              {/* STAT CARDS */}
              <div style={styles.cards}>
                <StatCard
                  title="Total Members"
                  value="3"
                  icon="👥"
                  description="Registered members"
                />

                <StatCard
                  title="Total Savings"
                  value={money(totalSavings)}
                  icon="💰"
                  description="Member savings"
                />

                <StatCard
                  title="Outstanding Loans"
                  value={money(totalLoans)}
                  icon="💳"
                  description="Active loan balance"
                />

                <StatCard
                  title="Today's Collection"
                  value="रु. 12,500"
                  icon="📥"
                  description="Today's payment"
                />
              </div>

              {/* TWO COLUMNS */}
              <div style={styles.twoColumns}>
                <div style={styles.panel}>
                  <div style={styles.panelHeader}>
                    <div>
                      <h3>Recent Members</h3>
                      <p>Latest registered members</p>
                    </div>

                    <button
                      style={styles.linkButton}
                      onClick={() => setActivePage("Members")}
                    >
                      View All →
                    </button>
                  </div>

                  <MemberTable members={membersData.slice(0, 5)} />
                </div>

                <div style={styles.panel}>
                  <div style={styles.panelHeader}>
                    <div>
                      <h3>Quick Actions</h3>
                      <p>Common operations</p>
                    </div>
                  </div>

                  <div style={styles.quickGrid}>
                    <QuickAction
                      icon="👤"
                      title="Add Member"
                      onClick={() => setActivePage("Members")}
                    />

                    <QuickAction
                      icon="💰"
                      title="Add Savings"
                      onClick={() => setActivePage("Savings")}
                    />

                    <QuickAction
                      icon="💳"
                      title="New Loan"
                      onClick={() => setActivePage("Loans")}
                    />

                    <QuickAction
                      icon="🧾"
                      title="Payment"
                      onClick={() => setActivePage("Payments")}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activePage === "Members" && (
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2>Members Management</h2>
                  <p>Manage all cooperative members</p>
                </div>

                <button style={styles.primaryButton}>+ Add Member</button>
              </div>

              <MemberTable members={filteredMembers} />
            </div>
          )}

          {activePage === "Savings" && (
            <SimplePage
              title="Savings Management"
              description="Track monthly savings and member deposits."
              icon="💰"
              button="+ Add Savings"
            />
          )}

          {activePage === "Loans" && (
            <SimplePage
              title="Loan Management"
              description="Manage loans, installments and outstanding balances."
              icon="💳"
              button="+ New Loan"
            />
          )}

          {activePage === "Payments" && (
            <SimplePage
              title="Payment Management"
              description="Record and manage member payments."
              icon="🧾"
              button="+ Record Payment"
            />
          )}

          {activePage === "Reports" && (
            <SimplePage
              title="Reports"
              description="Generate monthly, yearly and financial reports."
              icon="📊"
              button="Generate Report"
            />
          )}

          {activePage === "Settings" && (
            <SimplePage
              title="System Settings"
              description="Configure your LBFG Cooperative system."
              icon="⚙️"
              button="Save Settings"
            />
          )}
        </section>

        <footer style={styles.footer}>
          <span>© 2026 LBFG Cooperative</span>
          <span>Secure Online Management System</span>
        </footer>
      </main>
    </div>
  );
}

/* STAT CARD */
function StatCard({ title, value, icon, description }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTop}>
        <div>
          <div style={styles.statTitle}>{title}</div>
          <div style={styles.statValue}>{value}</div>
        </div>

        <div style={styles.statIcon}>{icon}</div>
      </div>

      <div style={styles.statDescription}>{description}</div>
    </div>
  );
}

/* MEMBER TABLE */
function MemberTable({ members }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Member ID</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Savings</th>
            <th>Loan</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan="6" style={styles.noData}>
                No members found
              </td>
            </tr>
          ) : (
            members.map((member) => (
              <tr key={member.id}>
                <td>
                  <strong>{member.id}</strong>
                </td>
                <td>{member.name}</td>
                <td>{member.phone}</td>
                <td>{money(member.savings)}</td>
                <td>{money(member.loan)}</td>
                <td>
                  <span style={styles.status}>{member.status}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* QUICK ACTION */
function QuickAction({ icon, title, onClick }) {
  return (
    <button onClick={onClick} style={styles.quickAction}>
      <span style={styles.quickIcon}>{icon}</span>
      <span>{title}</span>
    </button>
  );
}

/* SIMPLE PAGE */
function SimplePage({ title, description, icon, button }) {
  return (
    <div style={styles.panel}>
      <div style={styles.emptyPage}>
        <div style={styles.bigIcon}>{icon}</div>

        <h2>{title}</h2>

        <p>{description}</p>

        <button style={styles.primaryButton}>{button}</button>
      </div>
    </div>
  );
}

/* STYLES */
const styles = {
  app: {
    minHeight: "100vh",
    display: "flex",
    background: "#f5f7fb",
    color: "#172033",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif",
  },

  sidebar: {
    width: "250px",
    background: "#111827",
    color: "#fff",
    minHeight: "100vh",
    padding: "24px 14px",
    boxSizing: "border-box",
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
  },

  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "4px 10px 28px",
  },

  logo: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "17px",
  },

  logoTitle: {
    fontSize: "19px",
    fontWeight: "800",
  },

  logoSub: {
    fontSize: "12px",
    color: "#9ca3af",
    marginTop: "2px",
  },

  menuTitle: {
    color: "#6b7280",
    fontSize: "10px",
    fontWeight: "700",
    padding: "15px 12px 8px",
    letterSpacing: "1px",
  },

  menuButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#cbd5e1",
    padding: "12px 13px",
    borderRadius: "9px",
    marginBottom: "4px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "11px",
  },

  menuActive: {
    background: "#2563eb",
    color: "#fff",
  },

  menuIcon: {
    width: "22px",
    textAlign: "center",
  },

  sidebarBottom: {
    position: "absolute",
    bottom: "25px",
    left: "25px",
    right: "25px",
  },

  systemStatus: {
    fontSize: "12px",
    color: "#cbd5e1",
    marginBottom: "10px",
  },

  greenDot: {
    display: "inline-block",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#22c55e",
    marginRight: "7px",
  },

  version: {
    fontSize: "11px",
    color: "#64748b",
  },

  main: {
    marginLeft: "250px",
    width: "calc(100% - 250px)",
    minHeight: "100vh",
  },

  header: {
    minHeight: "80px",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 30px",
    boxSizing: "border-box",
  },

  pageTitle: {
    margin: 0,
    fontSize: "23px",
    fontWeight: "750",
  },

  pageSub: {
    margin: "4px 0 0",
    fontSize: "12px",
    color: "#6b7280",
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  search: {
    width: "200px",
    padding: "10px 13px",
    border: "1px solid #dbe1ea",
    borderRadius: "8px",
    outline: "none",
    fontSize: "13px",
  },

  notification: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: "8px",
    padding: "9px 11px",
    cursor: "pointer",
  },

  profile: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
  },

  profileAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "#dbeafe",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
  },

  profileSmall: {
    display: "block",
    color: "#9ca3af",
    marginTop: "2px",
  },

  content: {
    padding: "28px",
    maxWidth: "1500px",
    margin: "0 auto",
    boxSizing: "border-box",
  },

  welcome: {
    background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
    color: "#fff",
    padding: "25px",
    borderRadius: "15px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "22px",
  },

  welcomeH2: {
    margin: 0,
  },

  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "11px 17px",
    borderRadius: "8px",
    fontWeight: "650",
    cursor: "pointer",
  },

  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "22px",
  },

  statCard: {
    background: "#fff",
    border: "1px solid #e8ecf2",
    borderRadius: "13px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(15,23,42,0.03)",
  },

  statTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  statTitle: {
    fontSize: "12px",
    color: "#64748b",
    marginBottom: "8px",
  },

  statValue: {
    fontSize: "21px",
    fontWeight: "800",
  },

  statIcon: {
    width: "40px",
    height: "40px",
    background: "#eff6ff",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "19px",
  },

  statDescription: {
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "14px",
  },

  twoColumns: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "20px",
  },

  panel: {
    background: "#fff",
    border: "1px solid #e8ecf2",
    borderRadius: "13px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(15,23,42,0.03)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  },

  panelHeaderH3: {
    margin: 0,
  },

  linkButton: {
    background: "transparent",
    border: "none",
    color: "#2563eb",
    cursor: "pointer",
    fontWeight: "600",
  },

  tableWrap: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },

  quickGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },

  quickAction: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "18px 10px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    fontWeight: "600",
  },

  quickIcon: {
    fontSize: "25px",
  },

  status: {
    background: "#dcfce7",
    color: "#15803d",
    padding: "4px 8px",
    borderRadius: "20px",
    fontSize: "10px",
    fontWeight: "700",
  },

  noData: {
    textAlign: "center",
    padding: "30px",
    color: "#94a3b8",
  },

  emptyPage: {
    minHeight: "400px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },

  bigIcon: {
    fontSize: "50px",
    marginBottom: "15px",
  },

  footer: {
    padding: "20px 30px",
    color: "#94a3b8",
    fontSize: "11px",
    display: "flex",
    justifyContent: "space-between",
  },
};
