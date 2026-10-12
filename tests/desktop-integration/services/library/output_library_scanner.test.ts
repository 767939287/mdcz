import { OutputLibraryScanner } from "@main/services/library/OutputLibraryScanner";
import { createMediaRoot } from "@mdcz/media-store";
import { LibraryRepository, MediaRootRepository, type PersistenceDatabase } from "@mdcz/persistence";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestPersistenceDatabase } from "../../../../packages/persistence/src/testDatabase";

const databases: PersistenceDatabase[] = [];

const createPersistenceService = () => {
  const database = createTestPersistenceDatabase();
  databases.push(database);
  const library = new LibraryRepository(database);
  const mediaRoots = new MediaRootRepository(database);
  return {
    database,
    library,
    mediaRoots,
    service: {
      getState: vi.fn(async () => ({
        database,
        repositories: {
          library,
          mediaRoots,
        },
      })),
    },
  };
};

describe("OutputLibraryScanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const database of databases.splice(0)) {
      database.close();
    }
  });

  it("returns an empty summary without a persistence service", async () => {
    const scanner = new OutputLibraryScanner({
      ttlMs: 60_000,
      now: () => 12_345,
      logger: { warn: vi.fn() },
    });

    await expect(scanner.getSummary()).resolves.toEqual({
      fileCount: 0,
      totalBytes: 0,
      scannedAt: 12_345,
    });
  });

  it("sums every persisted library entry and caches until invalidated", async () => {
    const { library, mediaRoots, service } = createPersistenceService();
    await mediaRoots.upsert(createMediaRoot({ id: "root-1", displayName: "Output", hostPath: "/media/output" }));
    await library.upsertEntry({
      movie: { number: "A" },
      files: [{ rootId: "root-1", rootRelativePath: "A.mp4", size: 4, fileId: "root-1:A.mp4" }],
    });
    await library.upsertEntry({
      movie: { number: "B" },
      files: [{ rootId: "root-1", rootRelativePath: "nested/B.mkv", size: 6, fileId: "root-1:nested/B.mkv" }],
    });
    const scanner = new OutputLibraryScanner({
      persistenceService: service as never,
      ttlMs: 60_000,
      now: () => 456,
      logger: { warn: vi.fn() },
    });

    const first = await scanner.getSummary();
    expect(first).toEqual({ fileCount: 2, totalBytes: 10, scannedAt: 456 });

    await library.upsertEntry({
      movie: { number: "C" },
      files: [{ rootId: "root-1", rootRelativePath: "C.mp4", size: 5, fileId: "root-1:C.mp4" }],
    });
    await expect(scanner.getSummary()).resolves.toEqual(first);

    scanner.invalidate();
    await expect(scanner.getSummary()).resolves.toEqual({ fileCount: 3, totalBytes: 15, scannedAt: 456 });
  });
});
