import { restaurantsList } from "./src/restaurants";
import { slugify } from "./src/util";
import { getCachedJson, writeCacheJson } from "./src/cache";
import { OverpassResponse, getOverpassNodes } from "./src/overpass";
import { OSRMResponse, OSRMRoute, getOSRMRoute } from "./src/osrm";
import { generateMap } from "./src/map-generation";

/**
 * Retrieve all overpass nodes for the restaurants that don't have an existing
 * cached entry.
 */
const getAllOverpassNodes = async () => {
  for (const restaurant of restaurantsList) {
    const { name, filter } = restaurant;

    // ignore ones that i've not added filters for.
    if (filter.length === 0) {
      continue;
    }

    const slug = slugify(name);
    const cached = await getCachedJson<OverpassResponse>(slug, "overpass");
    if (!cached) {
      const result = await getOverpassNodes(filter);
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

    generateMap(slug, osrmRoute, overpassResponse);
  }
};

(async () => {
  // await getAllOverpassNodes();
  await getOSRMRoutes();
  await generateAllMaps();
})();
