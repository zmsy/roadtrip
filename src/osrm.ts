import { OverpassNode, OverpassResponse } from "./overpass";

/**
 * Generated these types from the OSRM response types:
 * http://project-osrm.org/docs/v5.5.1/api/?language=cURL#result-objects
 */
export type OSRMRoute = {
  code: string;
  trips: Trip[];
  waypoints: Waypoint[];
};

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

/**
 * Using the coordinates from an Overpass response, generate a curl call for
 * OSRM to get the optimal route.
 */
export const formatOverpassNodesasURL = (elements?: OverpassNode[]): string => {
  elements ??= [];
  const latLongPairs = elements.map((el) => `${el.lat},${el.lon}`);
  const coordinates = latLongPairs.join(";");
  return `http://router.project-osrm.org/trip/v1/driving/${coordinates}`;
};

export const getOSRMRoute = async (
  overpass: OverpassResponse
): Promise<OSRMRoute | undefined> => {
  const url = formatOverpassNodesasURL(overpass?.elements);
  try {
    const result = await fetch(url);
    const data = await result.json();
    return data as OSRMRoute;
  } catch (err) {
    console.log(err);
  }

  return undefined;
};
