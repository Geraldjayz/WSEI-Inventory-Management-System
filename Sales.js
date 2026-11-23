// public/js/sales.js
// Sales form + table behaviour.
// - Uses window.fetchJson and window.safeNumber from utils.js if available.
// - Computes unit price / total, supports "useInventoryPrice" and "isGifted" flags.
// - Posts to /api/sales with inventory_id, outgoing, and is_gifted.

document.addEventListener('DOMContentLoaded', () => {
  // elements
  const salesForm = document.getElementById('sales-form');
  const itemSelect = document.getElementById('itemSold');
  const qtyInput = document.getElementById('quantitySold');
  const useInventoryPriceCheckbox = document.getElementById('useInventoryPrice');
  const unitPriceInput = document.getElementById('unitPrice');
  const discountInput = document.getElementById('discountedPrice');
  const totalPriceInput = document.getElementById('totalPrice');
  const outgoingInput = document.getElementById('outgoing');
  const saleDateInput = document.getElementById('saleDate');
  const paymentMethodSelect = document.getElementById('salePaymentMethod');
  const isGiftedCheckbox = document.getElementById('isGifted');
  const salesTbody = document.querySelector('#sales-table tbody');
  const clearSalesBtn = document.getElementById('clearSalesBtn');
  const downloadBtn = document.getElementById('download-sales');

  // safe helpers
  const safeNumber = window.safeNumber || function (v) { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const fetchJson = window.fetchJson || (async (p, o) => {
    const base = (window.API_BASE) ? window.API_BASE : (location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : ':3000') + '/api');
    const url = (/^https?:\/\//i.test(p)) ? p : (p.startsWith('/') ? base + p : base + '/' + p.replace(/^\/+/, ''));
    const res = await fetch(url, o);
    if (!res.ok) {
      const t = await res.text().catch(()=>''); throw new Error(`Fetch ${url} failed: ${res.status} ${t}`);
    }
    return res.json();
  });

  // compute unit price preference:
  // - if discounted price supplied (>0) use it
  // - else if useInventoryPrice checked, use dataset.selling_price of selected option
  // - else use unitPriceInput value
  function computeUnitPrice() {
    const disc = safeNumber(discountInput?.value);
    if (disc > 0) return disc;
    if (useInventoryPriceCheckbox && useInventoryPriceCheckbox.checked && itemSelect && itemSelect.selectedIndex > -1) {
      const opt = itemSelect.options[itemSelect.selectedIndex];
      const invPrice = safeNumber(opt?.dataset?.selling_price);
      if (invPrice > 0) return invPrice;
    }
    return safeNumber(unitPriceInput?.value);
  }

  function computeTotal() {
    const qty = safeNumber(qtyInput?.value);
    const unit = computeUnitPrice();
    const total = qty * unit;
    return total;
  }

  function refreshTotalUI() {
    if (!totalPriceInput) return;
    // If sale is marked gifted, show 0.00
    if (isGiftedCheckbox && isGiftedCheckbox.checked) {
      totalPriceInput.value = '0.00';
      return;
    }
    const total = computeTotal();
    totalPriceInput.value = Number(total).toFixed(2);
  }

  // When Use Inventory Price toggled, set/disable unit price input appropriately
  function refreshUnitPriceControl() {
    if (!unitPriceInput) return;
    if (useInventoryPriceCheckbox && useInventoryPriceCheckbox.checked) {
      // populate with selected option price (if any) and disable editing
      if (itemSelect && itemSelect.selectedIndex > -1) {
        const opt = itemSelect.options[itemSelect.selectedIndex];
        unitPriceInput.value = Number(opt?.dataset?.selling_price || 0).toFixed(2);
      }
      unitPriceInput.setAttribute('disabled', 'disabled');
      unitPriceInput.style.opacity = '0.7';
    } else {
      unitPriceInput.removeAttribute('disabled');
      unitPriceInput.style.opacity = '1';
    }
  }

  // Populate select with inventory
  async function loadInventoryIntoSelect() {
    if (!itemSelect) return;
    try {
      const items = await fetchJson('/inventory');
      itemSelect.innerHTML = '<option value="">Select item</option>';
      items.forEach(it => {
        const opt = document.createElement('option');
        opt.textContent = `${it.item_name} — in stock: ${it.quantity ?? 0}`;
        opt.value = it.item_name;
        opt.dataset.id = it.id;
        opt.dataset.quantity = it.quantity ?? 0;
        opt.dataset.selling_price = it.selling_price ?? it.selling ?? it.unit_price ?? 0;
        itemSelect.appendChild(opt);
      });
      // refresh UI with new selection defaults
      refreshUnitPriceControl();
      refreshTotalUI();
    } catch (err) {
      console.error('Failed to load inventory for sales select', err);
      itemSelect.innerHTML = '<option value="">(failed to load inventory)</option>';
    }
  }

  // Render sales table
  async function loadSales() {
    if (!salesTbody) return;
    try {
      const rows = await fetchJson('/sales');
      salesTbody.innerHTML = '';
      (rows || []).forEach(s => {
        const quantity = s.quantity_sold ?? s.quantity ?? 0;
        const unitP = Number(s.unit_price ?? s.unitPrice ?? 0).toFixed(2);
        const discounted = (s.discounted_price ?? s.discountedPrice) ? Number(s.discounted_price ?? s.discountedPrice).toFixed(2) : '';
        const total = Number(s.total_amount ?? s.total ?? 0).toFixed(2);
        const date = s.date_of_sale ? (new Date(s.date_of_sale)).toLocaleDateString() : (s.date ?? '');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(s.item_name)}</td>
          <td>${escapeHtml(quantity)}</td>
          <td>${escapeHtml(unitP)}</td>
          <td>${escapeHtml(discounted)}</td>
          <td>${escapeHtml(total)}</td>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(s.payment_method ?? '')}</td>
          <td>${escapeHtml(s.outgoing ?? '')}</td>
          <td>${s.is_gifted ? 'Yes' : ''}</td>
        `;
        salesTbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Failed to load sales', err);
      salesTbody.innerHTML = '<tr><td colspan="9">(failed to load sales)</td></tr>';
    }
  }

  // basic escape to avoid accidental HTML injection from DB content
  function escapeHtml(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Wire up change listeners
  if (qtyInput) qtyInput.addEventListener('input', refreshTotalUI);
  if (unitPriceInput) unitPriceInput.addEventListener('input', refreshTotalUI);
  if (discountInput) discountInput.addEventListener('input', () => { refreshUnitPriceControl(); refreshTotalUI(); });
  if (itemSelect) itemSelect.addEventListener('change', () => { refreshUnitPriceControl(); refreshTotalUI(); });
  if (useInventoryPriceCheckbox) useInventoryPriceCheckbox.addEventListener('change', () => { refreshUnitPriceControl(); refreshTotalUI(); });
  if (isGiftedCheckbox) isGiftedCheckbox.addEventListener('change', () => { refreshUnitPriceControl(); refreshTotalUI(); });

  // Form submission
  if (salesForm) {
    salesForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validate inputs
      if (!itemSelect || itemSelect.selectedIndex <= 0) { alert('Select an item'); return; }
      const opt = itemSelect.options[itemSelect.selectedIndex];
      const inventoryId = opt?.dataset?.id ? Number(opt.dataset.id) : null;
      if (!inventoryId) { alert('Selected item has no inventory id'); return; }

      const qty = safeNumber(qtyInput?.value);
      const outgoing = safeNumber(outgoingInput?.value) || undefined;
      if (qty <= 0 && (outgoing === undefined || outgoing <= 0)) {
        alert('Enter quantity sold or outgoing > 0');
        return;
      }

      const unit_price = computeUnitPrice();
      const discounted_price = safeNumber(discountInput?.value) || null;
      const is_gifted = !!(isGiftedCheckbox && isGiftedCheckbox.checked);
      // if gifted, recorded revenue should be zero
      const computedTotal = computeTotal();
      const total_amount = is_gifted ? 0 : computedTotal;

      const payload = {
        item_name: itemSelect.value,
        inventory_id: inventoryId,
        quantity_sold: qty,
        unit_price: Number(unit_price),
        discounted_price: discounted_price || null,
        total_amount: Number(total_amount),
        date_of_sale: saleDateInput?.value || null,
        payment_method: paymentMethodSelect?.value || null,
        outgoing: (outgoing !== undefined) ? Number(outgoing) : undefined,
        is_gifted: is_gifted
      };

      try {
        const res = await fetchJson('/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        // success - refresh UI
        await loadSales();
        await loadInventoryIntoSelect(); // reload inventory select to get updated quantities
        // reset form but keep date default
        salesForm.reset();
        // set saleDate to today
        if (saleDateInput) saleDateInput.value = new Date().toISOString().slice(0,10);
        // reset UI controls
        refreshUnitPriceControl();
        refreshTotalUI();

        // optionally show remaining stock if server returned it
        if (res && typeof res.remaining !== 'undefined') {
          alert(`Sale recorded. Remaining stock: ${res.remaining}`);
        } else {
          alert('Sale recorded.');
        }
      } catch (err) {
        console.error('Failed to record sale', err);
        alert('Failed to record sale — check console for details.');
      }
    });
  }

  // Clear sales UI (button) — does not delete server data; if you want server deletion, call DELETE /api/sales
  if (clearSalesBtn) {
    clearSalesBtn.addEventListener('click', () => {
      document.querySelectorAll('#sales-table tbody tr').forEach(r => r.remove());
      // Optionally call the server to delete all sales (uncomment if desired)
      // fetchJson('/sales', { method: 'DELETE' }).then(()=> { loadSales(); });
    });
  }

  // Expose loader for debugging/other scripts
  window.loadSales = loadSales;
  window.loadInventoryIntoSelect = loadInventoryIntoSelect;

  // Initial load
  loadInventoryIntoSelect();
  loadSales();

  // Download sales as Excel
  const downloadSalesBtn = document.getElementById('download-sales');
  if (downloadSalesBtn) {
    downloadSalesBtn.addEventListener('click', async () => {
      try {
        const sales = await fetchJson('/sales');
        if (!Array.isArray(sales) || sales.length === 0) {
          alert('No sales data to export.');
          return;
        }

        // Map to columns we want to export
        const rows = sales.map(sale => ({
          'Item Name': sale.item_name || '',
          'Quantity Sold': sale.quantity_sold || sale.quantity || 0,
          'Unit Price': sale.unit_price || sale.unitPrice || 0,
          'Discounted Price': sale.discounted_price || sale.discountedPrice || 0,
          'Total Amount': sale.total_amount || sale.total || 0,
          'Date of Sale': sale.date_of_sale || sale.date || '',
          'Payment Method': sale.payment_method || '',
          'Outgoing': sale.outgoing || '',
          'Gifted': sale.is_gifted ? 'Yes' : 'No'
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sales');
        XLSX.writeFile(wb, 'sales_data.xlsx');
      } catch (err) {
        console.error('Failed to export sales', err);
        alert('Failed to export sales data. Check console for details.');
      }
    });
  }

    // Add this code at the end of your sales.js file

  // Set sale date default
  if (saleDateInput && !saleDateInput.value) saleDateInput.value = new Date().toISOString().slice(0,10);
});
