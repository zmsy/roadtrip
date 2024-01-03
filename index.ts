import { restaurantsList } from "./src/restaurants";
import { slugify } from "./src/util";
import {
  clearInvalidEntries,
  getCachedJson,
  hasCacheFile,
  resetSlug,
  writeCacheJson,
} from "./src/cache";
import { OverpassResponse, getOverpassNodes } from "./src/overpass";
import { OSRMResponse, getOSRMRoute } from "./src/osrm";
import { generateMap } from "./src/map-generation";
import { generateSlides } from "./src/slides";

/**
 * Retrieve all overpass nodes for the restaurants that don't have an existing
 * cached entry.
 */
const getAllOverpassNodes = async () => {
  for (const restaurant of restaurantsList) {
    const { name, filter, hasIslands } = restaurant;

    // ignore ones that i've not added filters for.
    if (filter.length === 0) {
      continue;
    }

    const slug = slugify(name);
    const cached = await getCachedJson<OverpassResponse>(slug, "overpass");
    if (!cached) {
      const result = await getOverpassNodes(filter, hasIslands ?? false);
      if (result) {
        const stringified = JSON.stringify(result, null, 2);
        writeCacheJson(slug, "overpass", stringified);
      }
    }
  }
};

const getOSRMRoutes = async () => {
  for (const restaurant of restaurantsList) {
    const { name } = restaurant;
    const slug = slugify(name);

    // if there's either 1. already a result or 2. no overpass result, just skip
    // this round.
    const osrmResponse = await getCachedJson<OSRMResponse>(slug, "osrm");
    if (osrmResponse) {
      continue;
    }
    const overpassResponse = await getCachedJson<OverpassResponse>(
      slug,
      "overpass"
    );
    if (!overpassResponse) {
      continue;
    }

    const result = await getOSRMRoute(overpassResponse);
    const stringified = JSON.stringify(
      result ?? { error: "OSRM returned undefined." },
      null,
      2
    );
    writeCacheJson(slug, "osrm", stringified);
  }
};

const generateAllMaps = async () => {
  for (const restaurant of restaurantsList) {
    const { name } = restaurant;
    const slug = slugify(name);

    // if there's already an image in the cache, skip
    const hasCache = await hasCacheFile(slug, "images", "png");
    if (hasCache) {
      continue;
    }

    // if there's either 1. already a result or 2. no overpass result, just skip
    // this round.
    const osrmRoute = await getCachedJson<OSRMResponse>(slug, "osrm");
    const overpassResponse = await getCachedJson<OverpassResponse>(
      slug,
      "overpass"
    );
    if (!overpassResponse || !osrmRoute) {
      continue;
    }

    await generateMap(slug, osrmRoute, overpassResponse);
  }
};

(async () => {
  // const toReset: [string, number][] = [
  //   ["wingstop", 0],
  //   ["which-wich", 0],
  //   ["wafflehouse", 0],
  //   ["the-cheesecake-factory", 0],
  //   ["taco-johns", 0],
  //   ["taco-bell", 0],
  //   ["starbucks", 0],
  //   ["smoothie-king", 0],
  //   ["shake-shack", 0],
  //   ["schlotzkys", 0],
  //   ["rubios-coastal-grill", 0],
  //   ["round-table-pizza", 0],
  //   ["red-lobster", 0],
  //   ["quiznos", 0],
  //   ["potbelly-sandwich-shop", 0],
  //   ["popeyes", 0],
  //   ["pizza-hut", 0],
  //   ["olive-garden", 0],
  //   ["ben--jerrys", 0],
  //   ["menchies-frozen-yogurt", 0],
  //   ["mcalisters-deli", 1],
  //   ["kung-fu-tea", 1],
  //   ["jets-pizza", 1],
  //   ["krispy-kreme", 0],
  //   ["jersey-mikes-subs", 0],
  //   ["jasons-deli", 1],
  //   ["insomnia-cookies", 1],
  //   ["hungry-howies-pizza", 1],
  //   ["honeybaked-ham-co", 1],
  //   ["jamba-juice", 0],
  //   ["jack-in-the-box", 0],
  // ];
  // toReset.forEach(([slug, level]) => resetSlug(slug, level));
  // await getAllOverpassNodes();
  // await clearInvalidEntries();
  // await getOSRMRoutes();
  // await generateAllMaps();
  await generateSlides();
})();
