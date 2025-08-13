/**
 * Utility functions for farm-specific data storage
 */

/**
 * Generate a farm-specific storage key
 * @param farmId - The unique farm ID
 * @param dataType - The type of data being stored
 * @returns Farm-specific storage key
 */
export const getFarmStorageKey = (farmId: string, dataType: string): string => {
  return `farm_${farmId}_${dataType}`;
};

/**
 * Common data types used across the app
 */
export const STORAGE_KEYS = {
  FARM_SETTINGS: 'settings',
  FARM_INVENTORY: 'inventory',
  FARM_MAP_DATA: 'mapData',
  ADMIN_BATCHES: 'batches',
  ADMIN_HARVESTS: 'harvests',
  BATCH_MANAGEMENT: 'batchManagement',
  HARVEST_TRACKING: 'harvestTracking',
} as const;
