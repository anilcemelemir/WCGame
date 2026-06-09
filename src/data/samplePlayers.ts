import { Player, PlayerPosition } from "../types";

const countries = [
  "Turkiye",
  "Brazil",
  "Spain",
  "France",
  "England",
  "Argentina",
  "Germany",
  "Japan",
];

const baseRatings: Record<string, number> = {
  Turkiye: 78,
  Brazil: 84,
  Spain: 84,
  France: 85,
  England: 84,
  Argentina: 84,
  Germany: 82,
  Japan: 79,
};

const clubs = [
  "Istanbul SK",
  "Madrid Blanco",
  "Paris Rouge",
  "Manchester North",
  "Munich Rot",
  "Milan Nero",
  "Lisbon Verde",
  "Tokyo Blue",
];

const firstNames = [
  "Arda",
  "Kerem",
  "Emir",
  "Rafael",
  "Lucas",
  "Mateo",
  "Theo",
  "Noah",
  "Leo",
  "Hugo",
  "Kai",
  "Ren",
];

const lastNames = [
  "Yilmaz",
  "Silva",
  "Garcia",
  "Martin",
  "Santos",
  "Demir",
  "Muller",
  "Tanaka",
  "Costa",
  "Rossi",
  "Kane",
  "Alvarez",
];

function positionForIndex(index: number): PlayerPosition {
  if (index < 3) return "GK";
  if (index < 11) return "DEF";
  if (index < 19) return "MID";
  return "FWD";
}

function ratingFor(country: string, index: number): number {
  const curve = [7, 5, 4, 3, 2, 2, 1, 1, 0, 0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -5, -6, -6, -7, -8, -9, -10];
  return Math.max(55, Math.min(92, baseRatings[country] + curve[index]));
}

export const samplePlayers: Player[] = countries.flatMap((country, countryIndex) =>
  Array.from({ length: 26 }, (_, index) => {
    const first = firstNames[(index + countryIndex) % firstNames.length];
    const last = lastNames[(index * 2 + countryIndex) % lastNames.length];
    const id = `${country.toLowerCase()}-${index + 1}`;

    return {
      id,
      name: `${first} ${last}`,
      nationality: country,
      club: clubs[(index + countryIndex) % clubs.length],
      overall: ratingFor(country, index),
      position: positionForIndex(index),
      age: 19 + ((index + countryIndex) % 16),
    };
  }),
);
