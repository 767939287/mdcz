import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DesktopPersistenceService } from "@main/services/persistence";
import { publicationJournal } from "@mdcz/runtime/publication";
import { afterEach, describe, expect, it } from "vitest";
import { createTempDirectory, type TempDirectoryHarness } from "../../../harness/tempDirectory";

const directories: TempDirectoryHarness[] = [];
const services: DesktopPersistenceService[] = [];

afterEach(async () => {
  await Promise.all(services.splice(0).map(async (service) => await service.close()));
  await Promise.all(directories.splice(0).map(async (directory) => await directory.cleanup()));
});

const createService = async () => {
  const directory = await createTempDirectory("desktop-persistence");
  directories.push(directory);
  const service = new DesktopPersistenceService(join(directory.path, "data", "mdcz.sqlite"), null);
  services.push(service);
  return { directory, service };
};

describe("DesktopPersistenceService", () => {
  it("joins concurrent initialize and getState onto a single recovery", async () => {
    const { service } = await createService();

    const [first, second, third] = await Promise.all([service.initialize(), service.initialize(), service.getState()]);

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(service.initialized).toBe(true);
  });

  it("removes the journaled publication staging an earlier run left behind when initialize runs", async () => {
    const { directory, service } = await createService();
    const mediaRoot = join(directory.path, "media");
    await mkdir(mediaRoot, { recursive: true });

    await service.initialize();
    const stagedFile = join(mediaRoot, "movie.mp4.mdcz-staging-test.part");
    const stagedDirectory = join(mediaRoot, "nested", ".mdcz-staging-assets");
    const unjournaledStaging = join(mediaRoot, "other.mp4.mdcz-staging-foreign.part");
    publicationJournal.record(stagedFile);
    publicationJournal.record(stagedDirectory);
    await mkdir(stagedDirectory, { recursive: true });
    await Promise.all([
      writeFile(stagedFile, "staged"),
      writeFile(join(stagedDirectory, "poster.jpg"), "staged"),
      writeFile(unjournaledStaging, "keep"),
    ]);
    await service.close();

    const restarted = new DesktopPersistenceService(join(directory.path, "data", "mdcz.sqlite"), null);
    services.push(restarted);
    await restarted.initialize();

    await expect(readFile(stagedFile)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(stagedDirectory)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(unjournaledStaging, "utf8")).resolves.toBe("keep");
  });
});
