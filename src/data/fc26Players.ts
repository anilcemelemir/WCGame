import fc26CsvUrl from "../../FC26_20250921.csv?url";
import { parseCsv } from "../lib/csv";
import { normalizeFc26Players } from "../lib/dataset";
import { Player } from "../types";

let cachedPlayers: Player[] | null = null;

export async function loadFc26Players(): Promise<Player[]> {
  if (cachedPlayers) return cachedPlayers;

  const response = await fetch(fc26CsvUrl);
  if (!response.ok) {
    throw new Error(`FC26 dataset could not be loaded: ${response.status}`);
  }

  const rows = parseCsv(await response.text());
  cachedPlayers = normalizeFc26Players(rows);
  return cachedPlayers;
}
