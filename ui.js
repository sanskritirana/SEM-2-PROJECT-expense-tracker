
//SAGAR GUPTA //

/**
 * ═══════════════════════════════════════════════════════
 * ui.js  —  FinTrack Expense Tracker
 * ═══════════════════════════════════════════════════════
 *
 * PURPOSE:
 *   All DOM manipulation and rendering lives here.
 *   ui.js NEVER modifies AppState directly.
 *   It only READS state and WRITES to the DOM.
 *
 * RENDERING PHILOSOPHY (innerHTML Pattern):
 *   Instead of creating individual DOM elements with
 *   document.createElement(), we build an HTML string and
 *   set innerHTML. This is simpler, faster, and readable.
 *
 * FUNCTION GROUPS:
 *   1. formatCurrency()   - Utility: number → "₹1,234.56"
 *   2. formatDate()       - Utility: "2024-06-01" → "Jun 1, 2024"
 *   3. renderSummary()    - Updates the 3 dashboard stat cards
 *   4. renderTransactions() - Builds the full transaction list
 *   5. renderEmptyState() - Shows/hides the "no transactions" UI
 *   6. renderResultsCount() - "Showing X transactions"
 *   7. populateFormForEdit() - Fills form fields when editing
 *   8. resetForm()        - Clears all form fields
 *   9. showError() / clearErrors() - Inline form validation UI
 *   10. showToast()       - Temporary notification messages
 *   11. showModal() / hideModal() - Delete confirmation dialog
 */


// ─────────────────────────────────────────
// 1. UTILITY: FORMATTERS
// ─────────────────────────────────────────

/**
 * formatCurrency(amount)
 * Formats a number as Indian Rupee currency string.
 * Uses Intl.NumberFormat — the standard JS currency API.
 *
 * Example: formatCurrency(1234567.89) → "₹12,34,567.89"
 *
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}


/**
 * formatDate(isoDateString)
 * Converts "YYYY-MM-DD" → "Jun 1, 2024" (readable format).
 *
 * We append T12:00:00 to force local timezone.
 * Without it, new Date("2024-06-01") is interpreted as UTC midnight,
 * which shows "May 31" in IST (UTC+5:30). Classic timezone bug!
 *
 * @param {string} isoDateString  - "2024-06-01"
 * @returns {string}              - "Jun 1, 2024"
 */
function formatDate(isoDateString) {
  if (!isoDateString) return '—';
  const date = new Date(isoDateString + 'T12:00:00');
  return date.toLocaleDateString('en-IN', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}


// ─────────────────────────────────────────
// 2. RENDER: SUMMARY DASHBOARD CARDS
// ─────────────────────────────────────────

/**
 * renderSummary()
 * Reads computed totals from state.js and updates the 3 stat cards.
 * Also updates the income-vs-expense progress bar.
 *
 * Called after: page load, add, update, delete.
 */
function renderSummary() {
  // computeSummary() lives in state.js
  const { totalIncome, totalExpense, balance } = computeSummary();

  // Update the text content of the 3 amount elements
  document.getElementById('balance-amount').textContent  = formatCurrency(balance);
  document.getElementById('income-amount').textContent   = formatCurrency(totalIncome);
  document.getElementById('expense-amount').textContent  = formatCurrency(totalExpense);

  // Update balance trend label
  const trendEl = document.getElementById('balance-trend');
  if (balance > 0) {
    trendEl.textContent = '▲ You\'re in the green!';
    trendEl.style.color = 'var(--clr-income)';
  } else if (balance < 0) {
    trendEl.textContent = '▼ You\'re overspending.';
    trendEl.style.color = 'var(--clr-expense)';
  } else {
    trendEl.textContent = '→ Perfectly balanced.';
    trendEl.style.color = 'var(--clr-text-muted)';
  }

  // Update the income-vs-expense visual bar
  // The bar fill width = income % of (income + expense)
  const total = totalIncome + totalExpense;
  const fillPercent = total === 0 ? 0 : (totalIncome / total) * 100;
  document.getElementById('balance-bar-fill').style.width = `${fillPercent}%`;
}


// ─────────────────────────────────────────
// 3. RENDER: TRANSACTION LIST
// ─────────────────────────────────────────

/**
 * renderTransactions()
 * Main rendering function: builds and injects all transaction list items.
 *
 * PROCESS:
 *   1. Get filtered + sorted data from state.js
 *   2. If empty → show empty state, return early
 *   3. Build HTML string for each transaction
 *   4. Set innerHTML of the list container
 *   5. Update results count text
 */
function renderTransactions() {
  const listEl     = document.getElementById('transaction-list');
  const emptyEl    = document.getElementById('empty-state');
  const emptyText  = document.getElementById('empty-text');

  // Get the currently visible (filtered/sorted) transactions
  const visible = getFilteredAndSortedTransactions();

  // ── Empty State Handling ──
  if (visible.length === 0) {
    listEl.innerHTML = '';

    // Customize the empty message based on context
    if (AppState.transactions.length === 0) {
      emptyText.textContent = 'Add your first transaction using the form above.';
    } else if (AppState.searchQuery) {
      emptyText.textContent = `No transactions match "${AppState.searchQuery}".`;
    } else {
      emptyText.textContent = `No ${AppState.filter} transactions found.`;
    }

    emptyEl.hidden = false;
    renderResultsCount(0, AppState.transactions.length);
    return;   // Stop here — nothing to render
  }

  // ── Hide empty state when we have results ──
  emptyEl.hidden = true;

  // ── Build HTML for each transaction ──
  // We map each transaction to an HTML string, then join them
  const html = visible.map((txn) => buildTransactionItemHTML(txn)).join('');
  listEl.innerHTML = html;

  // ── Update count label ──
  renderResultsCount(visible.length, AppState.transactions.length);
}


/**
 * buildTransactionItemHTML(txn)
 * Builds the HTML string for a single transaction list item.
 *
 * Uses template literals (backtick strings) with ${} interpolation.
 * Data attributes (data-id, data-action) are used by event delegation
 * in events.js — no need to add individual event listeners to each button.
 *
 * @param {object} txn  - A transaction object from AppState
 * @returns {string}    - HTML string for one <li> item
 */
function buildTransactionItemHTML(txn) {
  const isIncome     = txn.type === 'income';
  const typeClass    = isIncome ? 'income' : 'expense';
  const badgeSymbol  = isIncome ? '↑' : '↓';
  const amountPrefix = isIncome ? '+' : '−';

  // Escape the name to prevent XSS (cross-site scripting) attacks.
  // If someone names a transaction "<script>alert('hack')</script>",
  // this prevents it from executing as actual HTML.
  const safeName = escapeHTML(txn.name);

  return `
    <li class="transaction-item"
        data-id="${txn.id}"
        role="listitem">

      <!-- Type indicator badge -->
      <div class="txn-badge txn-badge--${typeClass}" aria-hidden="true">
        ${badgeSymbol}
      </div>

      <!-- Transaction info -->
      <div class="txn-info">
        <div class="txn-name" title="${safeName}">${safeName}</div>
        <div class="txn-meta">
          ${formatDate(txn.date)}
          &nbsp;·&nbsp;
          <span class="txn-type-label">${txn.type.charAt(0).toUpperCase() + txn.type.slice(1)}</span>
        </div>
      </div>

      <!-- Amount + action buttons -->
      <div class="txn-right">
        <span class="txn-amount txn-amount--${typeClass}"
              aria-label="${amountPrefix}${formatCurrency(txn.amount)}">
          ${amountPrefix}${formatCurrency(txn.amount)}
        </span>
        <div class="txn-actions" role="group" aria-label="Actions for ${safeName}">
          <button class="btn btn--icon btn--icon-edit"
                  data-action="edit"
                  data-id="${txn.id}"
                  title="Edit this transaction"
                  aria-label="Edit ${safeName}">
            ✏️
          </button>
          <button class="btn btn--icon btn--icon-delete"
                  data-action="delete"
                  data-id="${txn.id}"
                  title="Delete this transaction"
                  aria-label="Delete ${safeName}">
            🗑️
          </button>
        </div>
      </div>
    </li>
  `;
}


/**
 * escapeHTML(str)
 * Replaces dangerous HTML characters with their safe entity equivalents.
 * This prevents XSS (Cross-Site Scripting) attacks.
 *
 * e.g. '<script>' becomes '&lt;script&gt;'
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// ─────────────────────────────────────────
// 4. RENDER: RESULTS COUNT
// ─────────────────────────────────────────

/**
 * renderResultsCount(visible, total)
 * Displays how many transactions are showing vs total.
 *
 * @param {number} visible  - Transactions after filter/search
 * @param {number} total    - All transactions in state
 */
function renderResultsCount(visible, total) {
  const el = document.getElementById('results-count');
  if (total === 0) {
    el.textContent = '';
    return;
  }
  if (visible === total) {
    el.textContent = `Showing all ${total} transaction${total !== 1 ? 's' : ''}`;
  } else {
    el.textContent = `Showing ${visible} of ${total} transaction${total !== 1 ? 's' : ''}`;
  }
}


// ─────────────────────────────────────────
// 5. FORM: POPULATE FOR EDIT
// ─────────────────────────────────────────

/**
 * populateFormForEdit(txn)
 * When the user clicks ✏️ on a transaction, this function:
 *   1. Scrolls to the form
 *   2. Fills in all form fields with the existing data
 *   3. Changes the submit button text to "Update Transaction"
 *   4. Shows the "Cancel Edit" button
 *
 * @param {object} txn  - The transaction to edit
 */
function populateFormForEdit(txn) {
  // Fill all form fields
  document.getElementById('edit-id').value     = txn.id;
  document.getElementById('txn-name').value    = txn.name;
  document.getElementById('txn-amount').value  = txn.amount;
  document.getElementById('txn-type').value    = txn.type;
  document.getElementById('txn-date').value    = txn.date;

  // Update UI to show we're in edit mode
  document.getElementById('form-title').textContent   = '✏️ Edit Transaction';
  document.getElementById('submit-btn').textContent   = 'Update Transaction';
  document.getElementById('cancel-edit-btn').hidden   = false;

  // Clear any previous validation errors
  clearErrors();

  // Smooth scroll to the form so the user can see the fields
  document.getElementById('add-transaction').scrollIntoView({
    behavior: 'smooth',
    block:    'start',
  });
}


/**
 * resetForm()
 * Resets the form back to its default "Add Transaction" state.
 * Called after: successful add, successful update, cancel edit click.
 */
function resetForm() {
  // Clear all inputs
  document.getElementById('transaction-form').reset();
  document.getElementById('edit-id').value = '';

  // Set today's date as default for next transaction
  document.getElementById('txn-date').value = getTodayISO();

  // Restore UI to "Add" mode
  document.getElementById('form-title').textContent  = 'Add Transaction';
  document.getElementById('submit-btn').textContent  = 'Add Transaction';
  document.getElementById('cancel-edit-btn').hidden  = true;

  // Reset state tracking
  AppState.editingId = null;

  // Clear all errors
  clearErrors();
}


/**
 * getTodayISO()
 * Returns today's date as an ISO string "YYYY-MM-DD".
 * Used to pre-fill the date field on form reset.
 *
 * @returns {string}  e.g. "2024-06-14"
 */
function getTodayISO() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed!
  const dd   = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}


// ─────────────────────────────────────────
// 6. FORM: VALIDATION ERROR UI
// ─────────────────────────────────────────

/**
 * showFieldError(fieldId, message)
 * Displays an error message under a specific input field.
 * Also adds a red border to the input via a CSS class.
 *
 * @param {string} fieldId  - ID of the input (e.g. 'txn-name')
 * @param {string} message  - Error text to display
 */
function showFieldError(fieldId, message) {
  const errorEl = document.getElementById(`${fieldId.replace('txn-', '')}-error`);
  const inputEl = document.getElementById(fieldId);

  if (errorEl) errorEl.textContent = message;
  if (inputEl) {
    inputEl.style.borderColor = 'var(--clr-expense)';
    inputEl.style.boxShadow   = '0 0 0 3px rgba(244, 63, 94, 0.2)';
  }
}


/**
 * clearErrors()
 * Clears ALL validation error states from the form.
 * Called before each new validation attempt.
 */
function clearErrors() {
  // Clear inline field errors
  const errorSpans = document.querySelectorAll('.field-error');
  errorSpans.forEach((span) => { span.textContent = ''; });

  // Reset input border colors
  const inputs = document.querySelectorAll('.form-input');
  inputs.forEach((input) => {
    input.style.borderColor = '';
    input.style.boxShadow   = '';
  });

  // Hide the top error banner
  hideErrorBanner();
}


/**
 * showErrorBanner(message)
 * Shows the red error banner at the top of the form.
 * Used for general form-level errors.
 *
 * @param {string} message
 */
function showErrorBanner(message) {
  const banner  = document.getElementById('error-banner');
  const msgEl   = document.getElementById('error-message');
  msgEl.textContent = message;
  banner.hidden = false;
}


/**
 * hideErrorBanner()
 * Hides the red error banner.
 */
function hideErrorBanner() {
  document.getElementById('error-banner').hidden = true;
}


// ─────────────────────────────────────────
// 7. TOAST NOTIFICATIONS
// ─────────────────────────────────────────

// Holds the ID of the auto-dismiss timer so we can cancel it if needed
let toastTimer = null;

/**
 * showToast(message, type, duration)
 * Displays a temporary notification that auto-dismisses.
 *
 * @param {string} message  - Text to display
 * @param {string} type     - 'success' | 'error' | 'info'
 * @param {number} duration - Milliseconds before auto-hide (default: 3000)
 */
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.getElementById('toast');

  // Remove old type classes, add new one
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toast.hidden = false;

  // Clear any existing auto-dismiss timer
  if (toastTimer) clearTimeout(toastTimer);

  // Auto-hide after `duration` milliseconds
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, duration);
}


// ─────────────────────────────────────────
// 8. MODAL (Delete Confirmation)
// ─────────────────────────────────────────

/**
 * showModal(txnId, txnName)
 * Displays the delete confirmation modal.
 * Stores the transaction ID in a data attribute on the confirm button,
 * so events.js can read it when the user clicks "Yes, Delete".
 *
 * @param {string} txnId    - ID of transaction to delete
 * @param {string} txnName  - Name shown in the modal body
 */
function showModal(txnId, txnName) {
  const overlay    = document.getElementById('modal-overlay');
  const confirmBtn = document.getElementById('modal-confirm-btn');
  const nameEl     = document.getElementById('modal-txn-name');

  nameEl.textContent           = txnName;
  confirmBtn.dataset.deleteId  = txnId;    // Store ID for the confirm handler
  overlay.hidden               = false;

  // Focus the cancel button for keyboard accessibility
  // (so pressing Enter doesn't accidentally confirm the delete)
  document.getElementById('modal-cancel-btn').focus();
}


/**
 * hideModal()
 * Hides the modal and clears its stored data.
 */
function hideModal() {
  const overlay    = document.getElementById('modal-overlay');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  overlay.hidden          = true;
  confirmBtn.dataset.deleteId = '';
}


// ─────────────────────────────────────────
// 9. FULL REFRESH  (Master Render Function)
// ─────────────────────────────────────────

/**
 * refreshUI()
 * The ONE function that re-renders everything.
 * Called after any state change (add / update / delete / filter / sort / search).
 *
 * Calling this ensures the whole UI is always in sync with AppState.
 */
function refreshUI() {
  renderSummary();
  renderTransactions();
}