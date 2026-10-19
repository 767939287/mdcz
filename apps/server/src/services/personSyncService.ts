import { randomUUID } from "node:crypto";
import type { ActorSourceProvider } from "@mdcz/runtime/actorSource";
import {
  EmbyActorInfoService,
  EmbyActorPhotoService,
  JellyfinActorInfoService,
  JellyfinActorPhotoService,
  type MediaServerSignalService,
} from "@mdcz/runtime/mediaserver";
import type { NetworkClient } from "@mdcz/runtime/network";
import { runtimeLoggerService, toErrorMessage } from "@mdcz/runtime/shared";
import type { PersonSyncJobDto, PersonSyncStartInput } from "@mdcz/shared/serverDtos";
import type { TaskEventBus } from "../taskEvents";
import type { ServerConfigService } from "./configService";

const PROGRESS_PUBLISH_INTERVAL_MS = 250;

/** Runs one person sync at a time on the server, so its state outlives the page that started it. */
export class PersonSyncService {
  #job: PersonSyncJobDto | null = null;
  #publishTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly config: ServerConfigService,
    private readonly taskEvents: TaskEventBus,
    private readonly deps: { networkClient: NetworkClient; actorSourceProvider: ActorSourceProvider },
  ) {}

  status(): PersonSyncJobDto | null {
    return this.#job;
  }

  start(input: PersonSyncStartInput): PersonSyncJobDto {
    // Info and photo syncs write the same person records, so any second request joins the running sync.
    if (this.#job?.status === "running") return this.#job;
    const job: PersonSyncJobDto = {
      ...input,
      id: randomUUID(),
      status: "running",
      current: 0,
      total: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      result: null,
      error: null,
    };
    this.#job = job;
    this.taskEvents.personSync(job);
    void this.#run(job);
    return job;
  }

  async #run(job: PersonSyncJobDto): Promise<void> {
    const logger = runtimeLoggerService.getLogger(job.server === "emby" ? "EmbyActorSync" : "JellyfinActorSync");
    const signalService: MediaServerSignalService = {
      resetProgress: () => this.#progress(0, 0),
      setProgress: (_percent, current = 0, total = 0) => this.#progress(current, total),
      showLogText: (message, level = "info") => logger[level](message),
    };
    const deps = { ...this.deps, signalService, logger };
    try {
      const configuration = await this.config.get();
      const service =
        job.server === "emby"
          ? job.kind === "info"
            ? new EmbyActorInfoService(deps)
            : new EmbyActorPhotoService(deps)
          : job.kind === "info"
            ? new JellyfinActorInfoService(deps)
            : new JellyfinActorPhotoService(deps);
      this.#finish({ status: "completed", result: await service.run(configuration, job.mode) });
    } catch (error) {
      const message = toErrorMessage(error);
      logger.error(`Person sync failed: ${message}`);
      this.#finish({ status: "failed", error: message });
    }
  }

  #progress(current: number, total: number): void {
    if (!this.#job) return;
    this.#job = { ...this.#job, current, total };
    this.#publishTimer ??= setTimeout(() => {
      this.#publishTimer = undefined;
      if (this.#job) this.taskEvents.personSync(this.#job);
    }, PROGRESS_PUBLISH_INTERVAL_MS);
  }

  #finish(outcome: Pick<PersonSyncJobDto, "status"> & Partial<Pick<PersonSyncJobDto, "result" | "error">>): void {
    if (!this.#job) return;
    clearTimeout(this.#publishTimer);
    this.#publishTimer = undefined;
    this.#job = { ...this.#job, ...outcome, finishedAt: new Date().toISOString() };
    this.taskEvents.personSync(this.#job);
  }
}
