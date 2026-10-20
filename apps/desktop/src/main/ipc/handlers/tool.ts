import type { ServiceContainer } from "@main/container";
import { type Configuration, configManager } from "@main/services/config";
import { loggerService } from "@main/services/LoggerService";
import { SymlinkServiceError } from "@main/services/tools";
import { toErrorMessage } from "@main/utils/common";
import {
  checkEmbyConnection,
  checkJellyfinConnection,
  EmbyServiceError,
  JellyfinServiceError,
  type MediaServerActorServiceDependencies,
  type PersonSyncKind,
  stopJellyfinPersonNameMatching,
  syncEmbyPersons,
  syncJellyfinPersons,
} from "@mdcz/runtime/mediaserver";
import { IpcChannel } from "@mdcz/shared/IpcChannel";
import type { IpcRouterContract } from "@mdcz/shared/ipcContract";
import type { MediaServerConnectionCheckResult, PersonSyncResult } from "@mdcz/shared/ipcTypes";
import { createIpcError, IpcErrorCode } from "../errors";
import {
  toolAmazonPosterApplyInputSchema,
  toolAmazonPosterLookupInputSchema,
  toolBatchTranslateApplyInputSchema,
  toolBatchTranslateScanInputSchema,
  toolCreateSymlinkInputSchema,
  toolDirectoryInputSchema,
  toolMediaServerModeInputSchema,
} from "../payloads";
import { asSerializableIpcError, t } from "../shared";

const logger = loggerService.getLogger("IpcRouter");

const MEDIA_SERVERS = {
  jellyfin: {
    name: "Jellyfin",
    errorType: JellyfinServiceError,
    checkConnection: checkJellyfinConnection,
    sync: syncJellyfinPersons,
  },
  emby: { name: "Emby", errorType: EmbyServiceError, checkConnection: checkEmbyConnection, sync: syncEmbyPersons },
} as const;

type MediaServerKey = keyof typeof MEDIA_SERVERS;

export const createToolHandlers = (
  context: ServiceContainer,
): Pick<
  IpcRouterContract,
  | typeof IpcChannel.Tool_JellyfinServerCheckConnection
  | typeof IpcChannel.Tool_JellyfinStopPersonNameMatching
  | typeof IpcChannel.Tool_JellyfinActorPhotoSync
  | typeof IpcChannel.Tool_JellyfinActorInfoSync
  | typeof IpcChannel.Tool_EmbyServerCheckConnection
  | typeof IpcChannel.Tool_EmbyActorPhotoSync
  | typeof IpcChannel.Tool_EmbyActorInfoSync
  | typeof IpcChannel.Tool_CreateSymlink
  | typeof IpcChannel.Tool_AmazonPosterScan
  | typeof IpcChannel.Tool_AmazonPosterLookup
  | typeof IpcChannel.Tool_AmazonPosterApply
  | typeof IpcChannel.Tool_BatchTranslateScan
  | typeof IpcChannel.Tool_BatchTranslateApply
  | typeof IpcChannel.Tool_ToggleDevTools
> => {
  const {
    signalService,
    networkClient,
    actorSourceProvider,
    personSyncLock,
    symlinkService,
    windowService,
    amazonPosterToolService,
    batchTranslateToolService,
  } = context;
  let symlinkTask: Promise<void> | null = null;
  let symlinkTaskStarting = false;

  const reportHandlerError = (operation: string, error: unknown): void => {
    logger.error(`${operation} failed: ${toErrorMessage(error)}`);
  };

  const raiseHandlerError = <T>(operation: string, error: unknown): T => {
    reportHandlerError(operation, error);
    throw asSerializableIpcError(error);
  };

  const reportBackgroundError = (operation: string, error: unknown): void => {
    signalService.showLogText(`${operation} failed: ${toErrorMessage(error)}`, "error");
  };

  const runMediaServerTool = async <T>(
    server: MediaServerKey,
    operation: string,
    task: (configuration: Configuration) => Promise<T>,
  ): Promise<T> => {
    const { name, errorType } = MEDIA_SERVERS[server];
    try {
      const configuration = await configManager.getValidated();
      if (!configuration[server].url.trim() || !configuration[server].apiKey.trim()) {
        throw createIpcError(IpcErrorCode.NETWORK_ERROR, `${name} URL and API key are required`);
      }
      return await task(configuration);
    } catch (error) {
      if (error instanceof errorType) throw createIpcError(error.code, error.message);
      return raiseHandlerError(operation, error);
    }
  };

  const createCheckConnectionHandler = (server: MediaServerKey, operation: string) =>
    t.procedure.action(
      async (): Promise<MediaServerConnectionCheckResult> =>
        await runMediaServerTool(server, operation, (configuration) =>
          MEDIA_SERVERS[server].checkConnection(networkClient, configuration),
        ),
    );

  const createSyncHandler = (server: MediaServerKey, kind: PersonSyncKind, operation: string) => {
    const deps: MediaServerActorServiceDependencies = {
      signalService: {
        showLogText: (message, level) => signalService.showLogText(message, level),
        resetProgress: () => undefined,
        setProgress: () => undefined,
      },
      networkClient,
      actorSourceProvider,
      logger: loggerService.getLogger(`${MEDIA_SERVERS[server].name}ActorSync`),
    };
    return t.procedure
      .input(toolMediaServerModeInputSchema)
      .action(
        async ({ input }): Promise<PersonSyncResult> =>
          await runMediaServerTool(server, operation, (configuration) =>
            personSyncLock.run(() => MEDIA_SERVERS[server].sync(deps, configuration, kind, input.mode)),
          ),
      );
  };

  return {
    [IpcChannel.Tool_JellyfinServerCheckConnection]: createCheckConnectionHandler(
      "jellyfin",
      "Tool_JellyfinServerCheckConnection",
    ),
    [IpcChannel.Tool_JellyfinStopPersonNameMatching]: t.procedure.action(
      async (): Promise<MediaServerConnectionCheckResult> =>
        await runMediaServerTool("jellyfin", "Tool_JellyfinStopPersonNameMatching", async (configuration) => {
          await stopJellyfinPersonNameMatching(networkClient, configuration);
          return await checkJellyfinConnection(networkClient, configuration);
        }),
    ),
    [IpcChannel.Tool_JellyfinActorPhotoSync]: createSyncHandler("jellyfin", "photo", "Tool_JellyfinActorPhotoSync"),
    [IpcChannel.Tool_JellyfinActorInfoSync]: createSyncHandler("jellyfin", "info", "Tool_JellyfinActorInfoSync"),
    [IpcChannel.Tool_EmbyServerCheckConnection]: createCheckConnectionHandler("emby", "Tool_EmbyServerCheckConnection"),
    [IpcChannel.Tool_EmbyActorPhotoSync]: createSyncHandler("emby", "photo", "Tool_EmbyActorPhotoSync"),
    [IpcChannel.Tool_EmbyActorInfoSync]: createSyncHandler("emby", "info", "Tool_EmbyActorInfoSync"),
    [IpcChannel.Tool_CreateSymlink]: t.procedure
      .input(toolCreateSymlinkInputSchema)
      .action(async ({ input }): Promise<void> => {
        try {
          if (symlinkTaskStarting || symlinkTask) {
            throw createIpcError(IpcErrorCode.OPERATION_CANCELLED, "Softlink creation task is already running");
          }

          const sourceDir = (input?.sourceDir ?? "").trim();
          const destDir = (input?.destDir ?? "").trim();
          const copyFiles = input?.copyFiles ?? false;

          if (!sourceDir || !destDir) {
            throw createIpcError(IpcErrorCode.INVALID_ARGUMENT, "Source and destination directories are required");
          }

          symlinkTaskStarting = true;
          const preparedTask = await symlinkService.prepare({ sourceDir, destDir, copyFiles });
          symlinkTask = symlinkService
            .runPrepared(preparedTask)
            .then(() => undefined)
            .catch((error) => {
              reportBackgroundError("Tool_CreateSymlink", error);
            })
            .finally(() => {
              symlinkTask = null;
            });
        } catch (error) {
          if (error instanceof SymlinkServiceError) {
            throw createIpcError(error.code, error.message);
          }
          return raiseHandlerError("Tool_CreateSymlink setup", error);
        } finally {
          symlinkTaskStarting = false;
        }
      }),
    [IpcChannel.Tool_AmazonPosterScan]: t.procedure.input(toolDirectoryInputSchema).action(async ({ input }) => {
      try {
        const directory = input?.directory?.trim();
        if (!directory) {
          throw createIpcError(IpcErrorCode.INVALID_ARGUMENT, "Directory is required");
        }
        return {
          items: await amazonPosterToolService.scan(directory),
        };
      } catch (error) {
        return raiseHandlerError("Tool_AmazonPosterScan", error);
      }
    }),
    [IpcChannel.Tool_AmazonPosterLookup]: t.procedure
      .input(toolAmazonPosterLookupInputSchema)
      .action(async ({ input }) => {
        try {
          const nfoPath = input?.nfoPath?.trim();
          const title = input?.title?.trim();
          if (!nfoPath || !title) {
            throw createIpcError(IpcErrorCode.INVALID_ARGUMENT, "NFO path and title are required");
          }
          return amazonPosterToolService.lookup(nfoPath, title);
        } catch (error) {
          return raiseHandlerError("Tool_AmazonPosterLookup", error);
        }
      }),
    [IpcChannel.Tool_AmazonPosterApply]: t.procedure
      .input(toolAmazonPosterApplyInputSchema)
      .action(async ({ input }) => {
        try {
          return {
            results: await amazonPosterToolService.apply(input?.items ?? []),
          };
        } catch (error) {
          return raiseHandlerError("Tool_AmazonPosterApply", error);
        }
      }),
    [IpcChannel.Tool_BatchTranslateScan]: t.procedure
      .input(toolBatchTranslateScanInputSchema)
      .action(async ({ input }) => {
        try {
          const directory = input?.directory?.trim();
          if (!directory) {
            throw createIpcError(IpcErrorCode.INVALID_ARGUMENT, "Directory is required");
          }

          const configuration = await configManager.getValidated();
          return {
            items: await batchTranslateToolService.scan(directory, input.mode, configuration),
          };
        } catch (error) {
          return raiseHandlerError("Tool_BatchTranslateScan", error);
        }
      }),
    [IpcChannel.Tool_BatchTranslateApply]: t.procedure
      .input(toolBatchTranslateApplyInputSchema)
      .action(async ({ input }) => {
        try {
          const items = input?.items ?? [];
          if (items.length === 0) {
            throw createIpcError(IpcErrorCode.INVALID_ARGUMENT, "At least one item is required");
          }

          const configuration = await configManager.getValidated();
          return {
            results: await batchTranslateToolService.apply(items, configuration, {
              mode: input.mode,
              maxBatchItems: input.batchSize,
            }),
          };
        } catch (error) {
          return raiseHandlerError("Tool_BatchTranslateApply", error);
        }
      }),
    [IpcChannel.Tool_ToggleDevTools]: t.procedure.action(async () => {
      windowService.toggleDevTools();
      return { success: true as const };
    }),
  };
};
