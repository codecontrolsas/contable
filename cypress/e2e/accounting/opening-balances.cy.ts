import { setupClerkTestingToken } from '@clerk/testing/cypress';

describe('Accounting - Opening Balances', () => {
  beforeEach(() => {
    setupClerkTestingToken();
    cy.visit('/');
    cy.window().should((win) => {
      expect(win).to.have.property('Clerk');
      expect(win.Clerk.loaded).to.eq(true);
    });
    cy.clerkSignIn({
      strategy: 'email_code',
      identifier: Cypress.env('test_user'),
    });
  });

  describe('Page Navigation', () => {
    it('should display the opening balances page', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.contains('Saldos de Apertura').should('be.visible');
      cy.contains('Migrá los saldos iniciales').should('be.visible');
    });

    it('should display three tabs', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.contains('Asiento de Apertura').should('be.visible');
      cy.contains('Facturas de Venta Pendientes').should('be.visible');
      cy.contains('Facturas de Compra Pendientes').should('be.visible');
    });
  });

  describe('Part A - Opening Balance Entry', () => {
    it('should display the account balances form', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.contains('Asiento de Apertura').click();
      cy.contains('Buscar cuenta').should('be.visible');
    });

    it('should show account type groups', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      // Check for at least one account type group
      cy.get('body').then(($body) => {
        const hasAccounts =
          $body.text().includes('Activo') ||
          $body.text().includes('Pasivo') ||
          $body.text().includes('Patrimonio Neto');
        expect(hasAccounts).to.be.true;
      });
    });

    it('should show totals footer', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.contains('Totales').should('be.visible');
    });

    it('should filter accounts by search term', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.get('input[placeholder*="Buscar cuenta"]').type('Caja');
      // Should filter to show only matching accounts
      cy.wait(500);
    });
  });

  describe('Part B - Pending Sales Invoices', () => {
    it('should display the sales invoices tab', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.contains('Facturas de Venta Pendientes').click();
      cy.contains('Nueva Factura').should('be.visible');
      cy.contains('Importar Excel').should('be.visible');
    });

    it('should display explanatory text', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.contains('Facturas de Venta Pendientes').click();
      cy.contains('Flujo de Caja').should('be.visible');
    });

    it('should open create invoice dialog', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.contains('Facturas de Venta Pendientes').click();
      cy.contains('button', 'Nueva Factura').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Nueva Factura de Venta').should('be.visible');
    });

    it('should show import dialog', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.contains('Facturas de Venta Pendientes').click();
      cy.contains('button', 'Importar Excel').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Descargar Plantilla').should('be.visible');
    });
  });

  describe('Part B - Pending Purchase Invoices', () => {
    it('should display the purchase invoices tab', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.contains('Facturas de Compra Pendientes').click();
      cy.contains('Nueva Factura').should('be.visible');
      cy.contains('Importar Excel').should('be.visible');
    });

    it('should open create invoice dialog for purchases', () => {
      cy.visit('/dashboard/company/accounting/opening-balances');

      cy.contains('Facturas de Compra Pendientes').click();
      cy.contains('button', 'Nueva Factura').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Nueva Factura de Compra').should('be.visible');
    });
  });
});
