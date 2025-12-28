
const DB_NAME = 'travel-buddy-maps';
const STORE_NAME = 'tiles';
const DB_VERSION = 1;

// Initialize IndexedDB
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

// Save a blob to IndexedDB
export const saveTile = async (key: string, blob: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, key);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Get a blob from IndexedDB
export const getTile = async (key: string): Promise<Blob | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Math: Convert Lat/Lng to Tile Coordinates
const long2tile = (lon: number, zoom: number) => {
  return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
};

const lat2tile = (lat: number, zoom: number) => {
  return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
};

// Generate list of tile URLs to download for a region
export const getTilesForArea = (lat: number, lng: number, zoomLevels: number[] = [12, 13, 14]) => {
  const tiles: { x: number, y: number, z: number, url: string, key: string }[] = [];
  const RADIUS = 2; // Tiles in each direction (approx 2-3km buffer depending on zoom)

  zoomLevels.forEach(z => {
    const centerX = long2tile(lng, z);
    const centerY = lat2tile(lat, z);

    for (let x = centerX - RADIUS; x <= centerX + RADIUS; x++) {
      for (let y = centerY - RADIUS; y <= centerY + RADIUS; y++) {
        // CartoDB Voyager Tiles
        const url = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
        const key = `${z}_${x}_${y}`;
        tiles.push({ x, y, z, url, key });
      }
    }
  });

  return tiles;
};

// Helper to fetch and store a single tile
export const fetchAndCacheTile = async (url: string, key: string): Promise<void> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();
    await saveTile(key, blob);
  } catch (err) {
    console.warn(`Failed to cache tile: ${url}`, err);
    // Don't throw, just skip
  }
};
