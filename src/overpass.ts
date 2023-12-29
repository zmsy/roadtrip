import * as assert from "assert";
import { inspect } from "util";

/**
 * One of the public overpass instances:
 * https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
 */
const OVERPASS_URL = `https://overpass-api.de/api/interpreter`;

/**
 * This is the individual node you'd find in Overpass. The list of tags is where
 * most of the actual information is kept.
 */
export type OverpassNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags: {
    name: string;
    amenity: "restaurant";
    brand?: string;
    "brand:wikidata"?: string;
    "brand:wikipedia"?: string;
    [key: string]: string | undefined;
  };
};

export type OverpassResponse = {
  version: string;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    timestamp_areas_base: string;
    copyright: string;
  };
  elements: Array<OverpassNode>;
};

/**
 * Create an overpass query for the given filter to return the entire set of
 * nodes in the given areas.
 */
const getBasicQuery = (filter: string): string => `
  [out:json];

  (
    area["name"="United States"]->.searchArea;
    area["name"="Canada"]->.searchArea;
    area["name"="México"]->.searchArea;
  )->.searchArea;

  node[${filter}](area.searchArea);
  out;
`;

/**
 * In the event a chain has too many locations on islands, this is a way to
 * explicitly filter those locations out. I couldn't figure out how to remove
 * the islands from the individual query, so I instead just listed all states.
 */
const getStateByStateQuery = (filter: string): string => `
  [out:json];

  (
    // canada & mexico
    area["name"="Canada"]->.searchArea;
    area["name"="México"]->.searchArea;

    // all of the us states individually listed
    area["name"="Alabama"];
    area["name"="Alaska"];
    area["name"="Arizona"];
    area["name"="Arkansas"];
    area["name"="California"];
    area["name"="Colorado"];
    area["name"="Connecticut"];
    area["name"="Delaware"];
    area["name"="District of Columbia"];
    area["name"="Florida"];
    area["name"="Georgia"];
    area["name"="Idaho"];
    area["name"="Illinois"];
    area["name"="Indiana"];
    area["name"="Iowa"];
    area["name"="Kansas"];
    area["name"="Kentucky"];
    area["name"="Louisiana"];
    area["name"="Maine"];
    area["name"="Maryland"];
    area["name"="Massachusetts"];
    area["name"="Michigan"];
    area["name"="Minnesota"];
    area["name"="Mississippi"];
    area["name"="Missouri"];
    area["name"="Montana"];
    area["name"="Nebraska"];
    area["name"="Nevada"];
    area["name"="New Hampshire"];
    area["name"="New Jersey"];
    area["name"="New Mexico"];
    area["name"="New York"];
    area["name"="North Carolina"];
    area["name"="North Dakota"];
    area["name"="Ohio"];
    area["name"="Oklahoma"];
    area["name"="Oregon"];
    area["name"="Pennsylvania"];
    area["name"="Rhode Island"];
    area["name"="South Carolina"];
    area["name"="South Dakota"];
    area["name"="Tennessee"];
    area["name"="Texas"];
    area["name"="Utah"];
    area["name"="Vermont"];
    area["name"="Virginia"];
    area["name"="Washington"];
    area["name"="West Virginia"];
    area["name"="Wisconsin"];
    area["name"="Wyoming"];
  )->.searchArea;

  node[${filter}](area.searchArea);
  out;
`;

export const getOverpassNodes = async (
  filter: string,
  hasIslands: boolean
): Promise<OverpassResponse | undefined> => {
  let json: OverpassResponse | undefined;
  const body = hasIslands
    ? getStateByStateQuery(filter)
    : getBasicQuery(filter);
  try {
    const result = await fetch(OVERPASS_URL, {
      body,
      method: "POST",
    });
    if (result.statusText === "Bad Request") {
      throw new Error(`Bad request for filter: ${filter}`);
    }
    json = await result.json();
  } catch (err: unknown) {
    assert.ok(err instanceof Error);
    console.error(`Fetch error: ${inspect({ err, body }, false, null)}`);
  }
  return json;
};
