"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  ClipboardList,
  Home,
  Menu,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import styles from "./club-admin-shell.module.css";

type WorkspaceIcon =
  "home" | "structure" | "people" | "notifications" | "audit";
export type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: WorkspaceIcon;
};

const icons: Record<WorkspaceIcon, LucideIcon> = {
  home: Home,
  structure: Building2,
  people: UsersRound,
  notifications: Bell,
  audit: ClipboardList,
};

export function WorkspaceNavigation({
  items,
  workspaceName,
  accessory,
}: {
  items: readonly WorkspaceNavItem[];
  workspaceName: string;
  accessory?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstNavLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstNavLinkRef.current?.focus();
    const keepFocusInDrawer = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        document.querySelectorAll<HTMLElement>(
          'aside[data-open="true"] a[href], aside[data-open="true"] button:not(:disabled)',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInDrawer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", keepFocusInDrawer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        className={styles.mobileMenuToggle}
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="stable-primary-navigation"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      {open ? (
        <button
          className={styles.mobileScrim}
          type="button"
          aria-label="Close navigation"
          onClick={() => {
            setOpen(false);
            toggleRef.current?.focus();
          }}
        />
      ) : null}
      <aside
        className={styles.sidebar}
        data-open={open}
        aria-label={workspaceName}
      >
        <a href="/" className={styles.brand} aria-label="The Stable home">
          <span className={styles.brandMark} aria-hidden="true">
            S
          </span>
          <span className={styles.brandCopy}>
            <strong>The Stable</strong>
            <span>{workspaceName}</span>
          </span>
        </a>
        <nav id="stable-primary-navigation" aria-label="Primary navigation">
          <span className={styles.navLabel}>Workspace</span>
          <ul className={styles.navList}>
            {items.map(({ href, label, icon }, index) => {
              const Icon = icons[icon];
              const active =
                pathname === href ||
                (href !== "/" && pathname.startsWith(`${href}/`));
              return (
                <li key={href}>
                  <Link
                    ref={index === 0 ? firstNavLinkRef : undefined}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={styles.navLink}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={styles.sidebarFooter}>
          <span className={styles.footerRule} aria-hidden="true" />
          {accessory}
        </div>
      </aside>
    </>
  );
}
