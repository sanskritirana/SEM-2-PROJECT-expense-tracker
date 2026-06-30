/**
 * ═══════════════════════════════════════════════════════
 * events.js  —  FinTrack Expense Tracker
 * ═══════════════════════════════════════════════════════
 *
 * PURPOSE:
 *   All event listeners and user-interaction logic live here.
 *   events.js is the "glue" that connects the UI to the state/storage.
 *
 * FLOW when a user does something:
 *   User Action (click/input)
 *     → Event Listener (this file)
 *       → Validate (if needed)
 *         → Mutate AppState (state.js)
 *           → Save to localStorage (storage.js)
 *             → Re-render UI (ui.js → refreshUI())
 *
 * IMPORTANT PATTERN: Event Delegation
 *   Instead of adding a click listener to EVERY edit/delete button
 *   (which would break when items are re-rendered), we add ONE
 *   listener to the PARENT LIST. When a button is clicked inside it,
 *   the click "bubbles up" to the parent, where we handle it.
 *
 *   This is the industry-standard way to handle dynamic list items.
 */


// ─────────────────────────────────────────
// 1. APP INITIALISATION
// ─────────────────────────────────────────

/**
 * initApp()
 * Called once when the page loads (see bottom of this file).
 * Loads saved data, sets default form values, and renders everything.
 */
function initApp() {
  // 1. Load transactions from localStorage into AppState
  AppState.transactions = loadFromStorage();

  // 2. Set the date input to today by default
  document.getElementById('txn-date').value = getTodayISO();

  // 3. Render the full UI with loaded data
  refreshUI();

  // 4. Attach all event listeners
  attachEventListeners();

  console.log(
    `FinTrack loaded. ${AppState.transactions.length} transactions found.`,
    `Storage size: ${getStorageSize()}`
  );
}


// ─────────────────────────────────────────
// 2. ATTACH ALL EVENT LISTENERS
// ─────────────────────────────────────────

/**
 * attachEventListeners()
 * Registers all event listeners in one place.
 * Called once during initApp().
 */
function attachEventListeners() {
  // ── Form submission ──
  document.getElementById('transaction-form')
    .addEventListener('submit', handleFormSubmit);

  // ── Cancel edit button ──
  document.getElementById('cancel-edit-btn')
    .addEventListener('click', handleCancelEdit);

  // ── Error banner close ──
  document.getElementById('error-close')
    .addEventListener('click', hideErrorBanner);

  // ── Filter tab buttons (using event delegation on parent) ──
  document.querySelector('.filter-tabs')
    .addEventListener('click', handleFilterClick);

  // ── Sort dropdown ──
  document.getElementById('sort-select')
    .addEventListener('change', handleSortChange);

  // ── Search input (live search as user types) ──
  document.getElementById('search-input')
    .addEventListener('input', handleSearchInput);

  // ── Search clear button ──
  document.getElementById('search-clear')
    .addEventListener('click', handleSearchClear);

  // ── Transaction list: Edit & Delete (Event Delegation) ──
  document.getElementById('transaction-list')
    .addEventListener('click', handleTransactionListClick);

  // ── Modal buttons ──
  document.getElementById('modal-confirm-btn')
    .addEventListener('click', handleDeleteConfirm);
  document.getElementById('modal-cancel-btn')
    .addEventListener('click', hideModal);

  // ── Close modal if user clicks the dark overlay ──
  document.getElementById('modal-overlay')
    .addEventListener('click', function (e) {
      // Only close if the click target IS the overlay, not the modal card inside it
      if (e.target === this) hideModal();
    });

  // ── Mobile hamburger menu ──
  document.getElementById('hamburger')
    .addEventListener('click', handleHamburger);

  // ── Nav links smooth scroll + close mobile menu ──
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', handleNavLinkClick);
  });

  // ── Keyboard: close modal with Escape key ──
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!document.getElementById('modal-overlay').hidden) {
        hideModal();
      }
    }
  });

  // ── Clear field errors when user starts typing (better UX) ──
  document.getElementById('txn-name').addEventListener('input', () => {
    document.getElementById('name-error').textContent = '';
    document.getElementById('txn-name').style.borderColor = '';
    document.getElementById('txn-name').style.boxShadow   = '';
  });

  document.getElementById('txn-amount').addEventListener('input', () => {
    document.getElementById('amount-error').textContent = '';
    document.getElementById('txn-amount').style.borderColor = '';
    document.getElementById('txn-amount').style.boxShadow   = '';
  });
}


// ─────────────────────────────────────────
// 3. FORM: SUBMIT HANDLER (Create + Update)
// ─────────────────────────────────────────

/**
 * handleFormSubmit(e)
 * Handles BOTH "Add Transaction" and "Update Transaction" submissions.
 * Determines which mode we're in by checking AppState.editingId.
 *
 * @param {Event} e - The submit event
 */
function handleFormSubmit(e) {
  // Prevent the browser's default form submission (which would reload the page)
  e.preventDefault();

  // Step 1: Read form values
  const name   = document.getElementById('txn-name').value;
  const amount = document.getElementById('txn-amount').value;
  const type   = document.getElementById('txn-type').value;
  const date   = document.getElementById('txn-date').value;

  // Step 2: Validate — stop if invalid
  if (!validateForm(name, amount, date)) return;

  // Step 3: Are we EDITING an existing transaction?
  if (AppState.editingId) {
    // ── UPDATE PATH ──
    const success = updateTransaction(
      AppState.editingId,
      name,
      parseFloat(amount),
      type,
      date
    );

    if (success) {
      saveToStorage();           // Persist the updated data
      AppState.editingId = null; // Exit edit mode
      resetForm();               // Clear the form
      refreshUI();               // Re-render everything
      showToast('Transaction updated successfully!', 'success');
    }

  } else {
    // ── CREATE PATH ──
    addTransaction(name, parseFloat(amount), type, date);
    saveToStorage();       // Persist the new data
    resetForm();           // Clear the form
    refreshUI();           // Re-render everything
    showToast('Transaction added!', 'success');
  }
}


// ─────────────────────────────────────────
// 4. FORM VALIDATION
// ─────────────────────────────────────────

/**
 * validateForm(name, amount, date)
 * Checks all form fields and shows appropriate error messages.
 * Returns true if the form is valid, false if there are errors.
 *
 * Validation Rules:
 *   - Name: not empty, not just whitespace
 *   - Amount: not empty, must be a valid positive number
 *   - Date: not empty
 *
 * @param {string} name
 * @param {string} amount
 * @param {string} date
 * @returns {boolean}
 */
function validateForm(name, amount, date) {
  // Clear all previous errors before re-checking
  clearErrors();

  let isValid = true;

  // ── Rule 1: Name must not be empty ──
  if (!name || name.trim() === '') {
    showFieldError('txn-name', 'Transaction name is required.');
    isValid = false;
  } else if (name.trim().length < 2) {
    showFieldError('txn-name', 'Name must be at least 2 characters.');
    isValid = false;
  }

  // ── Rule 2: Amount must be a positive number ──
  if (!amount || amount === '') {
    showFieldError('txn-amount', 'Amount is required.');
    isValid = false;
  } else {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) {
      showFieldError('txn-amount', 'Amount must be a valid number.');
      isValid = false;
    } else if (numericAmount <= 0) {
      showFieldError('txn-amount', 'Amount must be greater than zero.');
      isValid = false;
    } else if (numericAmount > 999999999) {
      showFieldError('txn-amount', 'Amount is too large.');
      isValid = false;
    }
  }

  // ── Rule 3: Date must not be empty ──
  if (!date || date === '') {
    showFieldError('txn-date', 'Date is required.');
    isValid = false;
  }

  // If overall invalid, show the top error banner too
  if (!isValid) {
    showErrorBanner('Please fix the errors below before submitting.');
  }

  return isValid;
}


// ─────────────────────────────────────────
// 5. TRANSACTION LIST: EDIT & DELETE
//    (Event Delegation Pattern)
// ─────────────────────────────────────────

/**
 * handleTransactionListClick(e)
 * Single click handler for the entire transaction list.
 * Uses e.target.closest() to find which button was clicked,
 * even if the click lands on a child element (e.g. the emoji inside the button).
 *
 * @param {Event} e - Click event that bubbled up to the list
 */
function handleTransactionListClick(e) {
  // Find the nearest ancestor button with a data-action attribute
  const btn = e.target.closest('[data-action]');
  if (!btn) return;   // Click was not on an action button

  const action = btn.dataset.action;   // 'edit' or 'delete'
  const txnId  = btn.dataset.id;       // Transaction ID

  if (action === 'edit') {
    handleEditClick(txnId);
  } else if (action === 'delete') {
    handleDeleteClick(txnId);
  }
}


/**
 * handleEditClick(txnId)
 * Called when the ✏️ button is clicked.
 * Finds the transaction and enters "edit mode".
 *
 * @param {string} txnId
 */
function handleEditClick(txnId) {
  const txn = getTransactionById(txnId);
  if (!txn) {
    showToast('Error: Transaction not found.', 'error');
    return;
  }

  // Enter edit mode: store the ID being edited
  AppState.editingId = txnId;

  // Fill the form with this transaction's data
  populateFormForEdit(txn);
}


/**
 * handleDeleteClick(txnId)
 * Called when the 🗑️ button is clicked.
 * Shows the confirmation modal BEFORE actually deleting.
 *
 * @param {string} txnId
 */
function handleDeleteClick(txnId) {
  const txn = getTransactionById(txnId);
  if (!txn) return;

  // Show modal — actual deletion happens only when user confirms
  showModal(txnId, txn.name);
}


/**
 * handleDeleteConfirm()
 * Called when user clicks "Yes, Delete" inside the modal.
 * Reads the transaction ID stored in the button's data attribute.
 */
function handleDeleteConfirm() {
  const txnId = document.getElementById('modal-confirm-btn').dataset.deleteId;
  if (!txnId) return;

  // NEW: if we were editing this transaction, cancel the edit
  if (AppState.editingId === txnId) {
    AppState.editingId = null;
    resetForm();
  }

  const success = deleteTransaction(txnId);
  if (success) {
    saveToStorage();
    hideModal();
    refreshUI();
    showToast('Transaction deleted.', 'info');
  }
}


/**
 * handleCancelEdit()
 * Called when user clicks "Cancel Edit" button.
 * Exits edit mode and resets the form.
 */
function handleCancelEdit() {
  AppState.editingId = null;
  resetForm();
  showToast('Edit cancelled.', 'info');
}


// ─────────────────────────────────────────
// 6. FILTER TABS
// ─────────────────────────────────────────

/**
 * handleFilterClick(e)
 * Handles clicks on the "All / Income / Expense" filter tabs.
 * Uses event delegation on the parent .filter-tabs container.
 *
 * @param {Event} e
 */
function handleFilterClick(e) {
  // Only react to button clicks (not clicks on the container itself)
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;

  const filter = tab.dataset.filter;   // 'all', 'income', or 'expense'

  // Update state
  AppState.filter = filter;

  // Update active tab styling: remove .active from all, add to clicked
  document.querySelectorAll('.filter-tab').forEach((t) => {
    t.classList.toggle('active', t === tab);
  });

  // Re-render the list with the new filter
  renderTransactions();
}


// ─────────────────────────────────────────
// 7. SORT
// ─────────────────────────────────────────

/**
 * handleSortChange(e)
 * Called when the sort dropdown value changes.
 *
 * @param {Event} e
 */
function handleSortChange(e) {
  AppState.sortKey = e.target.value;    // e.g. 'date-desc', 'amount-asc'
  renderTransactions();                  // Re-render with new sort order
}


// ─────────────────────────────────────────
// 8. SEARCH
// ─────────────────────────────────────────

/**
 * handleSearchInput(e)
 * Called on every keystroke in the search box.
 * Updates AppState.searchQuery and re-renders.
 *
 * @param {Event} e
 */
function handleSearchInput(e) {
  AppState.searchQuery = e.target.value;

  // Show/hide the clear button based on whether there's text
  const clearBtn = document.getElementById('search-clear');
  clearBtn.hidden = AppState.searchQuery === '';

  renderTransactions();
}


/**
 * handleSearchClear()
 * Clears the search box and resets the search state.
 */
function handleSearchClear() {
  document.getElementById('search-input').value = '';
  AppState.searchQuery = '';
  document.getElementById('search-clear').hidden = true;
  renderTransactions();
  document.getElementById('search-input').focus();  // Return focus for UX
}


// ─────────────────────────────────────────
// 9. MOBILE NAVIGATION
// ─────────────────────────────────────────

/**
 * handleHamburger()
 * Toggles the mobile nav menu open/closed.
 * Updates ARIA attributes for screen reader accessibility.
 */
function handleHamburger() {
  const nav       = document.getElementById('nav-links');
  const hamburger = document.getElementById('hamburger');
  const isOpen    = nav.classList.toggle('open');

  // Update aria-expanded for accessibility
  hamburger.setAttribute('aria-expanded', isOpen.toString());
}


/**
 * handleNavLinkClick(e)
 * Closes the mobile menu when a nav link is clicked.
 * Prevents broken UX where the menu stays open after navigation.
 *
 * @param {Event} e
 */
function handleNavLinkClick(e) {
  // Close mobile nav menu
  document.getElementById('nav-links').classList.remove('open');
  document.getElementById('hamburger').setAttribute('aria-expanded', 'false');
}


// ─────────────────────────────────────────
// 10. BOOT: RUN ON PAGE LOAD
// ─────────────────────────────────────────

/**
 * DOMContentLoaded fires once the HTML is fully parsed
 * but BEFORE images, stylesheets, etc. are loaded.
 * This is the correct event to use for initialising JS apps.
 *
 * Script load order in index.html: state.js → storage.js → ui.js → events.js
 * So by the time events.js runs, all helper functions are available.
 */
document.addEventListener('DOMContentLoaded', initApp);
