/**
 * One of the public overpass instances:
 * https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
 */
const OVERPASS_URL = `https://overpass.kumi.systems/api/interpreter`;

/**
 * This is the individual node you'd find in Overpass. The list of tags is where
 * most of the actual information is kept.
 */
type OverpassNode = {
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

type OverpassResponse = {
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
const getQuery = (filter: string): string => `
  [out:json];

  (
    area["name"="United States"]->.searchArea;
    area["name"="Canada"]->.searchArea;
    area["name"="Mexico"]->.searchArea;
  )->.searchArea;

  node[${filter}](area.searchArea);
  out;
`;

const getOverpassNodes = async (
  filter: string
): Promise<OverpassResponse | undefined> => {
  const result = await fetch(OVERPASS_URL, {
    body: getQuery(filter),
  });
  const json = await result.json();
  return json ?? undefined;
};
