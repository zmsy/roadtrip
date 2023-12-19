import { restaurantsList } from "./src/restaurants";
import { slugify } from "./src/util";
import { getCachedJson, writeCacheJson } from "./src/cache";
import { getOverpassNodes } from "./src/overpass";

/**
 * Main function for running the script.
 */
const main = async () => {
  for (const restaurant of restaurantsList) {
    const { name, filter } = restaurant;
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

(async () => {
  main();
})();
