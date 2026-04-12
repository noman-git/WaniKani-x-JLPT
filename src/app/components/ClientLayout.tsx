"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "./AuthProvider";

// Shared user menu dropdown (used by both desktop and mobile)
function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;

  // Generate avatar initials
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button onClick={() => setOpen(!open)} className="user-menu-trigger" title={user.username}>
        <span className="user-menu-avatar">{initials}</span>
      </button>
      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <span className="user-menu-avatar-lg">{initials}</span>
            <span className="user-menu-name">{user.username}</span>
          </div>
          <div className="user-menu-divider" />
          <button onClick={() => { setOpen(false); router.push('/settings'); }} className="user-menu-item">
            ⚙️ Settings
          </button>
          <button onClick={() => { setOpen(false); logout(); }} className="user-menu-item user-menu-item-danger">
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

function NavBar() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Don't show nav on login page
  if (pathname === "/login") return null;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* Desktop navbar — hidden on mobile via CSS */}
      <nav className="nav nav-desktop-only">
        <div className="nav-inner">
          <Link href="/" className="nav-brand">
            <span className="nav-brand-icon">⛩️</span>
            <span className="nav-brand-text">
              JLPT Tracker
              <span className="nav-brand-sub">N4 / N5</span>
            </span>
          </Link>
          <ul className="nav-links">
            <li><Link href="/radicals" className={`nav-link radical-nav ${isActive("/radicals") ? "active" : ""}`}>Radicals</Link></li>
            <li><Link href="/kanji" className={`nav-link kanji-nav ${isActive("/kanji") ? "active" : ""}`}>Kanji</Link></li>
            <li><Link href="/vocab" className={`nav-link vocab-nav ${isActive("/vocab") ? "active" : ""}`}>Vocab</Link></li>
            <li><Link href="/grammar" className={`nav-link grammar-nav ${isActive("/grammar") ? "active" : ""}`}>Grammar</Link></li>
            <li><UserMenu /></li>
          </ul>
        </div>
      </nav>

      {/* Mobile navbar — hidden on desktop via CSS */}
      <MobileNav />
    </>
  );
}

function MobileNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: "Radicals", href: "/radicals" },
    { label: "Kanji", href: "/kanji" },
    { label: "Vocab", href: "/vocab" },
    { label: "Grammar", href: "/grammar" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-bar">
        <button onClick={() => router.push('/')} className="mobile-nav-brand" title="Dashboard">
          ⛩️
        </button>
        <div className="mobile-nav-right">
          <UserMenu />
          <button 
            onClick={() => setMenuOpen(!menuOpen)} 
            className="mobile-nav-hamburger"
            aria-label="Menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-nav-dropdown">
          {navItems.map((item) => (
            <button 
              key={item.href}
              onClick={() => { setMenuOpen(false); router.push(item.href); }}
              className={`mobile-nav-item ${isActive(item.href) ? 'mobile-nav-item-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
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
