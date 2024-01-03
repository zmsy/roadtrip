import { getCacheFilePath, getCachedJson, writeCacheJson } from "./cache";
import { Leg, OSRMResponse, OSRMRoute, isOSRMRoute, Trip } from "./osrm";
import { LatLon, OverpassResponse } from "./overpass";
import { Restaurant, restaurantsList } from "./restaurants";
import { slugify } from "./util";

const DRIVING_HOURS_PER_DAY = 12;

type Payload = {
  slug: string;
  restaurant: Restaurant;
  osrmRoute: OSRMRoute;
  overpassResponse: OverpassResponse;
  image: string;
};

type ShortPayload = Pick<Payload, "slug" | "restaurant" | "image"> & {
  summary: Summary;
};

type Summary = {
  /** How many trips would this take? */
  numTrips: number;
  /** How many miles is the trip in total? */
  totalMiles: number;
  /** How many stops are there on the journey? */
  numStops: number;
  /** How many days would this journey take? */
  days: number;
  /** How many stops are made per day? */
  stopsPerDay: number;
  /** How many actual hours would be spent driving */
  drivingHours: number;
  /** How many times would you have to pee? Assumes someone pees 1x per 3 hr */
  numPeeBreaks: number;
  /** What's the longest individual leg of the journey? */
  longestLeg: number;
  /** What's the median of the leg distances? */
  medianLeg: number;
  /** How sparsely populated is this route? */
  sparsityScore: number;
  /** How densely populated is this route? */
  densityScore: number;
  /** Stop distance = distance to + distance from, what's the farthest?  */
  furthestStopDistance: number;
  /** Northernmost point */
  northernMostLat: number;
  /** Southernmost point */
  southernMostLat: number;
};

type SummaryTopNLists = {
  [x in keyof Summary]: Record<string, number>;
};

const isPayload = (t: Payload | null): t is Payload => t !== null;

const getPayloads = async (): Promise<Array<Payload>> => {
  const payloads: Array<Payload | null> = await Promise.all(
    restaurantsList.map(async (restaurant) => {
      const { name } = restaurant;
      const slug = slugify(name);
      const overpassResponse = await getCachedJson<OverpassResponse>(
        slug,
        "overpass"
      );
      const osrmRoute = await getCachedJson<OSRMResponse>(slug, "osrm");
      const image = getCacheFilePath(slug, "images");
      return isOSRMRoute(osrmRoute) && overpassResponse !== undefined
        ? {
            slug,
            restaurant,
            osrmRoute,
            overpassResponse,
            image,
          }
        : null;
    })
  );
  return payloads.filter(isPayload);
};

/** Convert meters to miles. */
const metersToMiles = (meters: number): number => meters * 0.000621371;

/** Generate a median. */
const median = (arr: number[]): number => {
  if (!arr.length) {
    throw new Error("Must have length to calculate median.");
  }
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const round = (input: number, precision = 2): number => {
  return Number(input.toFixed(precision));
};

/** Calculate the furhtu */
const getFurthestStopDistance = (legs: Leg[]): number => {
  let max = 0;
  for (let i = 0; i < legs.length - 2; i++) {
    const distance = legs[i].distance + legs[i + 1].distance;
    max = Math.max(max, distance);
  }
  return max;
};

/**
 * Approach 1: Map/Reduce - Apply a function to each dataset and apply another
 * to sum them up.
 */
const mapReduce = (
  route: OSRMRoute,
  mapFunc: (trip: Trip) => number,
  reduceFunc: (outputs: number[]) => number
): number => {
  const mapFuncOutputs = route.trips.map(mapFunc);
  const singleValue = reduceFunc(mapFuncOutputs);
  return singleValue;
};

/**
 * Approach 2: Summarize - Merge together all of the trip legs and then apply the
 * summarize function to each one.
 */
const flatMapLegs = (
  route: OSRMRoute,
  mapFunc: (legs: Leg[]) => number,
  reduceFunc: (outputs: number[]) => number
): number => {
  const mapFuncOutputs = route.trips.map((trip) => trip.legs).flatMap(mapFunc);
  const singleValue = reduceFunc(mapFuncOutputs);
  return singleValue;
};

const sum = (nums: number[]) => round(nums.reduce((a, b) => a + b));

const generateSummary = (payload: Payload): Summary => {
  const { osrmRoute } = payload;

  // trip-based metrics
  const numTrips = mapReduce(osrmRoute, (trip) => 1, sum);
  const totalMiles = mapReduce(
    osrmRoute,
    (trip) => metersToMiles(trip.distance),
    sum
  );
  const numStops = mapReduce(osrmRoute, (trip) => trip.legs.length - 1, sum);
  const drivingHours = mapReduce(
    osrmRoute,
    (trip) => round(trip.duration / (60 * 60)),
    sum
  );
  const stoppingHours = numStops;
  const days = round((drivingHours + stoppingHours) / DRIVING_HOURS_PER_DAY);
  const stopsPerDay = round(numStops / days);
  const densityScore = round(numStops / days);
  const numPeeBreaks = Math.round(drivingHours / 3);

  // individual leg-based metrics
  const tripLegs = osrmRoute.trips.flatMap((trip) => trip.legs);
  const longestLeg = round(
    metersToMiles(tripLegs.reduce((max, leg) => Math.max(max, leg.distance), 0))
  );
  const medianLeg = round(
    metersToMiles(median(tripLegs.map((leg) => leg.distance)))
  );
  const sparsityScore = round(medianLeg / numStops);
  const furthestStopDistance = round(
    metersToMiles(getFurthestStopDistance(tripLegs))
  );

  // individual coordinate-based ones
  const coords: LatLon[] = payload.overpassResponse.elements.map((el) => ({
    lat: el.lat,
    lon: el.lon,
  }));
  const northernMostLat = coords
    .map((co) => co.lat)
    .reduce((a, b) => Math.max(a, b));
  const southernMostLat = coords
    .map((co) => co.lat)
    .reduce((a, b) => Math.min(a, b));

  return {
    days,
    numTrips,
    drivingHours,
    numPeeBreaks,
    numStops,
    stopsPerDay,
    totalMiles,
    medianLeg,
    longestLeg,
    sparsityScore,
    densityScore,
    furthestStopDistance,
    northernMostLat,
    southernMostLat,
  };
};

const getTopN = (
  payloads: Array<ShortPayload>,
  key: keyof Summary,
  n: number,
  reverse = false
): Record<string, number> => {
  const topN = payloads
    .sort((a, b) =>
      reverse
        ? a.summary[key] - b.summary[key]
        : b.summary[key] - a.summary[key]
    )
    .slice(0, n)
    .map((x) => [x.slug, x.summary[key]]);
  return Object.fromEntries(topN);
};

const getTopNLists = (payloads: Array<ShortPayload>): SummaryTopNLists => {
  const n = 5;
  return {
    numTrips: getTopN(payloads, "numTrips", n),
    days: getTopN(payloads, "days", n),
    drivingHours: getTopN(payloads, "drivingHours", n),
    numPeeBreaks: getTopN(payloads, "numPeeBreaks", n),
    numStops: getTopN(payloads, "numStops", n),
    stopsPerDay: getTopN(payloads, "stopsPerDay", n),
    totalMiles: getTopN(payloads, "totalMiles", n),
    medianLeg: getTopN(payloads, "medianLeg", n),
    longestLeg: getTopN(payloads, "longestLeg", n),
    sparsityScore: getTopN(payloads, "sparsityScore", n),
    densityScore: getTopN(payloads, "densityScore", n),
    furthestStopDistance: getTopN(payloads, "furthestStopDistance", n),
    northernMostLat: getTopN(payloads, "northernMostLat", n),
    southernMostLat: getTopN(payloads, "southernMostLat", n, true),
  };
};

export const generateSlides = async (): Promise<void> => {
  const payloads = await getPayloads();
  const shortPayloads: Array<ShortPayload> = payloads.map((payload) => {
    const summary = generateSummary(payload);
    return {
      restaurant: payload.restaurant,
      slug: payload.slug,
      image: payload.image,
      summary,
    };
  });
  await writeCacheJson(
    "summary",
    "summary",
    JSON.stringify(shortPayloads, null, 2)
  );
  const topNLists = getTopNLists(shortPayloads);
  await writeCacheJson(
    "top-n-lists",
    "summary",
    JSON.stringify(topNLists, null, 2)
  );
};
