import { point, booleanPointInPolygon } from "@turf/turf";

import { msaFeatureCollection } from "./msas";

/**
 * Input a lat/long pair and return the geojson metropolitan statistical area
 * that it exists in (if it does).
 */
export const getMSA = (lat: number, long: number): string | undefined => {
  const input = point([lat, long]);
  let msa: string | undefined;
  const found = msaFeatureCollection.features.find((feat) =>
    // @ts-ignore-error
    booleanPointInPolygon(input, feat)
  );
  return found?.properties.NAME;
};
