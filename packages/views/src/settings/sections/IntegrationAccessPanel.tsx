import { toErrorMessage } from "@mdcz/shared/error";
import type { ApiKeyDto } from "@mdcz/shared/serverDtos";
import { Button, Input } from "@mdcz/ui";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useT } from "../../i18n";
import { type SettingsIntegrationServices, useSettingsNotifier } from "../SettingsServices";

export function IntegrationAccessPanel({ integrations }: { integrations: SettingsIntegrationServices }) {
  const t = useT();
  const notifier = useSettingsNotifier();
  const [keys, setKeys] = useState<ApiKeyDto[]>([]);
  const [name, setName] = useState("qBittorrent");
  const [secret, setSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const shownKey = secret ?? "<API key>";
  // A query parameter survives Windows backslashes and spaces in %F, which JSON quoting would not.
  const qbittorrentCommand = `curl -fsS -X POST -G -H "Authorization: Bearer ${shownKey}" --data-urlencode "path=%F" ${integrations.origin}/api/automation/scrape/start`;
  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      setKeys(await integrations.listApiKeys());
    } catch (error) {
      notifier.error(toErrorMessage(error));
    }
  };

  useEffect(() => {
    integrations.listApiKeys().then(setKeys, (error: unknown) => notifier.error(toErrorMessage(error)));
  }, [integrations, notifier]);

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={t.settings.integrations.keyName}
          className="max-w-xs"
          placeholder={t.settings.integrations.keyNamePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          disabled={creating || !name.trim()}
          onClick={async () => {
            setCreating(true);
            await run(async () => setSecret(await integrations.createApiKey(name.trim())));
            setCreating(false);
          }}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t.settings.integrations.create}
        </Button>
      </div>

      {secret ? (
        <div className="space-y-1 rounded-quiet border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <div className="font-medium">{t.settings.integrations.created}</div>
          <CopyLine value={secret} />
        </div>
      ) : null}

      <ul className="divide-y divide-border/60 rounded-quiet border border-border/60">
        {keys.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">{t.settings.integrations.noKeys}</li>
        ) : null}
        {keys.map((key) => (
          <li key={key.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium">{key.name}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {key.prefix}… ·{" "}
                {t.settings.integrations.lastUsed(key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : null)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void run(async () => await integrations.revokeApiKey(key.id))}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t.settings.integrations.revoke}
            </Button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">{t.settings.integrations.addressHint}</p>
      <Snippet title={t.settings.integrations.qbittorrentTitle} hint={t.settings.integrations.qbittorrentHint}>
        <CopyLine value={qbittorrentCommand} />
      </Snippet>
      <Snippet title={t.settings.integrations.clouddriveTitle} hint={t.settings.integrations.clouddriveHint}>
        <CopyLine value={`${integrations.origin}/api/webhooks/clouddrive`} />
      </Snippet>
    </div>
  );
}

function Snippet({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold">{title}</div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

function CopyLine({ value }: { value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2">
      <code className="min-w-0 flex-1 break-all rounded-quiet bg-surface-low px-2 py-1.5 font-mono text-[11px]">
        {value}
      </code>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? t.settings.integrations.copied : t.settings.integrations.copy}
      </Button>
    </div>
  );
}
