/**
 * Database utilities for Cypress tests
 * These functions are used to clean up test data after tests run
 */

import pg from 'pg';

const { Pool } = pg;

// Create a pool connection - will be initialized lazily
let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

/**
 * Clean up test document types created during tests
 * Deletes document types that start with "Test" or contain timestamp patterns
 */
export async function cleanupTestDocumentTypes(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `DELETE FROM document_types
       WHERE company_id = $1
       AND (name LIKE 'Test %' OR name LIKE '%Doc Type%' OR name LIKE 'Expiring Doc%' OR name LIKE 'Monthly Doc%')
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test employee documents
 */
export async function cleanupTestEmployeeDocuments(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `DELETE FROM employee_documents
       WHERE employee_id IN (
         SELECT id FROM employees WHERE company_id = $1
       )
       AND rejection_reason LIKE '%test%'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test equipment documents
 */
export async function cleanupTestEquipmentDocuments(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `DELETE FROM equipment_documents
       WHERE vehicle_id IN (
         SELECT id FROM vehicles WHERE company_id = $1
       )
       AND rejection_reason LIKE '%test%'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test company documents
 */
export async function cleanupTestCompanyDocuments(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `DELETE FROM company_documents
       WHERE company_id = $1
       AND rejection_reason LIKE '%test%'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Get the company ID for the test user
 */
export async function getTestCompanyId(userId: string): Promise<string | null> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT up.active_company_id
       FROM user_preferences up
       WHERE up.user_id = $1`,
      [userId]
    );
    return result.rows[0]?.active_company_id || null;
  } finally {
    client.release();
  }
}

/**
 * Clean up test products
 */
export async function cleanupTestProducts(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query(
      `DELETE FROM warehouse_stocks
       WHERE product_id IN (
         SELECT id FROM products WHERE company_id = $1 AND (name LIKE 'Test %' OR name LIKE 'Updated Product%')
       )`,
      [companyId]
    );
    const result = await client.query(
      `DELETE FROM products
       WHERE company_id = $1
       AND (name LIKE 'Test %' OR name LIKE 'Updated Product%')
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test suppliers
 */
export async function cleanupTestSuppliers(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `DELETE FROM suppliers
       WHERE company_id = $1
       AND (business_name LIKE 'Test %' OR business_name LIKE 'Updated Supplier%')
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test sales invoices
 */
export async function cleanupTestSalesInvoices(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query(
      `DELETE FROM sales_invoice_items
       WHERE sales_invoice_id IN (
         SELECT id FROM sales_invoices WHERE company_id = $1 AND notes LIKE '%test E2E%'
       )`,
      [companyId]
    );
    const result = await client.query(
      `DELETE FROM sales_invoices
       WHERE company_id = $1
       AND notes LIKE '%test E2E%'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test purchase invoices
 */
export async function cleanupTestPurchaseInvoices(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query(
      `DELETE FROM purchase_invoice_items
       WHERE purchase_invoice_id IN (
         SELECT id FROM purchase_invoices WHERE company_id = $1 AND notes LIKE '%test E2E%'
       )`,
      [companyId]
    );
    const result = await client.query(
      `DELETE FROM purchase_invoices
       WHERE company_id = $1
       AND notes LIKE '%test E2E%'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test bank accounts
 */
export async function cleanupTestBankAccounts(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query(
      `DELETE FROM bank_movements
       WHERE bank_account_id IN (
         SELECT id FROM bank_accounts WHERE company_id = $1 AND name LIKE 'Test %'
       )`,
      [companyId]
    );
    const result = await client.query(
      `DELETE FROM bank_accounts
       WHERE company_id = $1
       AND name LIKE 'Test %'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test expenses
 */
export async function cleanupTestExpenses(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `DELETE FROM expenses
       WHERE company_id = $1
       AND description LIKE '%test E2E%'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test warehouses
 */
export async function cleanupTestWarehouses(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `DELETE FROM warehouses
       WHERE company_id = $1
       AND name LIKE 'Test %'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test purchase orders
 */
export async function cleanupTestPurchaseOrders(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query(
      `DELETE FROM purchase_order_installments
       WHERE order_id IN (
         SELECT id FROM purchase_orders WHERE company_id = $1 AND notes LIKE '%test E2E%'
       )`,
      [companyId]
    );
    await client.query(
      `DELETE FROM purchase_order_lines
       WHERE order_id IN (
         SELECT id FROM purchase_orders WHERE company_id = $1 AND notes LIKE '%test E2E%'
       )`,
      [companyId]
    );
    const result = await client.query(
      `DELETE FROM purchase_orders
       WHERE company_id = $1
       AND notes LIKE '%test E2E%'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test receiving notes
 */
export async function cleanupTestReceivingNotes(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query(
      `DELETE FROM receiving_note_lines
       WHERE receiving_note_id IN (
         SELECT id FROM receiving_notes WHERE company_id = $1 AND notes LIKE '%test E2E%'
       )`,
      [companyId]
    );
    const result = await client.query(
      `DELETE FROM receiving_notes
       WHERE company_id = $1
       AND notes LIKE '%test E2E%'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up test budgets and their revisions
 * Deletes budgets created during tests (those with notes containing 'test E2E' pattern
 * or with very small amounts typical of test data)
 */
export async function cleanupTestBudgets(companyId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    // First delete revisions for test budgets
    await client.query(
      `DELETE FROM budget_revisions
       WHERE budget_id IN (
         SELECT id FROM budgets WHERE company_id = $1 AND notes LIKE '%test E2E%'
       )`,
      [companyId]
    );
    // Then delete the budgets themselves
    const result = await client.query(
      `DELETE FROM budgets
       WHERE company_id = $1
       AND notes LIKE '%test E2E%'
       RETURNING id`,
      [companyId]
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Clean up all test data for a company
 */
export async function cleanupAllTestData(companyId: string): Promise<{
  documentTypes: number;
  employeeDocs: number;
  equipmentDocs: number;
  companyDocs: number;
}> {
  const documentTypes = await cleanupTestDocumentTypes(companyId);
  const employeeDocs = await cleanupTestEmployeeDocuments(companyId);
  const equipmentDocs = await cleanupTestEquipmentDocuments(companyId);
  const companyDocs = await cleanupTestCompanyDocuments(companyId);

  return {
    documentTypes,
    employeeDocs,
    equipmentDocs,
    companyDocs,
  };
}

/**
 * Close the database pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
