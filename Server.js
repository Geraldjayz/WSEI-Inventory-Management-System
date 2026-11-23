// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { promisePool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// helper to unify error responses
const serverError = (res, err, msg = 'Database error') => {
  console.error(msg, err);
  return res.status(500).json({ error: msg, details: err?.message });
};

/* ---------------- DELETE ROUTES ---------------- */

// Clear all inventory
app.delete('/api/inventory', async (req, res) => {
  console.log('DELETE /api/inventory route hit'); // Add this line for debugging
  try {
    await promisePool.query('DELETE FROM inventory');
    res.json({ success: true, message: 'All inventory records cleared' });
  } catch (err) {
    serverError(res, err, 'DELETE /api/inventory failed');
  }
});

// Clear all sales
app.delete('/api/sales', async (req, res) => {
  console.log('DELETE /api/sales route hit'); // Add this line for debugging
  try {
    await promisePool.query('DELETE FROM sales');
    res.json({ success: true, message: 'All sales records cleared' });
  } catch (err) {
    serverError(res, err, 'DELETE /api/sales failed');
  }
});


// Clear expenses
app.delete('/api/expenses', async (req, res) => {
    console.log('DELETE /api/expenses route hit'); // Add this line for debugging
  try {
    await promisePool.query('DELETE FROM expenses');
    res.json({ success: true, message: 'All expenses records cleared' });
  } catch (err) {
    serverError(res, err, 'DELETE /api/expenses failed');
  }
});

/* ---------------- INVENTORY ---------------- */
app.get('/api/inventory', async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      'SELECT * FROM inventory ORDER BY date_added DESC, id DESC'
    );
    res.json(rows);
  } catch (err) {
    serverError(res, err, 'GET /api/inventory failed');
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const {
      item_name,
      quantity = 0,
      cost_price = 0,
      selling_price = 0,
      damaged = 0,
      profit_loss_stock = 0,
      enterprise_name = null,
      start_date = null,
      registered = null,
      weekly_stock_target = 0,
      monthly_stock_target = 0
    } = req.body;

    if (!item_name) return res.status(400).json({ error: 'item_name required' });

    const [result] = await promisePool.query(
      `INSERT INTO inventory
        (item_name, quantity, cost_price, selling_price, damaged, profit_loss_stock, 
         enterprise_name, start_date, registered, weekly_stock_target, monthly_stock_target)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_name, quantity, cost_price, selling_price, damaged, profit_loss_stock,
       enterprise_name, start_date, registered, weekly_stock_target, monthly_stock_target]
    );

    res.status(201).json({ id: result.insertId, message: 'Inventory added' });
  } catch (err) {
    serverError(res, err, 'POST /api/inventory failed');
  }
});

/* ---------------- SALES ---------------- */
app.get('/api/sales', async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      'SELECT * FROM sales ORDER BY date_of_sale DESC, id DESC'
    );
    res.json(rows);
  } catch (err) {
    serverError(res, err, 'GET /api/sales failed');
  }
});

// Record a sale and decrement inventory quantity transactionally
app.post('/api/sales', async (req, res) => {
  const {
    item_name,
    inventory_id,
    quantity_sold = 0,
    unit_price = 0,
    discounted_price = null,
    total_amount = 0,
    date_of_sale = null,
    payment_method = null,
    enterprise_name = null,
    outgoing = null,
    is_gifted = false
  } = req.body;

  if (!item_name || !inventory_id) {
    return res.status(400).json({ error: 'item_name and inventory_id required' });
  }

  const toDeduct = outgoing ?? quantity_sold;
  if (!toDeduct || Number(toDeduct) <= 0) {
    return res.status(400).json({ error: 'quantity_sold or outgoing must be > 0' });
  }

  let conn;
  try {
    conn = await promisePool.getConnection();
    await conn.beginTransaction();

    // Lock inventory row
    const [rows] = await conn.query('SELECT quantity FROM inventory WHERE id = ? FOR UPDATE', [inventory_id]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const available = Number(rows[0].quantity || 0);
    if (toDeduct > available) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient stock', available });
    }

    // Insert sale
    const insertSql = `
      INSERT INTO sales
        (item_name, inventory_id, quantity_sold, unit_price, discounted_price, total_amount,
         date_of_sale, payment_method, enterprise_name, outgoing, is_gifted, created_at)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURDATE()), ?, ?, ?, ?, NOW())
    `;
    const insertParams = [
      item_name,
      inventory_id,
      toDeduct,
      unit_price,
      discounted_price,
      total_amount,
      date_of_sale,
      payment_method,
      enterprise_name,
      toDeduct,
      is_gifted ? 1 : 0
    ];

    const [insertResult] = await conn.query(insertSql, insertParams);

    // Decrement inventory
    await conn.query('UPDATE inventory SET quantity = GREATEST(0, quantity - ?) WHERE id = ?', [toDeduct, inventory_id]);

    await conn.commit();

    // Get remaining stock
    const [afterRows] = await promisePool.query('SELECT quantity FROM inventory WHERE id = ?', [inventory_id]);
    const remaining = afterRows.length ? Number(afterRows[0].quantity || 0) : null;

    res.status(201).json({ message: 'Sale recorded', id: insertResult.insertId, remaining });
  } catch (err) {
    if (conn) await conn.rollback();
    serverError(res, err, 'POST /api/sales failed');
  } finally {
    if (conn) conn.release();
  }
});


/* ---------------- EXPENSES ---------------- */
app.get('/api/expenses', async (req, res) => {
  try {
    const [rows] = await promisePool.query('SELECT * FROM expenses ORDER BY date_incurred DESC, id DESC');
    res.json(rows);
  } catch (err) {
    serverError(res, err, 'GET /api/expenses failed');
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { expense_name, amount = 0, date_incurred = null, payment_method = null, enterprise_name = null } = req.body;
    if (!expense_name) return res.status(400).json({ error: 'expense_name required' });

    const [result] = await promisePool.query(
      `INSERT INTO expenses (expense_name, amount, date_incurred, payment_method, enterprise_name)
       VALUES (?, ?, ?, ?, ?)`,
      [expense_name, amount, date_incurred, payment_method, enterprise_name]
    );

    res.status(201).json({ id: result.insertId, message: 'Expense recorded' });
  } catch (err) {
    serverError(res, err, 'POST /api/expenses failed');
  }
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
