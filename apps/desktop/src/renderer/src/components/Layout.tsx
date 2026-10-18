import { TOOL_DEFINITIONS, type ToolId } from "@mdcz/shared/toolCatalog";
import { AppShell, type ShellLinkProps, SYSTEM_SHELL_NAV } from "@mdcz/views/shell";
import { ToolsRouteView } from "@mdcz/views/tools";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ipc } from "@/client/ipc";
import { AppTitleBar } from "@/components/AppTitleBar";
import { ToolDetail } from "@/components/tool/ToolDetail";
import { useCurrentConfig } from "@/hooks/configQueries";

interface LayoutProps {
  children: ReactNode;
}

const ShellLink = ({ to, onFocus, onMouseEnter, children }: ShellLinkProps) => (
  <Link to={to} preload="intent" onFocus={onFocus} onMouseEnter={onMouseEnter}>
    {children}
  </Link>
);

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [hasVisitedTools, setHasVisitedTools] = useState(location.pathname === "/tools");
  const isToolsRoute = location.pathname === "/tools";
  const configQ = useCurrentConfig();
  const pendingQ = useQuery({ queryKey: ["pending", "list"], queryFn: () => ipc.pending.list() });
  const useCustomTitleBar = configQ.data?.ui?.useCustomTitleBar ?? true;

  useEffect(() => {
    if (isToolsRoute) {
      setHasVisitedTools(true);
    }
  }, [isToolsRoute]);

  const systemNav = useMemo(() => {
    const showLogsPanel = configQ.data?.ui?.showLogsPanel ?? true;
    return showLogsPanel ? SYSTEM_SHELL_NAV : SYSTEM_SHELL_NAV.filter((item) => item.to !== "/logs");
  }, [configQ.data?.ui?.showLogsPanel]);

  return (
    <AppShell
      currentPath={location.pathname}
      linkComponent={ShellLink}
      navBadges={{ pending: pendingQ.data?.items.length }}
      systemNav={systemNav}
      titlebar={useCustomTitleBar ? <AppTitleBar /> : null}
    >
      {children}
      {hasVisitedTools || isToolsRoute ? (
        <div className="h-full w-full" style={{ display: isToolsRoute ? "block" : "none" }}>
          <ToolsRouteView tools={TOOL_DEFINITIONS} renderDetail={(toolId: ToolId) => <ToolDetail toolId={toolId} />} />
        </div>
      ) : null}
    </AppShell>
  );
}
