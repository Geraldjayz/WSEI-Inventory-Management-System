// public/app.js
// Add fallback helpers at the beginning

(function setupHelpers() {
  if (typeof window.API_ROOT === 'undefined') {
    const DEFAULT_LOCAL_PORT = 3000;
    const BASE = (location.protocol.startsWith('http') && location.hostname === 'localhost' && location.port)
      ? `${location.protocol}//${location.hostname}:${location.port}`
      : `http://localhost:${DEFAULT_LOCAL_PORT}`;
    window.API_ROOT = BASE + '/api';
  }

  if (typeof window.safeNumber !== 'function') {
    window.safeNumber = function (v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
  }

  if (typeof window.fetchJson !== 'function') {
    window.fetchJson = async function (pathOrUrl, opts) {
      const url = (/^https?:\/\//i.test(pathOrUrl))
        ? pathOrUrl
        : (pathOrUrl.startsWith('/') ? (window.API_ROOT + pathOrUrl) : (window.API_ROOT + '/' + pathOrUrl.replace(/^\/+/, '')));
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

document.addEventListener('DOMContentLoaded', () => {
  // ---------------- Excel Export ----------------
  function downloadExcel() {
    const wb = XLSX.utils.book_new();

    const inventoryTable = document.getElementById("inventory-table");
    if (inventoryTable) XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(inventoryTable), "Inventory");

    const salesTable = document.getElementById("sales-table");
    if (salesTable) XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(salesTable), "Sales");

    const expensesTable = document.getElementById("expenses-table");
    if (expensesTable) XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(expensesTable), "Expenses");

    XLSX.writeFile(wb, "Business_Tracker_Data.xlsx");
  }
  window.downloadExcel = downloadExcel;

  // ---------------- Sidebar Navigation ----------------
  const sections = document.querySelectorAll("main > section");
  if (sections.length) {
    sections.forEach(section => section.style.display = "none");
    const inventorySection = document.getElementById("inventorySection");
    if (inventorySection) inventorySection.style.display = "block";
  }

  const sidebarItems = document.querySelectorAll(".sidebar ul li");
  if (sidebarItems && sidebarItems.length) {
    sidebarItems.forEach(item => {
      item.addEventListener("click", function () {
        const sectionId = this.getAttribute("data-section");
        if (!sectionId) return;

        sections.forEach(s => s.style.display = "none");
        const target = document.getElementById(sectionId);
        if (target) target.style.display = "block";

        // Trigger custom event for section change
        window.dispatchEvent(new CustomEvent('sectionChanged', { detail: sectionId }));
      });
    });
  }

  // Set up download button
  const downloadBtn = document.getElementById('downloadExcelBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadExcel);
  }

  // Set up clear buttons (UPDATED TO USE fetchJson)
  const clearInventoryBtn = document.getElementById('clearInventoryBtn');
  if (clearInventoryBtn) {
    clearInventoryBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear ALL inventory data? This action cannot be undone.')) {
        try {
          await fetchJson('/inventory', { method: 'DELETE' });
          alert('Inventory data cleared successfully!');
          // Clear the table and reload inventory
          if (window.reloadInventoryTable) {
            window.reloadInventoryTable();
          }
        } catch (error) {
          console.error('Error clearing inventory:', error);
          alert('Error clearing inventory data.');
        }
      }
    });
  }

  const clearSalesBtn = document.getElementById('clearSalesBtn');
  if (clearSalesBtn) {
    clearSalesBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear ALL sales data? This action cannot be undone.')) {
        try {
          await fetchJson('/sales', { method: 'DELETE' });
          alert('Sales data cleared successfully!');
          // Reload sales data
          if (typeof loadSales === 'function') {
            loadSales();
          }
        } catch (error) {
          console.error('Error clearing sales:', error);
          alert('Error clearing sales data.');
        }
      }
    });
  }

  const clearExpensesBtn = document.getElementById('clear-expenses');
  if (clearExpensesBtn) {
    clearExpensesBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear ALL expenses data? This action cannot be undone.')) {
        try {
          await fetchJson('/expenses', { method: 'DELETE' });
          alert('Expenses data cleared successfully!');
          // Reload expenses data
          if (typeof loadExpenses === 'function') {
            loadExpenses();
          }
        } catch (error) {
          console.error('Error clearing expenses:', error);
          alert('Error clearing expenses data.');
        }
      }
    });
  }

  // ---------------- API Calls ----------------
  async function loadInventory() {
    try {
      // Use fetchJson from utils.js
      const data = await fetchJson("/inventory");
      console.log("Inventory:", data);
    } catch (err) {
      console.error("Error loading inventory:", err);
    }
  }

  // Initial load
  loadInventory();
});