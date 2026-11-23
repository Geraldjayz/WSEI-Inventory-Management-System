// data.js (non-module version)
// Expose arrays and helpers on window to avoid 'export' syntax errors

window.APP_DATA = window.APP_DATA || {
  salesData: [],
  expensesData: [],
  inventoryData: []
};

window.APP_DATA.addSale = function(item, quantity, unitPrice, date, paymentMethod) {
  this.salesData.push({
    item,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
    date,
    paymentMethod
  });
};

window.APP_DATA.addExpense = function(category, amount, date) {
  this.expensesData.push({ category, amount, date });
};

window.APP_DATA.addInventory = function(item, incoming, damaged, credit, gifted, cost, selling, date) {
  this.inventoryData.push({
    item,
    incoming,
    damaged,
    credit,
    gifted,
    available: incoming - (damaged + credit + gifted),
    cost,
    selling,
    date
  });
};
