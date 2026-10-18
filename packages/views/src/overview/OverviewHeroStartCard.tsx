import { formatBytes } from "@mdcz/shared/format";
import { Button, cn } from "@mdcz/ui";
import { FolderCog, Play, Telescope } from "lucide-react";
import { useT } from "../i18n";

export interface OverviewHeroStartCardProps {
  className?: string;
  data?: {
    fileCount: number;
    totalBytes: number;
  } | null;
  hasConfiguredOutput?: boolean;
  isError?: boolean;
  isLoading?: boolean;
  labels?: {
    startAction: string;
    setupAction: string;
  };
  onStart: () => void;
  onSetup: () => void;
}

export function OverviewHeroStartCard({
  className,
  data,
  hasConfiguredOutput = false,
  isError = false,
  isLoading = false,
  labels,
  onStart,
  onSetup,
}: OverviewHeroStartCardProps) {
  const t = useT();
  const startAction = labels?.startAction ?? t.overview.hero.startAction;
  const setupAction = labels?.setupAction ?? t.overview.hero.setupAction;
  const canStart = isLoading || isError || hasConfiguredOutput;

  return (
    <section
      className={cn(
        "relative flex min-h-[210px] flex-col justify-between overflow-hidden rounded-quiet-xl bg-[linear-gradient(135deg,#050505_0%,#111111_56%,#2f3131_100%)] p-6 text-white shadow-none md:p-7",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.13),transparent_28%,rgba(255,255,255,0.05)_100%)]" />

      <div className="relative z-10 flex items-start justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t.overview.hero.title}</h2>
          <p className="mt-2 max-w-lg text-base leading-7 text-white/66">{t.overview.hero.description}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-quiet-lg bg-white/10 text-white/55">
          <Telescope className="h-5 w-5" />
        </div>
      </div>

      <div className="relative z-10 mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-7">
          {isLoading ? (
            <>
              <MetricBlock label={t.overview.hero.files} value="..." />
              <MetricBlock label={t.overview.hero.size} value="..." />
            </>
          ) : isError ? (
            <>
              <MetricBlock label={t.overview.hero.files} value="-" />
              <MetricBlock label={t.overview.hero.size} value={t.overview.hero.loadFailed} />
            </>
          ) : hasConfiguredOutput ? (
            <>
              <MetricBlock label={t.overview.hero.files} value={data?.fileCount ?? 0} />
              <MetricBlock
                label={t.overview.hero.size}
                value={formatBytes(data?.totalBytes ?? 0, { fractionDigits: 2, trimTrailingZeros: true })}
              />
            </>
          ) : (
            <>
              <MetricBlock label={t.overview.hero.files} value="-" />
              <MetricBlock label={t.overview.hero.size} value={t.overview.hero.notConfigured} />
            </>
          )}
        </div>

        <Button
          type="button"
          className="h-14 rounded-quiet-capsule bg-primary-foreground px-8! font-bold text-primary hover:bg-primary-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          onClick={canStart ? onStart : onSetup}
        >
          {canStart ? <Play className="h-4 w-4 fill-current" /> : <FolderCog className="h-4 w-4" />}
          {canStart ? startAction : setupAction}
        </Button>
      </div>
    </section>
  );
}

function MetricBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-sm font-medium text-white/54">{label}</div>
      <div className="mt-1 font-numeric text-xl font-bold tracking-tight text-white">{value}</div>
    </div>
  );
}
