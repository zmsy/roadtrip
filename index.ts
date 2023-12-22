import { restaurantsList } from "./src/restaurants";
import { slugify } from "./src/util";
import { getCachedJson, writeCacheJson } from "./src/cache";
import { getOverpassNodes } from "./src/overpass";
import { formatOverpassNodesasURL } from "./src/osrm";

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
    const cached = await getCachedJson(slug);
    if (!cached) {
      const result = await getOverpassNodes(filter);
      if (result) {
        const stringified = JSON.stringify(result, null, 2);
        writeCacheJson(slug, stringified);
      }
    }
  }
};

const getRoutes = async () => {
  for (const restaurant of restaurantsList) {
    const { name } = restaurant;
    const slug = slugify(name);

    // this is just a placeholder for now
    const cached = await getCachedJson(slug);
    if (!cached) {
      continue;
    }
    const url = formatOverpassNodesasURL(cached.elements);
    console.log(`${name} => ${url}`);
  }
};

(async () => {
  getAllOverpassNodes();
  getRoutes();
})();
