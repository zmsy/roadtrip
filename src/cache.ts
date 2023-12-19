import * as fs from "fs/promises";
import * as path from "path";

import type { OverpassResponse } from "./overpass";

/**
 * Return the cache folder.
 */
const getCacheDir = () => path.join(process.cwd(), ".roadtrip_cache");

/**
 * Get the location of a specific file in the cache.
 */
const getCacheFilePath = (slug: string) =>
  path.join(getCacheDir(), `${slug}.json`);

/**
 * Check to see if there's a cached overpass response and return it.
 */
export const getCachedJson = async (
  slug: string,
  invalidate = false
): Promise<OverpassResponse | undefined> => {
  // this is just a forcing function to return nothing if we're invalidating the
  // cache instead of using it.
  if (invalidate) {
    return undefined;
  }

  const fileName = getCacheFilePath(slug);
  try {
    await fs.access(fileName);
    const data = await fs.readFile(fileName);
    return JSON.parse(data.toString()) as OverpassResponse;
  } catch (err: unknown) {
    console.log(err);
  }

  return undefined;
};

/**
 * Write the response from the overpass API to the cache so it can be inspected
 * from the file system.
 */
export const writeCacheJson = async (
  slug: string,
  contents: string
): Promise<void> => {
  const fileName = getCacheFilePath(slug);
  await fs.writeFile(fileName, contents);
};
