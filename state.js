/**
 * ═══════════════════════════════════════════════════════
 * state.js  —  FinTrack Expense Tracker
 * ═══════════════════════════════════════════════════════
 *
 * PURPOSE:
 *   This file is the SINGLE SOURCE OF TRUTH for all app data.
 *   Every piece of information the app needs to know lives here.
 *
 * WHY A SEPARATE STATE FILE?
 *   In large apps, mixing data with UI code causes bugs.
 *   If the state is centralised, any file (ui.js, events.js)
 *   can read/write it safely without confusion.
 *
 * DATA FLOW:
 *   User Action → events.js → updates State → calls ui.js → re-renders DOM
 *                                          → calls storage.js → saves to localStorage
 */

// ─────────────────────────────────────────
// THE APP STATE OBJECT
// ─────────────────────────────────────────
/**
 * AppState  — everything the app "knows" at any moment.
 *
 * transactions : Array<Transaction>
 *   The master list. Each Transaction has:
 *     id     : string  — unique identifier (Date.now() based)
 *     name   : string  — e.g. "Salary", "Rent"
 *     amount : number  — always positive (e.g. 5000)
 *     type   : 'income' | 'expense'
 *     date   : string  — ISO date "YYYY-MM-DD"
 *
 * filter       : 'all' | 'income' | 'expense'
 *   Which transactions to display (from filter tab buttons).
 *
 * searchQuery  : string
 *   Current text in the search box.
 *
 * sortKey      : 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'
 *   How to order the transaction list.
 *
 * editingId    : string | null
 *   If null → form is in "Add" mode.
 *   If a string → form is in "Edit" mode for that transaction ID.
 */
const AppState = {
  transactions: [],      // Loaded from localStorage on page load
  filter:       'all',
  searchQuery:  '',
  sortKey:      'date-desc',
  editingId:    null,
};


// ─────────────────────────────────────────
// STATE MUTATION HELPERS
// (Functions that safely change AppState)
// ─────────────────────────────────────────

/**
 * generateId()
 * Creates a unique string ID for each transaction.
 * Uses current timestamp + a random suffix to avoid duplicates
 * if two transactions are added within the same millisecond.
 *
 * @returns {string}  e.g. "txn_1718000000000_k7x"
 */
function generateId() {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
}


/**
 * addTransaction(name, amount, type, date)
 * Creates a new transaction object and pushes it to AppState.
 *
 * @param {string} name    - Transaction name
 * @param {number} amount  - Positive number
 * @param {string} type    - 'income' or 'expense'
 * @param {string} date    - ISO date string 'YYYY-MM-DD'
 * @returns {object}       - The newly created transaction
 */
function addTransaction(name, amount, type, date) {
  const newTransaction = {
    id:     generateId(),
    name:   name.trim(),
    amount: parseFloat(amount),
    type:   type,         // 'income' or 'expense'
    date:   date,
  };

  // Unshift → newest item appears first in the array
  AppState.transactions.unshift(newTransaction);
  return newTransaction;
}


/**
 * updateTransaction(id, name, amount, type, date)
 * Finds an existing transaction by ID and updates its fields in-place.
 *
 * @param {string} id
 * @param {string} name
 * @param {number} amount
 * @param {string} type
 * @param {string} date
 * @returns {boolean} - true if found and updated, false if not found
 */
function updateTransaction(id, name, amount, type, date) {
  const index = AppState.transactions.findIndex((t) => t.id === id);
  if (index === -1) return false;   // Guard: ID not found

  AppState.transactions[index] = {
    id,
    name:   name.trim(),
    amount: parseFloat(amount),
    type,
    date,
  };
  return true;
}


/**
 * deleteTransaction(id)
 * Removes a transaction from the array using filter().
 * filter() returns a NEW array excluding the matching item.
 *
 * @param {string} id  - Transaction ID to remove
 * @returns {boolean}  - true if an item was removed
 */
function deleteTransaction(id) {
  const before = AppState.transactions.length;
  AppState.transactions = AppState.transactions.filter((t) => t.id !== id);
  return AppState.transactions.length < before;
}


/**
 * getTransactionById(id)
 * Looks up a single transaction by its ID.
 * Used when the edit button is clicked to pre-fill the form.
 *
 * @param {string} id
 * @returns {object|undefined}
 */
function getTransactionById(id) {
  return AppState.transactions.find((t) => t.id === id);
}


// ─────────────────────────────────────────
// COMPUTED / DERIVED VALUES
// (Calculated from AppState.transactions)
// ─────────────────────────────────────────

/**
 * computeSummary()
 * Uses Array.reduce() to compute totals from the full transactions array.
 * Always computed from raw data (not cached) to stay accurate.
 *
 * @returns {{ totalIncome: number, totalExpense: number, balance: number }}
 */
function computeSummary() {
  const totalIncome = AppState.transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);    // reduce → sum all income amounts

  const totalExpense = AppState.transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);   // reduce → sum all expense amounts

  const balance = totalIncome - totalExpense;

  return { totalIncome, totalExpense, balance };
}


/**
 * getFilteredAndSortedTransactions()
 * Returns the subset of transactions matching current filter + search,
 * sorted by the current sortKey.
 *
 * This is what the UI actually renders — not the raw array.
 *
 * @returns {Array<object>}  - Filtered, searched, and sorted transactions
 */
function getFilteredAndSortedTransactions() {
  // Step 1: Start with full list
  let result = [...AppState.transactions];

  // Step 2: Apply type filter ('all' | 'income' | 'expense')
  if (AppState.filter !== 'all') {
    result = result.filter((t) => t.type === AppState.filter);
  }

  // Step 3: Apply search query (case-insensitive name match)
  if (AppState.searchQuery.trim() !== '') {
    const query = AppState.searchQuery.trim().toLowerCase();
    result = result.filter((t) => t.name.toLowerCase().includes(query));
  }

  // Step 4: Sort
  result.sort((a, b) => {
    switch (AppState.sortKey) {
      case 'date-desc':
        // Newest date first: compare ISO strings (lexicographic = correct for dates)
        return b.date.localeCompare(a.date);

      case 'date-asc':
        return a.date.localeCompare(b.date);

      case 'amount-desc':
        return b.amount - a.amount;     // Highest amount first

      case 'amount-asc':
        return a.amount - b.amount;     // Lowest amount first

      default:
        return 0;
    }
  });

  return result;
}
