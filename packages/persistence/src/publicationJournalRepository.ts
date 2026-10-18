import { eq } from "drizzle-orm";
import type { PersistenceDatabase } from "./database";
import { publicationTemporaryPaths } from "./schema";

export type PublicationJournalEntry = { path: string; restoreTo: string | null };

/** Temporary files publications create inside libraries, so startup recovery visits only those paths. */
export class PublicationJournalRepository {
  constructor(private readonly database: PersistenceDatabase) {}

  record(entry: PublicationJournalEntry): void {
    this.database.db
      .insert(publicationTemporaryPaths)
      .values(entry)
      .onConflictDoUpdate({ target: publicationTemporaryPaths.path, set: { restoreTo: entry.restoreTo } })
      .run();
  }

  forget(path: string): void {
    this.database.db.delete(publicationTemporaryPaths).where(eq(publicationTemporaryPaths.path, path)).run();
  }

  list(): PublicationJournalEntry[] {
    return this.database.db.select().from(publicationTemporaryPaths).all();
  }
}
