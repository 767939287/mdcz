import { openNewWorkbenchTask } from "@mdcz/views/adapters/workbenchSession";
import { OverviewMaintenanceCard as SharedOverviewMaintenanceCard } from "@mdcz/views/overview";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { createDesktopMaintenanceActionPort } from "@/adapters/ports";

export function OverviewMaintenanceCard() {
  const navigate = useNavigate();

  return (
    <SharedOverviewMaintenanceCard
      onOpen={async () => {
        try {
          await openNewWorkbenchTask("maintenance", () => createDesktopMaintenanceActionPort().discardSession());
          await navigate({ to: "/workbench", search: { intent: "maintenance" } });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : String(error));
        }
      }}
    />
  );
}
