// public/js/inventory.js
// Cleaned inventory client logic.
// - Prefers utils.js (window.fetchJson, window.safeNumber, window.API_BASE).
// - If utils.js is not present, a safe fallback is provided (no /api/api duplication).
// - No top-level await. Defensive: will not throw if elements are missing.

(function () {
  'use strict';

  // ---------- helpers (use utils.js if present; otherwise a safe fallback) ----------
  (function setupHelpers() {
    // If utils.js already provided the helpers and API_BASE, do nothing.
    if (typeof window.fetchJson === 'function' && typeof window.safeNumber === 'function' && typeof window.API_BASE !== 'undefined') {
      return;
    }

    // Minimal safe fallbacks (only used if utils.js was NOT loaded).
    // NOTE: recommended to include utils.js before inventory.js so these are not used.
    console.warn('Browser code response: utils.js not found — using local safe fallbacks for fetchJson and safeNumber. Recommended: include utils.js before inventory.js');

    // Canonical API base (no /api/api duplication)
    window.API_BASE = window.API_BASE || (location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : ':3000') + '/api');

    if (typeof window.safeNumber !== 'function') {
      window.safeNumber = function (v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };
    }

    if (typeof window.fetchJson !== 'function') {
      window.fetchJson = async function (pathOrUrl, opts) {
        let url;
        if (/^https?:\/\//i.test(pathOrUrl)) {
          // full URL provided
          url = pathOrUrl;
        } else if (pathOrUrl.startsWith('/api')) {
          // caller already provided /api/... — attach to host origin (prevent /api/api)
          url = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : ':3000') + pathOrUrl;
        } else if (pathOrUrl.startsWith('/')) {
          // path like /inventory -> attach to API_BASE
          url = window.API_BASE + pathOrUrl;
        } else {
          // bare name: inventory -> API_BASE + '/inventory'
          url = window.API_BASE + '/' + pathOrUrl.replace(/^\/+/, '');
        }

        const res = await fetch(url, opts);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error('Fetch error', url, res.status, text);
          throw new Error(`Fetch ${url} failed: ${res.status}`);
        }
        return res.json();
      };
    }
  })();

  // ---------- Main DOM logic ----------
  document.addEventListener('DOMContentLoaded', () => {
    // Elements (may be missing on some pages)
    const form = document.getElementById('inventory-form');
    const tbody = document.querySelector('#inventory-table tbody');
    const itemSelectInSales = document.getElementById('itemSold');
    const downloadBtn = document.getElementById('download-expenses');

    // If nothing relevant exists on the page, exit quietly.
    if (!form && !tbody && !itemSelectInSales) {
      // nothing to do here
      return;
    }

    // Inputs that may exist in form
    const qtyEl = document.getElementById('incoming');
    const costEl = document.getElementById('cost');
    const sellingEl = document.getElementById('selling');
    const damagedEl = document.getElementById('damagedGoods');

    // Determine a place to insert dynamic controls
    const insertAfterEl = damagedEl || (form ? form.querySelector('button[type="submit"]') : null) || (form ? form.lastElementChild : null);

    // ----- UI Controls (create only if missing) -----

    // Damaged received checkbox
    let damagedCheckbox = document.getElementById('damagedReceived');
    if (!damagedCheckbox) {
      const wrapper = document.createElement('div');
      wrapper.style.marginTop = '8px';
      wrapper.className = 'damaged-received-wrapper';

      const label = document.createElement('label');
      label.style.display = 'inline-flex';
      label.style.alignItems = 'center';
      label.style.gap = '8px';

      damagedCheckbox = document.createElement('input');
      damagedCheckbox.type = 'checkbox';
      damagedCheckbox.id = 'damagedReceived';
      damagedCheckbox.checked = damagedEl && window.safeNumber(damagedEl.value) > 0;

      const labelText = document.createElement('span');
      labelText.textContent = 'Damaged goods received?';

      label.appendChild(damagedCheckbox);
      label.appendChild(labelText);
      wrapper.appendChild(label);

      if (insertAfterEl && insertAfterEl.parentNode) {
        insertAfterEl.parentNode.insertBefore(wrapper, insertAfterEl.nextSibling);
      } else if (form) {
        form.appendChild(wrapper);
      }
    }

    // Auto-calc Profit/Loss and suggestion
    let autoCalcCheckbox = document.getElementById('autoCalcPL');
    let computedPLSpan = document.getElementById('computedPLSuggestion');
    if (!autoCalcCheckbox) {
      const wrapper = document.createElement('div');
      wrapper.style.marginTop = '8px';
      wrapper.className = 'auto-calc-pl-wrapper';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '12px';

      const label = document.createElement('label');
      label.style.display = 'inline-flex';
      label.style.alignItems = 'center';
      label.style.gap = '8px';

      autoCalcCheckbox = document.createElement('input');
      autoCalcCheckbox.type = 'checkbox';
      autoCalcCheckbox.id = 'autoCalcPL';
      autoCalcCheckbox.checked = true;

      const labelText = document.createElement('span');
      labelText.textContent = 'Auto-calc Profit/Loss';

      label.appendChild(autoCalcCheckbox);
      label.appendChild(labelText);

      computedPLSpan = document.createElement('span');
      computedPLSpan.id = 'computedPLSuggestion';
      computedPLSpan.style.fontWeight = '600';
      computedPLSpan.textContent = 'Suggested: Ksh 0.00';

      wrapper.appendChild(label);
      wrapper.appendChild(computedPLSpan);

      if (insertAfterEl && insertAfterEl.parentNode) {
        insertAfterEl.parentNode.insertBefore(wrapper, insertAfterEl.nextSibling);
      } else if (form) {
        form.appendChild(wrapper);
      }
    }

    // Profit/Loss input
    let profitLossInput = document.getElementById('profitLossStock');
    if (!profitLossInput) {
      profitLossInput = document.createElement('input');
      profitLossInput.type = 'number';
      profitLossInput.step = '0.01';
      profitLossInput.id = 'profitLossStock';
      profitLossInput.name = 'profit_loss_stock';
      profitLossInput.placeholder = 'Profit/Loss of Stock';
      profitLossInput.style.marginTop = '8px';
      profitLossInput.style.display = 'block';
      profitLossInput.value = '0.00';
      if (insertAfterEl && insertAfterEl.parentNode) {
        insertAfterEl.parentNode.insertBefore(profitLossInput, insertAfterEl.nextSibling);
      } else if (form) {
        form.appendChild(profitLossInput);
      }
    }

    // Ensure damaged input exists
    let damagedInput = document.getElementById('damagedGoods');
    if (!damagedInput) {
      damagedInput = document.createElement('input');
      damagedInput.type = 'number';
      damagedInput.id = 'damagedGoods';
      damagedInput.name = 'damaged';
      damagedInput.placeholder = 'Damaged Goods';
      damagedInput.min = '0';
      damagedInput.step = '1';
      damagedInput.style.marginTop = '8px';
      if (insertAfterEl && insertAfterEl.parentNode) {
        insertAfterEl.parentNode.insertBefore(damagedInput, insertAfterEl.nextSibling);
      } else if (form) {
        form.appendChild(damagedInput);
      }
    }

    // ----- Computation helpers -----
    function computeSuggestedPL() {
      const qty = window.safeNumber(qtyEl?.value);
      const cost = window.safeNumber(costEl?.value);
      const selling = window.safeNumber(sellingEl?.value);
      const damagedCount = window.safeNumber(damagedInput?.value);

      const damagedLoss = damagedCount * cost;
      const potentialProfit = (selling - cost) * qty;
      const computed = potentialProfit - damagedLoss;
      return { computed, damagedLoss, potentialProfit };
    }

    function refreshComputedUI() {
      const { computed } = computeSuggestedPL();
      if (computedPLSpan) computedPLSpan.textContent = `Suggested: Ksh ${computed.toFixed(2)}`;

      if (autoCalcCheckbox && profitLossInput) {
        if (autoCalcCheckbox.checked) {
          profitLossInput.value = computed.toFixed(2);
          profitLossInput.setAttribute('disabled', 'disabled');
          profitLossInput.style.opacity = '0.7';
        } else {
          profitLossInput.removeAttribute('disabled');
          profitLossInput.style.opacity = '1';
        }
      }
    }

    function refreshDamagedUI() {
      if (!damagedInput) return;
      if (damagedCheckbox && damagedCheckbox.checked) {
        damagedInput.removeAttribute('disabled');
        damagedInput.style.opacity = '1';
      } else {
        damagedInput.value = '0';
        damagedInput.setAttribute('disabled', 'disabled');
        damagedInput.style.opacity = '0.6';
      }
      refreshComputedUI();
    }

    // Initial UI sync
    refreshDamagedUI();
    refreshComputedUI();

    // Event listeners for inputs
    [qtyEl, costEl, sellingEl, damagedInput].forEach(el => {
      if (!el) return;
      el.addEventListener('input', () => {
        if (el === damagedInput && window.safeNumber(damagedInput.value) > 0 && damagedCheckbox) {
          damagedCheckbox.checked = true;
        }
        refreshComputedUI();
      });
    });

    if (autoCalcCheckbox) autoCalcCheckbox.addEventListener('change', refreshComputedUI);
    if (damagedCheckbox) damagedCheckbox.addEventListener('change', refreshDamagedUI);
    if (profitLossInput) {
      profitLossInput.addEventListener('input', () => {
        if (autoCalcCheckbox && autoCalcCheckbox.checked) {
          autoCalcCheckbox.checked = false;
          refreshComputedUI();
        }
      });
    }

    // ----- Table rendering -----
    function appendInventoryRow(item) {
      if (!tbody) return;
      const row = document.createElement('tr');
      row.dataset.id = item.id || '';

      const quantity = Number(item.quantity || 0);
      const cost = Number(item.cost_price || item.cost || 0);
      const selling = Number(item.selling_price || item.selling || 0);
      const damaged = Number(item.damaged ?? item.damagedGoods ?? 0);

      const damagedLoss = damaged * cost;
      const potentialProfit = (selling - cost) * quantity;
      const profitLoss = (typeof item.profit_loss_stock !== 'undefined')
        ? Number(item.profit_loss_stock || 0)
        : (potentialProfit - damagedLoss);

      row.innerHTML = `
        <td>${item.enterprise_name || ''}</td>
        <td>${item.start_date || item.date_added || ''}</td>
        <td>${item.registered || ''}</td>
        <td>${item.item_name || ''}</td>
        <td>${quantity}</td>
        <td>${cost.toFixed(2)}</td>
        <td>${selling.toFixed(2)}</td>
        <td>${item.weekly_stock_target || 0}</td>
        <td>${item.monthly_stock_target || 0}</td>
        <td style="color:${profitLoss < 0 ? 'red' : 'green'}">${profitLoss.toFixed(2)}</td>
        <td>${damaged}</td>
      `;
      tbody.appendChild(row);
    }

    // ----- Data loading -----
    async function loadInventoryIntoTableAndSelect() {
      try {
        const items = await window.fetchJson('/inventory'); // relies on utils.js or safe fallback
        if (tbody) tbody.innerHTML = '';
        (items || []).forEach(appendInventoryRow);
        populateItemsSelect(items || []);
      } catch (err) {
        console.error('Failed to load inventory', err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="11">(failed to load inventory)</td></tr>';
      }
    }

    function populateItemsSelect(items = []) {
      if (!itemSelectInSales) return;
      itemSelectInSales.innerHTML = '<option value="">Select item</option>';
      items.forEach(it => {
        const opt = document.createElement('option');
        opt.value = it.item_name;
        opt.textContent = `${it.item_name} — in stock: ${it.quantity ?? 0}`;
        opt.dataset.id = it.id;
        opt.dataset.quantity = it.quantity || 0;
        opt.dataset.selling_price = it.selling_price || it.selling || 0;
        itemSelectInSales.appendChild(opt);
      });
    }

    function hasDuplicateItem(name) {
      if (!tbody) return false;
      const rows = tbody.querySelectorAll('tr');
      for (let r of rows) {
        if ((r.cells[3].textContent || '').toLowerCase() === (name || '').toLowerCase()) return true;
      }
      return false;
    }

    // ----- Form submission -----
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemNameEl = document.getElementById('item');
        const item_name = itemNameEl ? itemNameEl.value.trim() : '';
        if (!item_name) { alert('Enter item'); return; }
        if (hasDuplicateItem(item_name)) { alert('Duplicate item'); return; }

        const quantity = +document.getElementById('incoming').value || 0;
        const cost_price = +document.getElementById('cost').value || 0;
        const selling_price = +document.getElementById('selling').value || 0;
        const damaged = damagedInput ? +damagedInput.value || 0 : 0;

        let profit_loss_stock;
        if (autoCalcCheckbox && autoCalcCheckbox.checked) {
          const { computed } = computeSuggestedPL();
          profit_loss_stock = Number(computed);
        } else {
          profit_loss_stock = Number(profitLossInput.value) || 0;
        }

        const body = {
          item_name,
          quantity,
          cost_price,
          selling_price,
          damaged,
          profit_loss_stock,
          enterprise_name: document.getElementById('enterprise') ? document.getElementById('enterprise').value : null,
          start_date: document.getElementById('enterpriseStartDate') ? document.getElementById('enterpriseStartDate').value : null,
          registered: document.getElementById('registered') ? document.getElementById('registered').value : null,
          weekly_stock_target: +document.getElementById('weeklyStockTarget').value || 0,
          monthly_stock_target: +document.getElementById('monthlyStockTarget').value || 0
        };

        try {
          const res = await window.fetchJson('/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          // server should return created id
          const created = Object.assign({}, body, { id: res.id });
          appendInventoryRow(created);
          form.reset();
          autoCalcCheckbox.checked = true;
          if (damagedCheckbox) damagedCheckbox.checked = false;
          refreshDamagedUI();
          refreshComputedUI();

          await loadInventoryIntoTableAndSelect();
          if (window.reloadReports) window.reloadReports();
        } catch (err) {
          console.error('Failed to add inventory', err);
          alert('Failed to add inventory — check console.');
        }
      });
    }

    // Initial load
    loadInventoryIntoTableAndSelect();

    // Expose for other scripts
    window.reloadInventoryTable = loadInventoryIntoTableAndSelect;

    // Download inventory as Excel
    // Add this code at the end of your DOMContentLoaded event in inventory.js

  // Download inventory as Excel
  const downloadInventoryBtn = document.getElementById('download-inventory');
  if (downloadInventoryBtn) {
    downloadInventoryBtn.addEventListener('click', async () => {
      try {
        const inventory = await window.fetchJson('/inventory');
        if (!Array.isArray(inventory) || inventory.length === 0) {
          alert('No inventory data to export.');
          return;
        }

        // Map to columns we want to export
        const rows = inventory.map(item => ({
          'Enterprise': item.enterprise_name || '',
          'Start Date': item.start_date || '',
          'Registered': item.registered || '',
          'Item Name': item.item_name || '',
          'Quantity': item.quantity || 0,
          'Cost Price': item.cost_price || 0,
          'Selling Price': item.selling_price || 0,
          'Weekly Stock Target': item.weekly_stock_target || 0,
          'Monthly Stock Target': item.monthly_stock_target || 0,
          'Profit/Loss': item.profit_loss_stock || 0,
          'Damaged Goods': item.damaged || 0
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
        XLSX.writeFile(wb, 'inventory_data.xlsx');
      } catch (err) {
        console.error('Failed to export inventory', err);
        alert('Failed to export inventory data. Check console for details.');
      }
    });
  }

  }); // DOMContentLoaded
})();
document.addEventListener('DOMContentLoaded', () => {
  // If you use a global API root, change this; otherwise '/api/inventory' is assumed.
  const API_ENDPOINT = '/api/inventory';

  const form = document.getElementById('inventoryForm');
  const btn = document.getElementById('addInventoryBtn');
  const msg = document.getElementById('message');
  const tableBody = document.querySelector('#inventoryTable tbody');

  if (!form) {
    console.warn('inventoryForm not found in document. Add a form with id="inventoryForm" or change selector.');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessage();

    // collect values
    const formData = {
      name: form.elements['name'].value.trim(),
      sku: form.elements['sku'] ? form.elements['sku'].value.trim() : '',
      quantity: parseInt(form.elements['quantity'].value, 10) || 0,
      cost_price: parseFloat(form.elements['cost_price'].value) || 0,
      selling_price: parseFloat(form.elements['selling_price'].value) || 0,
      date_received: form.elements['date_received'] ? form.elements['date_received'].value : null,
      damaged: form.elements['damaged'] ? !!form.elements['damaged'].checked : false
    };

    // basic validation
    if (!formData.name) {
      showMessage('Please enter an item name.', 'error');
      return;
    }
    if (formData.quantity < 0) {
      showMessage('Quantity cannot be negative.', 'error');
      return;
    }

    // disable submit and show progress
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';

    try {
      // POST to the backend. Adjust URL if your API root differs (e.g. window.API_ROOT + '/inventory')
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        // try to extract error message from response
        let errText = await res.text();
        try { errText = JSON.parse(errText).message || errText; } catch (e) { /* not json */ }
        throw new Error(errText || `Server returned ${res.status}`);
      }

      const created = await res.json(); // expect created object with id, etc.

      // update UI: add to table if present
      if (tableBody) addRowToTable(created);

      form.reset();
      showMessage('Inventory added successfully!', 'success');
      // optional: focus first field again
      form.elements['name'].focus();
    } catch (err) {
      console.error(err);
      showMessage(`Failed to add inventory: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  /* ---------- Helper UI functions ---------- */
  function addRowToTable(item) {
    try {
      const tr = document.createElement('tr');

      // Try to display commonly expected properties; fallback to safe values
      const id = item.id ?? item._id ?? '';
      const name = item.name ?? '';
      const qty = item.quantity ?? item.qty ?? 0;
      const cost = item.cost_price ?? item.cost ?? '';
      const sell = item.selling_price ?? item.sell ?? '';
      const damaged = item.damaged ? 'Yes' : 'No';

      tr.innerHTML = `
        <td>${escapeHtml(id)}</td>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(qty)}</td>
        <td>${escapeHtml(cost)}</td>
        <td>${escapeHtml(sell)}</td>
        <td>${escapeHtml(damaged)}</td>
      `;
      tableBody.prepend(tr); // newest on top
    } catch (e) {
      console.warn('Could not add row to table', e);
    }
  }

  function showMessage(text, type = 'info') {
    if (!msg) {
      // fallback to alert
      if (type === 'error') alert(text);
      else console.log(text);
      return;
    }
    msg.textContent = text;
    msg.className = ''; // reset classes
    msg.classList.add(type === 'error' ? 'msg-error' : type === 'success' ? 'msg-success' : 'msg-info');
  }

  function clearMessage() {
    if (msg) {
      msg.textContent = '';
      msg.className = '';
    }
  }

  function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
