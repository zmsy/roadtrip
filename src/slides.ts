import { getCacheFilePath, getCachedJson, writeCacheJson } from "./cache";
import { Leg, OSRMResponse, OSRMRoute, isOSRMRoute } from "./osrm";
import { OverpassResponse } from "./overpass";
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

const generateSummary = (payload: Payload): Summary => {
  const [trip] = payload.osrmRoute.trips;
  const totalMiles = round(metersToMiles(trip.distance));
  const numStops = trip.legs.length - 1;
  const drivingHours = round(trip.duration / (60 * 60)); // time in Days
  const stoppingHours = numStops;
  const days = round((drivingHours + stoppingHours) / DRIVING_HOURS_PER_DAY);
  const stopsPerDay = round(numStops / days);
  const numPeeBreaks = Math.round(drivingHours / 3);
  const longestLeg = round(
    metersToMiles(
      trip.legs.reduce((max, leg) => Math.max(max, leg.distance), 0)
    )
  );
  const medianLeg = round(
    metersToMiles(median(trip.legs.map((leg) => leg.distance)))
  );
  const sparsityScore = round(medianLeg / numStops);
  const densityScore = round(numStops / days);
  const furthestStopDistance = round(getFurthestStopDistance(trip.legs));
  return {
    days,
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
  };
};

const getTopN = (
  payloads: Array<ShortPayload>,
  key: keyof Summary,
  n: number
): Record<string, number> => {
  const topN = payloads
    .sort((a, b) => b.summary[key] - a.summary[key])
    .slice(0, n)
    .map((x) => [x.slug, x.summary[key]]);
  return Object.fromEntries(topN);
};

const getTopNLists = (payloads: Array<ShortPayload>): SummaryTopNLists => {
  const n = 5;
  return {
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
