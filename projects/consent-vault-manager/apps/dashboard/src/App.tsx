import type { ReactNode } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import { RequireAuth } from "./auth/RequireAuth";
import { ComplianceView } from "./views/ComplianceView";
import { ConsentStatusView } from "./views/ConsentStatusView";
import { DSRQueueView } from "./views/DSRQueueView";
import { UsersView } from "./views/UsersView";

function Layout({ children }: { children: ReactNode }) {
  const { username, role, fiduciaryName, logout } = useAuth();
  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    marginRight: 16,
    fontWeight: isActive ? ("bold" as const) : ("normal" as const),
  });

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <nav>
          <NavLink to="/consents" style={linkStyle}>
            Consent Status
          </NavLink>
          <NavLink to="/dsr" style={linkStyle}>
            DSR Queue
          </NavLink>
          <NavLink to="/compliance" style={linkStyle}>
            Compliance
          </NavLink>
          {/* Phase 8: only an admin can manage their fiduciary's team — a
              dpo/viewer would just get a 403 from every request on this
              page, so the link itself is hidden rather than leading
              somewhere useless. */}
          {role === "admin" && (
            <NavLink to="/users" style={linkStyle}>
              Team
            </NavLink>
          )}
        </nav>
        <div style={{ fontSize: 14, textAlign: "right" }}>
          <div>
            {username} <span style={{ color: "#888" }}>({role})</span> — <button onClick={() => void logout()}>Sign out</button>
          </div>
          <div style={{ color: "#888", fontSize: 12 }}>{fiduciaryName}</div>
        </div>
      </header>
      {children}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/consents" replace />} />
                <Route path="/consents" element={<ConsentStatusView />} />
                <Route path="/dsr" element={<DSRQueueView />} />
                <Route path="/compliance" element={<ComplianceView />} />
                <Route path="/users" element={<UsersView />} />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default App;
