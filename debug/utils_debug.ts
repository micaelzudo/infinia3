import { storageKeys } from "./constants_debug";

export const getChunkKeyY = (
  chunkX: number,
  chunkY: number,
  chunkZ: number
) => {
  return `${chunkX},${chunkY},${chunkZ}`;
};

export function getSeed(): number {
  return parseFloat(
    sessionStorage.getItem(storageKeys.MAP_SEED) || Math.random().toString()
  );
}
