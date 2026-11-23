CREATE DATABASE IF NOT EXISTS business_tracker;
USE business_tracker;

-- INVENTORY TABLE
CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL,
  quantity INT DEFAULT 0,
  cost_price DECIMAL(10,2) DEFAULT 0,
  selling_price DECIMAL(10,2) DEFAULT 0,
  gifted INT DEFAULT 0,
  payment_date DATE DEFAULT NULL,
  sale_month VARCHAR(20) DEFAULT NULL,
  enterprise_name VARCHAR(100) DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  registered ENUM('Yes','No') DEFAULT NULL,
  weekly_stock_target INT DEFAULT 0,
  monthly_stock_target INT DEFAULT 0,
  profit_loss_stock DECIMAL(10,2) DEFAULT 0,
  damaged INT DEFAULT 0,
  date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SALES TABLE
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL,
  inventory_id INT NOT NULL,
  quantity_sold INT NOT NULL,
  unit_price DECIMAL(10,2) DEFAULT 0,
  discounted_price DECIMAL(10,2) DEFAULT NULL,
  total_amount DECIMAL(10,2) DEFAULT 0,
  date_of_sale DATE DEFAULT NULL,
  payment_method VARCHAR(50) DEFAULT NULL,
  enterprise_name VARCHAR(100) DEFAULT NULL,
  outgoing INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
);

-- EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_name VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0,
  date_incurred DATE DEFAULT NULL,
  payment_method VARCHAR(50) DEFAULT NULL,
  enterprise_name VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
