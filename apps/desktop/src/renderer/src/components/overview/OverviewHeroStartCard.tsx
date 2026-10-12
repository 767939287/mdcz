import { openNewWorkbenchTask } from "@mdcz/views/adapters/workbenchSession";
import { useT } from "@mdcz/views/i18n";
import { OverviewHeroStartCard as SharedOverviewHeroStartCard } from "@mdcz/views/overview";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { createDesktopMaintenanceActionPort } from "@/adapters/ports";
import { ipc } from "@/client/ipc";
import { useCurrentConfig } from "@/hooks/configQueries";
import { useOutputSummary } from "@/hooks/useOverview";

type OverviewHeroStartCardProps = Pick<ComponentProps<typeof SharedOverviewHeroStartCard>, "className">;

export function OverviewHeroStartCard({ className }: OverviewHeroStartCardProps) {
  const t = useT();
  const navigate = useNavigate();
  const configQ = useCurrentConfig();
  const summaryQ = useOutputSummary();
  const librariesQ = useQuery({ queryKey: ["libraries"], queryFn: () => ipc.libraries.list() });
  const hasConfiguredOutput = Boolean(
    configQ.data?.paths?.outputSummaryPath?.trim() || (librariesQ.data?.libraries.length ?? 0) > 0,
  );

  return (
    <SharedOverviewHeroStartCard
      className={className}
      data={summaryQ.data}
      hasConfiguredOutput={hasConfiguredOutput}
      isError={summaryQ.isError}
      isLoading={configQ.isLoading || summaryQ.isLoading || librariesQ.isLoading}
      labels={{ startAction: t.overview.hero.startAction, setupAction: t.libraries.createFirst }}
      onSetup={() => navigate({ to: "/libraries" })}
      onStart={async () => {
        try {
          await openNewWorkbenchTask("scrape", () => createDesktopMaintenanceActionPort().discardSession());
          await navigate({ to: "/workbench" });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : String(error));
        }
      }}
    />
  );
}
