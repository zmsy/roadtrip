import * as StaticMaps from "staticmaps";
import { decode } from "@mapbox/polyline";
import * as path from "path";
import { Feature, Point, center, points } from "@turf/turf";

import { OSRMRoute } from "./osrm";
import { OverpassResponse } from "./overpass";
import { getCacheDir } from "./cache";

const MARKER_IMAGE_PATH = path.join(process.cwd(), "static", "marker.png");
const MAP_PADDING = 10;
const MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ZOOM_RANGE: StaticMaps.StaticMapsOptions["zoomRange"] = {
  max: 17,
  min: 4,
};

/**
 * Get the center of the list of coordinates for a polyline.
 */
const getCenter = (coords: number[][]): Feature<Point> => {
  const features = points(coords);
  return center(features);
};

/** Return the coordinates of the route in [long, lat] format. */
const getCoords = (osrmRoute: OSRMRoute): [number, number][] => {
  const geometry = decode(osrmRoute.trips[0].geometry, 6);
  // reverse lat/long
  return geometry.map(([x, y]) => [y, x]);
};

/**
 * Given the information from both OSRM and Overpass, generate a static map of
 * the route + all of the stops.
 */
export const generateMap = async (
  slug: string,
  osrmRoute: OSRMRoute,
  overpassResponse: OverpassResponse
): Promise<void> => {
  const map = new StaticMaps({
    width: 1200,
    height: 800,
    paddingX: MAP_PADDING,
    paddingY: MAP_PADDING,
    tileUrl: MAP_TILE_URL,
    zoomRange: MAP_ZOOM_RANGE,
  });

  // add the polyline showing the full route
  const coords = getCoords(osrmRoute);
  map.addLine({
    coords,
    color: "#fff",
    width: 5,
  });

  for (const store of overpassResponse.elements) {
    map.addMarker({
      coord: [store.lon, store.lat],
      img: MARKER_IMAGE_PATH,
      height: 12,
      width: 12,
    });
  }

  // get bounding box for finding out map coordinates to render
  const mapCenter = getCenter(coords);
  await map.render(mapCenter.geometry.coordinates);
  const filePath = path.join(getCacheDir(), "images", `${slug}.png`);
  await map.image.save(filePath);
};
