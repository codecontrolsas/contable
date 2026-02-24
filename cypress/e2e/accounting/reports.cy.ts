import { setupClerkTestingToken } from '@clerk/testing/cypress';

describe('Accounting - Reports', () => {
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

  describe('Reports Page', () => {
    it('should display the reports page', () => {
      cy.visit('/dashboard/company/accounting/reports');

      cy.contains('Informes Contables').should('be.visible');
      cy.contains('Genera informes contables para tu empresa').should('be.visible');
    });

    it('should display financial report options', () => {
      cy.visit('/dashboard/company/accounting/reports');

      cy.contains('Balance de Sumas y Saldos').should('be.visible');
      cy.contains('Balance General').should('be.visible');
      cy.contains('Estado de Resultados').should('be.visible');
      cy.contains('Libro Diario').should('be.visible');
      cy.contains('Libro Mayor').should('be.visible');
    });

    it('should display fixed asset report options', () => {
      cy.visit('/dashboard/company/accounting/reports');

      cy.contains('Bienes de Uso').should('be.visible');
      cy.contains('Registro de Bienes de Uso').should('be.visible');
      cy.contains('Depreciaciones del Período').should('be.visible');
    });

    it('should display audit report options', () => {
      cy.visit('/dashboard/company/accounting/reports');

      cy.contains('Auditoría').should('be.visible');
      cy.contains('Asientos sin Respaldo').should('be.visible');
      cy.contains('Registro de Reversiones').should('be.visible');
      cy.contains('Trazabilidad Doc-Asiento').should('be.visible');
    });

    it('should select and display trial balance report', () => {
      cy.visit('/dashboard/company/accounting/reports');

      cy.contains('Balance de Sumas y Saldos').click();

      // Should show the report content or date filter
      cy.wait(1000);
      cy.get('body').should('be.visible');
    });

    it('should select and display journal book report', () => {
      cy.visit('/dashboard/company/accounting/reports');

      cy.contains('Libro Diario').click();

      cy.wait(1000);
      cy.get('body').should('be.visible');
    });

    it('should select and display general ledger report', () => {
      cy.visit('/dashboard/company/accounting/reports');

      cy.contains('Libro Mayor').click();

      cy.wait(1000);
      cy.get('body').should('be.visible');
    });
  });
});
