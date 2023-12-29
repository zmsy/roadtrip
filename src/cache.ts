import * as fs from "fs/promises";
import * as path from "path";

import type { OverpassResponse } from "./overpass";

type Subfolder = "overpass" | "osrm" | "images";

/**
 * Return the cache folder.
 */
export const getCacheDir = () => path.join(process.cwd(), ".roadtrip_cache");

/**
 * Get the location of a specific file in the cache.
 */
const getCacheFilePath = (slug: string, subfolder: Subfolder) =>
  path.join(getCacheDir(), subfolder, `${slug}.json`);

/**
 * Check to see if there's a cached overpass response and return it.
 */
export const getCachedJson = async <T>(
  slug: string,
  subfolder: Subfolder,
  invalidate = false
): Promise<T | undefined> => {
  // this is just a forcing function to return nothing if we're invalidating the
  // cache instead of using it.
  if (invalidate) {
    return undefined;
  }

  const fileName = getCacheFilePath(slug, subfolder);
  try {
    await fs.access(fileName);
    const data = await fs.readFile(fileName);
    return JSON.parse(data.toString()) as T;
  } catch (err: unknown) {
    // pass if cache miss
  }

  return undefined;
};

/**
 * Write the response from the overpass API to the cache so it can be inspected
 * from the file system.
 */
export const writeCacheJson = async (
  slug: string,
  subfolder: Subfolder,
  contents: string
): Promise<void> => {
  const fileName = getCacheFilePath(slug, subfolder);
  await fs.writeFile(fileName, contents);
};

/**
 * Remove any invalid cache entries that either are errors or have known
 * invalid response codes.
 */
export const clearInvalidEntries = async () => {
  /** Helper function to remove any invalid JSON in the cache. */
  const removeInvalidEntries = async (folderPath: string) => {
    const entries = (await fs.readdir(folderPath)).filter(
      (x) => path.extname(x) === ".json"
    );

    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry);

      try {
        const content = await fs.readFile(entryPath);
        const parsed = JSON.parse(content.toString());

        // Remove the file if it's an invalid entry
        if (parsed["message"] !== undefined || parsed["error"] !== undefined) {
          await fs.unlink(entryPath);
        }
      } catch (error) {
        console.error(
          `Error reading JSON file ${entryPath}: ${JSON.stringify(error)}`
        );
      }
    }
  };

  removeInvalidEntries(path.join(getCacheDir(), "osrm"));
  removeInvalidEntries(path.join(getCacheDir(), "overpass"));
};
