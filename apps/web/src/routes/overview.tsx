import { toErrorMessage } from "@mdcz/shared/error";
import type { OverviewRecentAcquisitionDto } from "@mdcz/shared/serverDtos";
import { openNewWorkbenchTask } from "@mdcz/views/adapters/workbenchSession";
import { getT, useT } from "@mdcz/views/i18n";
import {
  ActivityTimelineCard,
  hasActiveActivity,
  OverviewHeroStartCard,
  OverviewMaintenanceCard,
  RecentAcquisitionRemoveDialog,
  RecentAcquisitionsGrid,
  SiteHealthCard,
} from "@mdcz/views/overview";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createWebMaintenanceActionPort } from "../adapters/ports";
import { api, getLibraryAssetSrc } from "../client";
import { queryKeys } from "../lib/queryKeys";
import { ErrorBanner } from "../routeCommon";
import { buildHref } from "../routeHelpers";

export const hasWorkbenchOutput = (input: {
  libraryCount: number;
  output?: { fileCount: number; totalBytes: number } | null;
  recentCount: number;
}): boolean =>
  input.libraryCount > 0 ||
  (input.output?.fileCount ?? 0) > 0 ||
  (input.output?.totalBytes ?? 0) > 0 ||
  input.recentCount > 0;

export function OverviewPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const maintenancePort = useMemo(() => createWebMaintenanceActionPort(), []);
  const [removeTarget, setRemoveTarget] = useState<OverviewRecentAcquisitionDto | null>(null);
  const librariesQ = useQuery({ queryKey: queryKeys.libraries.all, queryFn: () => api.libraries.list(), retry: false });
  const overviewQ = useQuery({
    queryKey: queryKeys.overview.summary,
    queryFn: () => api.overview.summary(),
    retry: false,
  });
  const sitesQ = useQuery({ queryKey: queryKeys.overview.sites, queryFn: () => api.crawler.listSites(), retry: false });
  const activityQ = useQuery({
    queryKey: queryKeys.activity.list,
    queryFn: () => api.activity.list({ limit: 12 }),
    refetchInterval: (query) => (hasActiveActivity(query.state.data?.entries ?? []) ? 3_000 : false),
    retry: false,
  });
  const openWorkbench = async (mode: "scrape" | "maintenance") => {
    try {
      await openNewWorkbenchTask(mode, () => maintenancePort.discardSession());
      await navigate(
        mode === "maintenance" ? { to: buildHref("/workbench", { intent: "maintenance" }) } : { to: "/workbench" },
      );
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };
  const output = overviewQ.data?.output;
  const recent = overviewQ.data?.recentAcquisitions ?? [];
  const configured = hasWorkbenchOutput({
    libraryCount: librariesQ.data?.libraries.length ?? 0,
    output,
    recentCount: recent.length,
  });

  return (
    <main className="h-full overflow-y-auto bg-surface-canvas text-foreground">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-12 gap-6 px-6 py-6 md:px-10 lg:px-12 lg:py-8">
        <section className="col-span-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <OverviewHeroStartCard
            className="lg:col-span-2"
            data={output}
            hasConfiguredOutput={configured}
            isError={overviewQ.isError}
            isLoading={librariesQ.isLoading || overviewQ.isLoading}
            labels={{ startAction: t.web.goToWorkbench, setupAction: t.libraries.createFirst }}
            onSetup={() => {
              void navigate({ to: "/libraries" });
            }}
            onStart={() => void openWorkbench("scrape")}
          />
          <OverviewMaintenanceCard onOpen={() => void openWorkbench("maintenance")} />
        </section>

        <SiteHealthCard
          sites={sitesQ.data?.sites ?? []}
          onOpenSettings={() => {
            void navigate({ to: buildHref("/settings", { section: "scrape" }) });
          }}
        />

        {overviewQ.error && <ErrorBanner>{toErrorMessage(overviewQ.error)}</ErrorBanner>}

        <section className="col-span-12">
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight">{t.web.recentAcquisitions}</h2>
          </div>
          <RecentAcquisitionsGrid
            getImageSrc={(path, item) =>
              getLibraryAssetSrc({ format: "webp", path, rootId: item.thumbnailRootId ?? item.rootId, width: 400 })
            }
            isError={overviewQ.isError}
            isLoading={overviewQ.isLoading}
            items={recent}
            onItemRemove={setRemoveTarget}
            onRetry={() => {
              void queryClient.invalidateQueries({ queryKey: queryKeys.overview.summary });
            }}
          />
        </section>

        <ActivityTimelineCard
          entries={activityQ.data?.entries ?? []}
          onOpenMaintenance={() => {
            void navigate({ to: buildHref("/workbench", { intent: "maintenance" }) });
          }}
        />
      </div>
      <RecentAcquisitionRemoveDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        onConfirm={() => {
          const target = removeTarget;
          if (!target) return;
          void removeRecentAcquisition(target, () => {
            setRemoveTarget(null);
            void queryClient.invalidateQueries({ queryKey: queryKeys.overview.summary });
          });
        }}
      />
    </main>
  );
}

async function removeRecentAcquisition(item: OverviewRecentAcquisitionDto, onSuccess: () => void) {
  try {
    await api.overview.removeRecentAcquisition({ id: item.id });
    toast.success(getT().web.removedFromRecent);
    onSuccess();
  } catch (error) {
    toast.error(toErrorMessage(error));
  }
}

export const Route = createFileRoute("/overview")({
  component: OverviewPage,
});
