import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AuthScreen } from "./screens/AuthScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { FriendsScreen } from "./screens/FriendsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import Logo from "./components/Logo";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Logo size="sm" />
      </header>
      <main className="app-main">{children}</main>
      <nav className="tab-nav">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/friends">Friends</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.loading) return <div className="center-card">Loading...</div>;
  if (!auth.userId) return <Navigate to="/auth" replace />;
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  const auth = useAuth();

  return (
    <Routes>
      <Route
        path="/auth"
        element={auth.userId ? <Navigate to={auth.needsOnboarding ? "/onboarding" : "/"} replace /> : <AuthScreen />}
      />
      <Route
        path="/onboarding"
        element={auth.userId ? <OnboardingScreen /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomeScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/friends"
        element={
          <ProtectedRoute>
            <FriendsScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/friends/:friendId"
        element={
          <ProtectedRoute>
            <FriendsScreen />
          </ProtectedRoute>
        }
      />
      <Route path="/messages" element={<Navigate to="/friends" replace />} />
      <Route
        path="/messages/:friendId"
        element={
          <ProtectedRoute>
            <FriendsScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsScreen />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={auth.userId ? "/" : "/auth"} replace />} />
    </Routes>
  );
}
