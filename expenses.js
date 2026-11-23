// public/js/expenses.js
// Depends on: window.fetchJson, window.API_ROOT (from utils.js).
// Safe: will still log errors if utils.js is not present, but include utils.js for best behavior.

document.addEventListener('DOMContentLoaded', () => {
  // Elements (may be absent on some pages)
  const form = document.getElementById('expenses-form');
  const tableBody = document.querySelector('#expenses-table tbody');
  const downloadBtn = document.getElementById('download-expenses');
  const clearBtn = document.getElementById('clear-expenses');

  // Ensure fetchJson fallback (minimal) if utils.js wasn't loaded.
  if (typeof window.fetchJson !== 'function') {
    window.fetchJson = async function (pathOrUrl, opts) {
      const base = (window.API_ROOT) ? window.API_ROOT : (location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : ':3000') + '/api');
      const url = (/^https?:\/\//i.test(pathOrUrl)) ? pathOrUrl : (pathOrUrl.startsWith('/') ? base + pathOrUrl : base + '/' + pathOrUrl.replace(/^\/+/, ''));
      const res = await fetch(url, opts);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Fetch error', url, res.status, text);
        throw new Error(`Fetch ${url} failed: ${res.status}`);
      }
      return res.json();
    };
  }

  // Load expenses and render into table (if table exists)
  async function loadExpenses() {
    try {
      // fetchJson resolves to API_ROOT + '/expenses'
      const expenses = await window.fetchJson('/expenses');
      if (!Array.isArray(expenses)) {
        console.warn('Expenses response is not an array:', expenses);
      }

      if (tableBody) {
        tableBody.innerHTML = '';
        (expenses || []).forEach(exp => {
          const tr = document.createElement('tr');

          // Normalize fields gracefully
          const name = exp.expense_name ?? exp.name ?? '';
          const amount = Number(exp.amount ?? 0).toFixed(2);
          const date = exp.date_incurred ?? exp.date ?? '';
          const payment = exp.payment_method ?? exp.paymentMethod ?? '';

          tr.innerHTML = `
            <td>${name}</td>
            <td>Ksh ${amount}</td>
            <td>${date}</td>
            <td>${payment}</td>
          `;
          tableBody.appendChild(tr);
        });

        if ((expenses || []).length === 0) {
          tableBody.innerHTML = '<tr><td colspan="4">(no expenses)</td></tr>';
        }
      } else {
        // If there's no table, still log result for debugging
        console.log('Expenses loaded (no table present):', expenses);
      }
    } catch (err) {
      console.error('Failed to load expenses', err);
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="4">(failed to load expenses)</td></tr>';
    }
  }

  // Hook up form submission (if form exists)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const expense_name = (document.getElementById('expenseType')?.value || '').trim();
      const amountVal = document.getElementById('expenseAmount')?.value || '';
      const amount = parseFloat(amountVal);
      const date_incurred = document.getElementById('expenseDate')?.value || new Date().toISOString().slice(0,10);
      const payment_method = document.getElementById('expensePaymentMethod')?.value || '';
      const enterprise_name = document.getElementById('expenseEnterprise')?.value || null;

      if (!expense_name || Number.isNaN(amount)) {
        alert('Enter expense name and valid amount.');
        return;
      }

      try {
        await window.fetchJson('/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expense_name, amount, date_incurred, payment_method, enterprise_name })
        });

        // refresh table and reports
        await loadExpenses();
        form.reset();
        if (window.reloadReports) window.reloadReports();
      } catch (err) {
        console.error('Failed to add expense', err);
        alert('Failed to add expense — check console for details.');
      }
    });
  }

  // Download expenses as Excel
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      try {
        const expenses = await window.fetchJson('/expenses');
        if (!Array.isArray(expenses) || expenses.length === 0) {
          alert('No expenses to export.');
          return;
        }

        // Map to columns we want to export
        const rows = expenses.map(exp => ({
          expense_name: exp.expense_name ?? exp.name ?? '',
          amount: Number(exp.amount ?? 0).toFixed(2),
          date_incurred: exp.date_incurred ?? exp.date ?? '',
          payment_method: exp.payment_method ?? exp.paymentMethod ?? '',
          enterprise_name: exp.enterprise_name ?? ''
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        XLSX.writeFile(wb, 'expenses.xlsx');
      } catch (err) {
        console.error('Failed to export expenses', err);
        alert('Failed to export expenses — see console for details.');
      }
    });
  }

  // Clear expenses (UI + backend). Confirm before destructive action.
/*   if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!confirm('This will delete ALL expenses from the database. Are you sure?')) return;
      try {
        await window.fetchJson('/expenses', { method: 'DELETE' });
        // update UI
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="4">(no expenses)</td></tr>';
        if (window.reloadReports) window.reloadReports();
        alert('All expenses cleared.');
      } catch (err) {
        console.error('Failed to clear expenses', err);
        alert('Failed to clear expenses — see console for details.');
      }
    });
  } */

  // Initial load (run even if form absent)
  loadExpenses();
});
