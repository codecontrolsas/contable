import { clerkSetup } from '@clerk/testing/cypress';
import { defineConfig } from 'cypress';
import {
  cleanupTestDocumentTypes,
  cleanupAllTestData,
  cleanupTestProducts,
  cleanupTestSuppliers,
  cleanupTestSalesInvoices,
  cleanupTestPurchaseInvoices,
  cleanupTestBankAccounts,
  cleanupTestExpenses,
  cleanupTestWarehouses,
  cleanupTestPurchaseOrders,
  cleanupTestReceivingNotes,
  cleanupTestBudgets,
  getTestCompanyId,
  closePool,
} from './cypress/support/db';
import { instanceConfig } from './instance.config';

// Owner user ID - IMPORTANTE: Actualizar según el seed.ts de cada instancia
// Este ID corresponde al usuario owner creado en el seed de desarrollo
const OWNER_USER_ID = 'user_38XttXTm0XNDYKYMkyCUCgSnNjI';

export default defineConfig({
  e2e: {
    baseUrl: `http://localhost:${instanceConfig.ports.app}`,
    async setupNodeEvents(on, config) {
      // Database cleanup tasks
      on('task', {
        async cleanupTestDocumentTypes() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestDocumentTypes(companyId);
          return { deleted };
        },

        async cleanupAllTestData() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { error: 'No company found' };
          const result = await cleanupAllTestData(companyId);
          return result;
        },

        async getTestCompanyId() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          return companyId;
        },

        async cleanupTestProducts() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestProducts(companyId);
          return { deleted };
        },

        async cleanupTestSuppliers() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestSuppliers(companyId);
          return { deleted };
        },

        async cleanupTestSalesInvoices() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestSalesInvoices(companyId);
          return { deleted };
        },

        async cleanupTestPurchaseInvoices() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestPurchaseInvoices(companyId);
          return { deleted };
        },

        async cleanupTestBankAccounts() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestBankAccounts(companyId);
          return { deleted };
        },

        async cleanupTestExpenses() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestExpenses(companyId);
          return { deleted };
        },

        async cleanupTestWarehouses() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestWarehouses(companyId);
          return { deleted };
        },

        async cleanupTestPurchaseOrders() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestPurchaseOrders(companyId);
          return { deleted };
        },

        async cleanupTestReceivingNotes() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestReceivingNotes(companyId);
          return { deleted };
        },

        async cleanupTestBudgets() {
          const companyId = await getTestCompanyId(OWNER_USER_ID);
          if (!companyId) return { deleted: 0, error: 'No company found' };
          const deleted = await cleanupTestBudgets(companyId);
          return { deleted };
        },
      });

      // Close pool on exit
      on('after:run', async () => {
        await closePool();
      });

      return clerkSetup({ config });
    },
    // Timeouts
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    // Viewport
    viewportWidth: 1920,
    viewportHeight: 1080,
    // Videos and screenshots
    video: false,
    screenshotOnRunFailure: true,
    // Retries
    // retries: {
    //   runMode: 2,
    //   openMode: 0,
    // },
  },
  env: {
    // These will be overridden by cypress.env.json or CLI
    test_user: 'fspiritosi+clerk_test@codecontrol.com.ar',
    test_password: '@Dembe1412',
  },
});
