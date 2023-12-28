import * as fs from "fs/promises";
import * as path from "path";

import type { OverpassResponse } from "./overpass";

type Subfolder = "overpass" | "osrm";

/**
 * Return the cache folder.
 */
const getCacheDir = () => path.join(process.cwd(), ".roadtrip_cache");

/**
 * Get the location of a specific file in the cache.
 */
const getCacheFilePath = (slug: string, subfolder: Subfolder) =>
  path.join(getCacheDir(), subfolder, `${slug}.json`);

/**
 * Check to see if there's a cached overpass response and return it.
 */
export const getCachedJson = async (
  slug: string,
  subfolder: Subfolder,
  invalidate = false
): Promise<OverpassResponse | undefined> => {
  // this is just a forcing function to return nothing if we're invalidating the
  // cache instead of using it.
  if (invalidate) {
    return undefined;
  }

  const fileName = getCacheFilePath(slug, subfolder);
  console.log("Hey!");
  try {
    await fs.access(fileName);
    const data = await fs.readFile(fileName);
    return JSON.parse(data.toString()) as OverpassResponse;
  } catch (err: unknown) {
    console.log();
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
