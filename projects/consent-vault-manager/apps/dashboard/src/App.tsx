import type { ReactNode } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import { RequireAuth } from "./auth/RequireAuth";
import { ComplianceView } from "./views/ComplianceView";
import { ConsentStatusView } from "./views/ConsentStatusView";
import { DSRQueueView } from "./views/DSRQueueView";

function Layout({ children }: { children: ReactNode }) {
  const { username, logout } = useAuth();
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
        </nav>
        <div style={{ fontSize: 14 }}>
          {username} — <button onClick={() => void logout()}>Sign out</button>
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
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default App;
