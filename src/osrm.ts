import { inspect } from "util";

import { OverpassNode, OverpassResponse } from "./overpass";

// const OSRM_API_URL = `http://router.project-osrm.org`;
const OSRM_API_URL = `https://routing.openstreetmap.de/routed-car`;

/**
 * Generated these types from the OSRM response types:
 * http://project-osrm.org/docs/v5.5.1/api/?language=cURL#result-objects
 */
export type OSRMRoute = {
  code: string;
  trips: Trip[];
  waypoints: Waypoint[];
};

export type OSRMError = {
  error: string;
};

export type OSRMInvalidRoute = {
  code: string;
  message: string;
};

export type OSRMResponse = OSRMRoute | OSRMError | OSRMInvalidRoute;

type Trip = {
  geometry: string;
  legs: Leg[];
  weight_name: string;
  weight: number;
  duration: number;
  distance: number;
};

type Leg = {
  steps: Step[];
  summary: string;
  weight: number;
  duration: number;
  distance: number;
};

type Step = {
  geometry: string;
  maneuver: Maneuver;
  mode: Mode;
  driving_side: DrivingSide;
  name: string;
  intersections: Intersection[];
  weight: number;
  duration: number;
  distance: number;
};

type DrivingSide = "right";

type Intersection = {
  out?: number;
  entry: boolean[];
  bearings: number[];
  location: [number, number];
  in?: number;
};

type Maneuver = {
  bearing_after: number;
  bearing_before: number;
  location: [number, number];
  type: Type;
};

type Type = "depart" | "arrive";

type Mode = "driving";

type Waypoint = {
  waypoint_index: number;
  trips_index: number;
  hint: string;
  distance: number;
  name: string;
  location: [number, number];
};

/** Convert meters to miles. */
const metersToMiles = (meters: number): number => meters * 0.000621371;

/**
 * Get the set of search params for the overpass trips API. Detailed here:
 * http://project-osrm.org/docs/v5.5.1/api/?language=cURL#trip-service
 */
const getOverpassSearchParams = (): string => {
  const params = new URLSearchParams([
    // ["annotations", "true"],
    ["overview", "simplified"], // full geo is too big of a file size
    ["geometries", "polyline6"], // use 6 digit coords
    // ["roundtrip", "false"], // don't require returning to start
  ]);
  return params.toString();
};

/**
 * Using the coordinates from an Overpass response, generate a curl call for
 * OSRM to get the optimal route.
 */
export const formatOverpassNodesasURL = (elements?: OverpassNode[]): string => {
  const latLongPairs = (elements ?? []).map((el) => `${el.lon},${el.lat}`);
  const coordinates = latLongPairs.join(";");
  const params = getOverpassSearchParams();
  return `${OSRM_API_URL}/trip/v1/driving/${coordinates}?${params}`;
};

export const getOSRMRoute = async (
  response: OverpassResponse
): Promise<OSRMRoute | undefined> => {
  const url = formatOverpassNodesasURL(response?.elements);
  try {
    const result = await fetch(url);
    const data = await result.json();
    return data as OSRMRoute;
  } catch (err) {
    console.error(
      inspect({
        err,
        url,
      })
    );
  }

  return undefined;
};
