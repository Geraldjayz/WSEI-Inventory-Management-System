function downloadExcel() {
  const wb = XLSX.utils.book_new();

  // 📦 Inventory
  const inventoryTable = document.getElementById("inventory-table");
  if (inventoryTable) {
    const inventorySheet = XLSX.utils.table_to_sheet(inventoryTable);
    XLSX.utils.book_append_sheet(wb, inventorySheet, "Inventory");
  }

  // 🛒 Sales (includes Payment Method)
  const salesTable = document.getElementById("sales-table");
  if (salesTable) {
    const salesSheet = XLSX.utils.table_to_sheet(salesTable);
    XLSX.utils.book_append_sheet(wb, salesSheet, "Sales");
  }

  // 💸 Expenses (includes Payment Method)
  const expensesTable = document.getElementById("expenses-table");
  if (expensesTable) {
    const expensesSheet = XLSX.utils.table_to_sheet(expensesTable);
    XLSX.utils.book_append_sheet(wb, expensesSheet, "Expenses");
  }

  // 📥 Export Excel File
  XLSX.writeFile(wb, "Business_Tracker_Data.xlsx");
}

