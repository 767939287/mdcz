import { randomUUID } from "node:crypto";
import { copyFile, link, lstat, mkdir, open, readdir, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PublicationFileSystem } from "./types";

export const outputFileSystem: PublicationFileSystem = {
  copyFile,
  link,
  symlink: async (target, path) => await symlink(target, path, "file"),
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  lstat,
  writeFile,
  flush: async (filePath) => {
    const handle = await open(filePath, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
};

/** Probed once per library save and scrape run, so a refused symlink fails up front instead of on every movie. */
export const assertSymlinkSupport = async (directory: string): Promise<void> => {
  const probePath = path.join(directory, `.mdcz-symlink-probe-${randomUUID()}`);
  try {
    await symlink("missing-target", probePath, "file");
  } catch (error) {
    // Unelevated Windows processes lack SeCreateSymbolicLinkPrivilege unless Developer Mode is on.
    if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM")
      throw new Error(
        "The current user's permissions are insufficient to create symlinks. Please right-click the application and select 'Run as administrator'.",
        { cause: error },
      );
    throw error;
  }
  await rm(probePath, { force: true });
};
