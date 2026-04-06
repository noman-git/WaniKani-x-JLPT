"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "./AuthProvider";

function NavBar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  // Don't show nav on login page
  if (pathname === "/login") return null;

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-brand">
          <span className="nav-brand-icon">⛩️</span>
          <span className="nav-brand-text">
            JLPT Tracker
            <span className="nav-brand-sub">N4 / N5</span>
          </span>
        </Link>
        <ul className="nav-links">
          <li><Link href="/" className="nav-link">Dashboard</Link></li>
          <li><Link href="/items" className="nav-link">Browse</Link></li>
          <li><Link href="/grammar" className="nav-link nav-link-grammar">Grammar</Link></li>
          <li><Link href="/settings" className="nav-link">Settings</Link></li>
          {!loading && user && (
            <li className="nav-user">
              <span className="nav-username">{user.username}</span>
              <button className="nav-logout" onClick={logout}>Logout</button>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Always allow login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <main className="container">
        <div className="loading-container">
          <div className="loading-spinner" />
          <span>Loading...</span>
        </div>
      </main>
    );
  }

  // Not authenticated — show login page content
  if (!user) {
    // Redirect to login via dynamic import
    return <LoginRedirect />;
  }

  return (
    <>
      <NavBar />
      <main className="container">{children}</main>
    </>
  );
}

function LoginRedirect() {
  const pathname = usePathname();
  // Use useEffect to avoid hydration issues
  if (typeof window !== "undefined" && pathname !== "/login") {
    window.location.href = "/login";
  }
  return (
    <main className="container">
      <div className="loading-container">
        <div className="loading-spinner" />
        <span>Redirecting to login...</span>
      </div>
    </main>
  );
}

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
