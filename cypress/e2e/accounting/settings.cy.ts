import { setupClerkTestingToken } from '@clerk/testing/cypress';

describe('Accounting - Settings', () => {
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

  describe('Accounting Settings Page', () => {
    it('should display the settings page', () => {
      cy.visit('/dashboard/company/accounting/settings');

      cy.contains('Configuración Contable').should('be.visible');
      cy.contains('Configura los parámetros contables de tu empresa').should('be.visible');
    });

    it('should display fiscal year section', () => {
      cy.visit('/dashboard/company/accounting/settings');

      cy.contains('Ejercicio Fiscal').should('be.visible');
    });

    it('should display commercial integration section', () => {
      cy.visit('/dashboard/company/accounting/settings');

      cy.contains('Integración Comercial').should('be.visible');
      cy.contains('Configura las cuentas contables por defecto').should('be.visible');
    });

    it('should have save buttons for each section', () => {
      cy.visit('/dashboard/company/accounting/settings');

      // Should have at least one save button
      cy.contains('button', 'Guardar').should('exist');
    });
  });

  describe('Period Locking', () => {
    beforeEach(() => {
      cy.visit('/dashboard/company/accounting/settings');
    });

    it('should display the period locking section', () => {
      cy.contains('Bloqueo de Períodos').should('be.visible');
      cy.contains('Bloquea períodos mensuales para evitar modificaciones en asientos contables').should(
        'be.visible'
      );
    });

    it('should display month grid with lock icons', () => {
      // Should show months with lock/unlock icons
      cy.contains('Bloqueo de Períodos')
        .closest('[class*="card"]')
        .within(() => {
          // Check for month cells (at least some should exist)
          cy.get('[class*="rounded-lg"][class*="border"]').should('have.length.gte', 1);
        });
    });

    it('should show confirmation dialog when clicking a month to lock', () => {
      cy.contains('Bloqueo de Períodos')
        .closest('[class*="card"]')
        .within(() => {
          // Click the first clickable button (first unlocked month)
          cy.get('button').first().click();
        });

      // Confirmation dialog should appear
      cy.get('[role="alertdialog"]').should('be.visible');
      cy.get('[role="alertdialog"]').within(() => {
        cy.contains('Bloquear').should('be.visible');
        cy.contains('Cancelar').should('be.visible');
      });
    });

    it('should close dialog when clicking cancel', () => {
      cy.contains('Bloqueo de Períodos')
        .closest('[class*="card"]')
        .within(() => {
          cy.get('button').first().click();
        });

      cy.get('[role="alertdialog"]').within(() => {
        cy.contains('Cancelar').click();
      });

      cy.get('[role="alertdialog"]').should('not.exist');
    });
  });
});
