import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { TitleSlotProvider } from "@/components/layout/PageTitle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSession } from "@/features/auth/use-session";

export function AppShell() {
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        {/* Held to the window, so a screen scrolls under the top bar and a table can fill what is left. */}
        <SidebarInset className="h-svh min-w-0">
          <TopBar titleSlotRef={setTitleSlot} />
          <div data-slot="page-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <TitleSlotProvider value={titleSlot}>
              <Outlet />
            </TitleSlotProvider>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function AppSidebar() {
  const { user, can, signOut } = useSession();

  const destinations = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center justify-between">
        <Link
          to="/"
          className="flex min-h-8 items-center truncate px-2 font-semibold group-data-[collapsible=icon]:hidden"
        >
          wa-system
        </Link>
        <SidebarTrigger className="size-8" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {destinations.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  render={<NavLink to={item.to} />}
                  tooltip={item.label}
                  className={`aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground`}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <span className="truncate px-2 text-sm group-data-[collapsible=icon]:hidden">{user?.name}</span>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              tooltip="Sair"
              onClick={async () => {
                await signOut();
                toast.success("Sessão encerrada.");
              }}
            >
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * Stays pinned while the screen scrolls, so the operator never loses the title of
 * where they are. Screen-wide affordances, such as notifications, belong on its
 * right end.
 */
function TopBar({ titleSlotRef }: { titleSlotRef: (element: HTMLElement | null) => void }) {
  const { isMobile } = useSidebar();

  return (
    <header
      data-slot="top-bar"
      className="sticky top-0 z-10 flex min-h-14 items-center gap-2 border-b bg-background px-4"
    >
      {/*
        On a phone the menu lives off-canvas, so this is the only way to call it back.
        On wider screens the menu's own header carries the toggle.
      */}
      {isMobile ? <SidebarTrigger className="-ml-2 size-8" /> : null}
      <div ref={titleSlotRef} className="min-w-0 flex-1" />
    </header>
  );
}
