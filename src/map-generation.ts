import * as StaticMaps from "staticmaps";
import { decode } from "@mapbox/polyline";
import * as path from "path";

import { OSRMResponse, OSRMRoute } from "./osrm";
import { OverpassResponse } from "./overpass";
import { getCacheDir } from "./cache";

const MARKER_IMAGE_PATH = path.join(process.cwd(), "static", "marker.png");
const MARKER_IMAGE_HEIGHT = 24;
const MARKER_IMAGE_DRAW_HEIGHT = 12;
const MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ZOOM_RANGE: StaticMaps.StaticMapsOptions["zoomRange"] = {
  max: 17,
  min: 4,
};

/** Return the coordinates of the route in [long, lat] format. */
const getTripCoords = (osrmRoute: OSRMRoute): [number, number][][] => {
  return osrmRoute.trips.map((trip) => {
    const geometry = decode(trip.geometry, 6);
    // reverse lat/long
    return geometry.map(([x, y]) => [y, x]);
  });
};

/**
 * Given the information from both OSRM and Overpass, generate a static map of
 * the route + all of the stops.
 */
export const generateMap = async (
  slug: string,
  osrmResponse: OSRMResponse,
  overpassResponse: OverpassResponse
): Promise<void> => {
  if ("message" in osrmResponse || "error" in osrmResponse) {
    return;
  }

  try {
    const map = new StaticMaps({
      width: 1200,
      height: 800,
      tileUrl: MAP_TILE_URL,
      zoomRange: MAP_ZOOM_RANGE,
    });

    // add the polyline showing the full route
    const trips = getTripCoords(osrmResponse);
    trips.forEach((coords) => {
      map.addLine({
        coords,
        color: "#cc4806",
        width: 2,
      });
    });

    for (const store of overpassResponse.elements) {
      map.addMarker({
        coord: [store.lon, store.lat],
        img: MARKER_IMAGE_PATH,
        height: MARKER_IMAGE_HEIGHT,
        drawHeight: MARKER_IMAGE_DRAW_HEIGHT,
        width: MARKER_IMAGE_HEIGHT,
        drawWidth: MARKER_IMAGE_DRAW_HEIGHT,
      });
    }

    // get bounding box for finding out map coordinates to render
    // const mapCenter = getCenter(coords);
    await map.render();
    const filePath = path.join(getCacheDir(), "images", `${slug}.png`);
    await map.image.save(filePath);
  } catch (err) {
    console.error(err);
  }
};
