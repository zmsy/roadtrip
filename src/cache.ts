import * as fs from "fs/promises";
import * as path from "path";

type Subfolder = "overpass" | "osrm" | "images" | "markdown" | "summary";

/**
 * Return the cache folder.
 */
export const getCacheDir = () => path.join(process.cwd(), ".roadtrip_cache");

/**
 * Get the location of a specific file in the cache.
 */
export const getCacheFilePath = (
  slug: string,
  subfolder: Subfolder,
  ext = "json"
) => path.join(getCacheDir(), subfolder, `${slug}.${ext}`);

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
 * Just check to see if there's a file in the cache at that specific path, this
 * is for things like images or summary files that aren't individually able to
 * be invalidated.
 */
export const hasCacheFile = async (
  slug: string,
  subfolder: Subfolder,
  ext: string
): Promise<boolean> => {
  const fileName = getCacheFilePath(slug, subfolder, ext);
  try {
    await fs.access(fileName);
    return true;
  } catch (err) {}

  return false;
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

  await removeInvalidEntries(path.join(getCacheDir(), "osrm"));
  await removeInvalidEntries(path.join(getCacheDir(), "overpass"));
};

/**
 * Remove the cached information for a specific slug so it can be reprocessed in
 * its entirety.
 */
export const resetSlug = async (
  slug: string,
  level: 0 | 1 | 2 = 0 // pipeline is linear, reset up to this level
): Promise<void> => {
  const invalidationLevels: [Subfolder, string][] = [
    ["overpass", "json"],
    ["osrm", "json"],
    ["images", "png"],
  ];
  for (let i = level; i <= 2; i++) {
    const [subfolder, ext] = invalidationLevels[i];
    try {
      await fs.unlink(getCacheFilePath(slug, subfolder, ext));
    } catch (err) {
      console.error(err);
    }
  }
};
