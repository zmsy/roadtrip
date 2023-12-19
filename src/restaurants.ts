type Restaurant = {
  /**
   * What's the name of this restaurant?
   */
  name: string;
  /**
   * Overpass QL filter for nodes.
   */
  filter: string;
};

/**
 * List of restaurants that we care to roadtrip to.
 */
export const restaurantsList: Array<Restaurant> = [
  {
    name: "Applebee's Neighborhood Bar & Grill",
    filter: `"name"~"^Applebee's"`,
  },
  {
    name: "Margaritaville",
    filter: `"name"="Margaritaville"`,
  },
];
