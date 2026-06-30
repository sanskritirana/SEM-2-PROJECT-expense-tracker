/**
 * ═══════════════════════════════════════════════════════
 * storage.js  —  FinTrack Expense Tracker
 * ═══════════════════════════════════════════════════════
 *
 * PURPOSE:
 *   All localStorage read / write operations live here.
 *   Every other file calls these functions instead of
 *   accessing localStorage directly. This makes the
 *   storage layer easy to swap (e.g., IndexedDB later).
 *
 * KEY CONCEPT: localStorage only stores STRINGS.
 *   So we must:
 *     - JSON.stringify(array) before saving (array → string)
 *     - JSON.parse(string)    after loading  (string → array)
 *
 * localStorage WORKFLOW:
 *   1. App loads  → loadFromStorage() → JSON.parse → fill AppState
 *   2. User adds  → saveToStorage()   → JSON.stringify → localStorage
 *   3. User edits → saveToStorage()   → same as above
 *   4. User deletes → saveToStorage() → same as above
 *   5. Page refresh → step 1 again    → data is still there ✓
 */

// The key used to store data in localStorage.
// Using a namespaced key avoids collisions with other apps on the same origin.
const STORAGE_KEY = 'fintrack_transactions_v1';


/**
 * saveToStorage()
 * Converts the transactions array to a JSON string and stores it.
 *
 * Called after EVERY change (add / update / delete).
 *
 * JSON.stringify() converts:
 *   [{ id: "txn_1", name: "Salary", amount: 50000, type: "income", date: "2024-06-01" }]
 *   →  '[{"id":"txn_1","name":"Salary","amount":50000,"type":"income","date":"2024-06-01"}]'
 *
 * Wrapped in try-catch because localStorage can throw if:
 *   - The storage quota is exceeded (rare but possible)
 *   - The browser is in private/incognito mode with storage disabled
 */
function saveToStorage() {
  try {
    const dataString = JSON.stringify(AppState.transactions);
    localStorage.setItem(STORAGE_KEY, dataString);
  } catch (error) {
    // Show a warning but don't crash the app
    console.error('FinTrack: Could not save to localStorage.', error);
    showToast('Warning: Could not save data. Storage may be full.', 'error');
  }
}


/**
 * loadFromStorage()
 * Reads the JSON string from localStorage and parses it back into an array.
 *
 * JSON.parse() converts:
 *   '[{"id":"txn_1","name":"Salary","amount":50000,"type":"income","date":"2024-06-01"}]'
 *   → [{ id: "txn_1", name: "Salary", amount: 50000, type: "income", date: "2024-06-01" }]
 *
 * Returns an empty array [] if:
 *   - No data has been saved yet (first visit)
 *   - The stored data is corrupted / invalid JSON
 *
 * @returns {Array<object>}  - The parsed transactions array (or [])
 */
function loadFromStorage() {
  try {
    const dataString = localStorage.getItem(STORAGE_KEY);

    // If key doesn't exist yet, getItem returns null
    if (dataString === null) {
      return [];
    }

    const parsed = JSON.parse(dataString);

    // Guard: ensure we got an array, not some other data type
    if (!Array.isArray(parsed)) {
      console.warn('FinTrack: Stored data was not an array. Resetting.');
      return [];
    }

    return parsed;

  } catch (error) {
    // JSON.parse() can throw SyntaxError if the string is corrupted
    console.error('FinTrack: Failed to parse localStorage data.', error);
    return [];    // Start fresh rather than crashing
  }
}


/**
 * clearStorage()
 * Removes all FinTrack data from localStorage.
 * Only used for debugging/dev purposes (not exposed in UI).
 */
function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}


/**
 * getStorageSize()
 * Returns the approximate size of data stored in localStorage.
 * Useful for debugging and edge case awareness during viva.
 *
 * @returns {string}  - Human-readable size e.g. "2.4 KB"
 */
function getStorageSize() {
  const dataString = localStorage.getItem(STORAGE_KEY) || '';
  const bytes = new Blob([dataString]).size;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}