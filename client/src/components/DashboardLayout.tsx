import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users, Clock, Receipt, FileText, Settings, Upload, Database, DollarSign, Calculator, Search, CircleHelp } from "lucide-react";
import NavigationButtons from "@/components/NavigationButtons";
import Omnibox from "@/components/Omnibox";
import { SearchBar } from "@/components/SearchBar";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { VersionFooter } from './VersionFooter';

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Kunden", path: "/customers" },
  { icon: Clock, label: "Zeiterfassung", path: "/time-tracking" },
  { icon: Receipt, label: "Reisekosten", path: "/expenses" },
  { icon: FileText, label: "Berichte", path: "/reports" },
  { icon: CircleHelp, label: "FAQ", path: "/faq" },
  { icon: Settings, label: "Einstellungen", path: "/settings" },
];
const BRAND_LOGO_PRIMARY_PATH = "/assets/doering-consulting-logo.png";
const BRAND_LOGO_FALLBACK_PATH = "/assets/doering-consulting-logo.svg";
const BRAND_ICON_PRIMARY_PATH = "/assets/doering-consulting-icon.png";
const BRAND_ICON_FALLBACK_PATH = "/assets/doering-consulting-icon.svg";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [location, setLocation] = useLocation();

  // Auth-Check beim Laden: /api/auth/me prüfen
  // Retry nach 800ms verhindert Login-Schleife durch Race Condition beim Cookie-Setzen
  useEffect(() => {
    const checkAuth = async (isRetry = false) => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.status === 401) {
          if (!isRetry) {
            // Einmal warten und nochmals versuchen bevor weitergeleitet wird
            setTimeout(() => checkAuth(true), 800);
          } else {
            // Zweiter Versuch ebenfalls 401 → wirklich nicht eingeloggt
            setLocation("/login");
          }
          return;
        }
        const data = await res.json();
        if (data?.user) {
          setUser({
            name: data.user.displayName ?? data.user.email,
            email: data.user.email,
          });
          setAuthChecked(true);
        }
      } catch {
        if (!isRetry) {
          setTimeout(() => checkAuth(true), 800);
        } else {
          setLocation("/login");
        }
      }
    };
    checkAuth();
  }, []);

  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [omniboxOpen, setOmniboxOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const [logoAvailable, setLogoAvailable] = useState(true);
  const [iconAvailable, setIconAvailable] = useState(true);
  const [logoSource, setLogoSource] = useState(BRAND_LOGO_PRIMARY_PATH);
  const [iconSource, setIconSource] = useState(BRAND_ICON_PRIMARY_PATH);

  useKeyboardShortcut({
    key: "k",
    ctrl: true,
    onKeyDown: () => setOmniboxOpen(true),
  });

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  // Hooks müssen in jeder Render-Phase in identischer Reihenfolge laufen.
  // Darum kommt der frühe Return erst NACH allen Hook-Aufrufen.
  if (!authChecked) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="justify-center px-2 py-3">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring shrink-0 text-white/80 hover:text-white"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center min-w-0">
                  {logoAvailable ? (
                    <img
                      src={logoSource}
                      alt="Döring Consulting"
                      className="h-11 w-auto object-contain"
                      onError={() => {
                        if (logoSource !== BRAND_LOGO_FALLBACK_PATH) {
                          setLogoSource(BRAND_LOGO_FALLBACK_PATH);
                          return;
                        }
                        setLogoAvailable(false);
                      }}
                    />
                  ) : (
                    <span className="font-semibold tracking-tight truncate text-white">
                      DÖRING Consulting
                    </span>
                  )}
                </div>
              ) : (
                iconAvailable && (
                  <img
                    src={iconSource}
                    alt="Döring Icon"
                    className="h-7 w-7 object-contain"
                    onError={() => {
                      if (iconSource !== BRAND_ICON_FALLBACK_PATH) {
                        setIconSource(BRAND_ICON_FALLBACK_PATH);
                        return;
                      }
                      setIconAvailable(false);
                    }}
                  />
                )
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal text-sidebar-foreground hover:text-sidebar-accent-foreground data-[active=true]:text-white"
                    >
                      <item.icon className="h-4 w-4" strokeWidth={isActive ? 2.2 : 1.8} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            <div className="mt-auto px-3 pb-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pb-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 group-data-[collapsible=icon]:p-2">
                {!isCollapsed ? (
                  logoAvailable ? (
                    <img
                      src={logoSource}
                      alt="Döring Consulting Logo"
                      className="w-full max-h-40 object-contain mx-auto"
                      onError={() => {
                        if (logoSource !== BRAND_LOGO_FALLBACK_PATH) {
                          setLogoSource(BRAND_LOGO_FALLBACK_PATH);
                          return;
                        }
                        setLogoAvailable(false);
                      }}
                    />
                  ) : (
                    <div className="text-center">
                      <div className="text-sm font-semibold text-white">DÖRING Consulting</div>
                      <div className="text-[10px] text-white/65 mt-1">CONSULTING · INTERIM · TRANSFORMATION</div>
                    </div>
                  )
                ) : (
                  iconAvailable && (
                    <img
                      src={iconSource}
                      alt="Döring Icon"
                      className="h-8 w-8 object-contain mx-auto"
                      onError={() => {
                        if (iconSource !== BRAND_ICON_FALLBACK_PATH) {
                          setIconSource(BRAND_ICON_FALLBACK_PATH);
                          return;
                        }
                        setIconAvailable(false);
                      }}
                    />
                  )
                )}
              </div>
            </div>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                  <Avatar className="h-9 w-9 border border-white/20 shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-white">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-white/55 truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={async () => {
                    await fetch("/api/auth/logout", {
                      method: "POST",
                      credentials: "include",
                    });
                    setLocation("/login");
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Abmelden</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!isCollapsed && (
              <p className="mt-2 text-[10px] text-white/40 leading-none px-1">
                DÖRING Consulting
              </p>
            )}
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Desktop Header with SearchBar */}
        {!isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <SearchBar />
          </div>
        )}
        
        {/* Mobile Header */}
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setOmniboxOpen(true)}
              title="Suchen (Strg+K)"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
        )}
        <main className="flex-1 p-4">
          <div className="mb-4">
            <NavigationButtons />
          </div>
          {children}
        </main>
      </SidebarInset>
      <Omnibox open={omniboxOpen} onOpenChange={setOmniboxOpen} />
      <VersionFooter />
    </>
  );
}
