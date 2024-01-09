import { inspect } from "util";

import { point, clustersKmeans } from "@turf/turf";

import { LatLon, OverpassNode, OverpassResponse } from "./overpass";

// const OSRM_API_URL = `http://router.project-osrm.org`;
const OSRM_API_URL = `https://routing.openstreetmap.de/routed-car`;
const OSRM_MAX_NODES = 100;

/**
 * Generated these types from the OSRM response types:
 * http://project-osrm.org/docs/v5.5.1/api/?language=cURL#result-objects
 */
export type OSRMRoute = {
  code: "Ok";
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

export const isOSRMRoute = (
  response: OSRMResponse | undefined
): response is OSRMRoute => {
  return (response as OSRMRoute)?.["code"] === "Ok";
};

export type Trip = {
  geometry: string;
  legs: Leg[];
  weight_name: string;
  weight: number;
  duration: number;
  distance: number;
};

export type Leg = {
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
export const formatOverpassNodesasURL = (elements?: LatLon[]): string => {
  const latLongPairs = (elements ?? []).map((el) => `${el.lon},${el.lat}`);
  const coordinates = latLongPairs.join(";");
  const params = getOverpassSearchParams();
  return `${OSRM_API_URL}/trip/v1/driving/${coordinates}?${params}`;
};

/**
 * If the trip is
 */
const splitTrip = (elements?: OverpassNode[]): LatLon[][] => {
  if (!elements?.length) {
    throw new Error("Can't split an empty list!");
  }
  // if it's less than 100, just return it as a single list.
  if (elements.length < OSRM_MAX_NODES) {
    return [elements.map((el) => ({ lat: el.lat, lon: el.lon }))];
  }

  // recursively divide the lists until they're all under 100;
  const iteration = 0;
  const buckets: LatLon[][] = [elements];
  while (buckets.some((x) => x.length > 100)) {
    // find the first element that's not
    const tooLongIdx = buckets.findIndex((x) => x.length > 100)!;
    const tooLong = buckets[tooLongIdx];
    buckets.splice(tooLongIdx, 1); // delete the original

    const clustered = clustersKmeans(
      {
        type: "FeatureCollection",
        features: tooLong.map((stop) => point([stop.lon, stop.lat])),
      },
      {
        numberOfClusters:
          iteration === 0 ? Math.ceil(tooLong.length / OSRM_MAX_NODES) + 1 : 2,
      }
    );
    const newClusters = clustered.features.reduce((acc, feat) => {
      const cluster = feat.properties.cluster ?? 0;
      const [lon, lat] = feat.geometry.coordinates;
      acc[cluster] ??= [];
      acc[cluster].push({ lon, lat });
      return acc;
    }, [] as LatLon[][]);
    newClusters.forEach((cluster) => buckets.push(cluster));
  }

  return buckets;
};

/**
 * Call OSRM and get the response for a given route.
 */
export const getOSRMRoute = async (
  response: OverpassResponse
): Promise<OSRMRoute | OSRMInvalidRoute | undefined> => {
  if ((response?.elements.length || 0) > 100) {
    splitTrip(response.elements);
  }
  const trips = splitTrip(response?.elements);
  // create output that looks like an OSRM response.
  const output: OSRMRoute & { invalidRoutes: any[] } = {
    code: "Ok",
    trips: [],
    waypoints: [],
    invalidRoutes: [],
  };
  for (const trip of trips) {
    const url = formatOverpassNodesasURL(trip);
    try {
      const result = await fetch(url);
      const data: OSRMRoute | OSRMInvalidRoute = await result.json();
      if (!isOSRMRoute(data)) {
        // this means it errored out somewhere along the way. this should just
        // be returned as an error.
        output.invalidRoutes.push(data);
      } else {
        output.trips.push(data.trips[0]);
      }
    } catch (err) {
      console.error(
        inspect({
          err,
          url,
        })
      );
      output.invalidRoutes.push({
        code: "Error",
        message: `${JSON.stringify(err)}`,
      });
      return undefined;
    }
  }

  return output;
};
