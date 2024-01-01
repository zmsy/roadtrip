import { getCacheFilePath, getCachedJson } from "./cache";
import { OSRMResponse, isOSRMRoute } from "./osrm";
import { OverpassResponse } from "./overpass";
import { Restaurant, restaurantsList } from "./restaurants";
import { slugify } from "./util";

type Payload = {
  slug: string;
  restaurant: Restaurant;
  osrmResponse: OSRMResponse;
  overpassResponse: OverpassResponse;
  image: string;
};

const isPayload = (t: Payload | null): t is Payload => t !== null;

export const generatePayloads = async (): Promise<Array<Payload>> => {
  const payloads: Array<Payload | null> = await Promise.all(
    restaurantsList.map(async (restaurant) => {
      const { name } = restaurant;
      const slug = slugify(name);
      const overpassResponse = await getCachedJson<OverpassResponse>(
        slug,
        "overpass"
      );
      const osrmResponse = await getCachedJson<OSRMResponse>(slug, "osrm");
      const image = getCacheFilePath(slug, "images");
      return isOSRMRoute(osrmResponse) && overpassResponse !== undefined
        ? {
            slug,
            restaurant,
            osrmResponse,
            overpassResponse,
            image,
          }
        : null;
    })
  );
  return payloads.filter(isPayload);
};
