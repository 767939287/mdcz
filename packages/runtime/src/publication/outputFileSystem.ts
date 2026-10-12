import { randomUUID } from "node:crypto";
import {
  copyFile,
  link,
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  rmdir,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { PublicationFileSystem } from "./types";

export const outputFileSystem: PublicationFileSystem = {
  copyFile,
  link,
  symlink: async (target, path) => await symlink(target, path, "file"),
  mkdir,
  rmdir,
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

/** Directories one publication created, so a failed one can take back the empty folders it left behind. */
export class CreatedDirectories {
  readonly #created: Array<{ leaf: string; top: string }> = [];

  constructor(private readonly fileSystem: PublicationFileSystem) {}

  async make(directory: string): Promise<void> {
    const top = await this.fileSystem.mkdir(directory, { recursive: true });
    if (top) this.#created.push({ leaf: path.resolve(directory), top: path.resolve(top) });
  }

  async removeEmpty(warn: (message: string) => void): Promise<void> {
    for (const { leaf, top } of this.#created.toReversed()) {
      for (let current = leaf; ; current = path.dirname(current)) {
        try {
          await this.fileSystem.rmdir(current);
        } catch (error) {
          // A folder that holds anything, or is already gone, belongs to someone else now.
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== "ENOTEMPTY" && code !== "EEXIST" && code !== "ENOENT")
            warn(`Failed to remove empty directory ${current}: ${error instanceof Error ? error.message : error}`);
          break;
        }
        if (current === top) break;
      }
    }
  }
}

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
