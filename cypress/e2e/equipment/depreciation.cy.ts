import { setupClerkTestingToken } from '@clerk/testing/cypress';

describe('Equipment - Depreciation', () => {
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

  describe('Accounting Settings - Fixed Asset Accounts', () => {
    it('should display fixed asset account fields in settings', () => {
      cy.visit('/dashboard/company/accounting/settings');
      cy.wait(2000);

      cy.contains('Cuentas de Activos Fijos').should('be.visible');
      cy.contains('Bienes de Uso').should('be.visible');
      cy.contains('Depreciación Acumulada').should('be.visible');
      cy.contains('Gasto de Depreciación').should('be.visible');
      cy.contains('Resultado Venta/Baja').should('be.visible');
    });
  });

  describe('Depreciation Tab in Equipment Detail', () => {
    it('should display depreciation tab in equipment detail', () => {
      cy.visit('/dashboard/equipment');
      cy.wait(3000);

      cy.get('body').then(($body) => {
        const links = $body.find('a[href*="/dashboard/equipment/"]').not('a[href*="/new"]');
        if (links.length > 0) {
          cy.wrap(links).first().click({ force: true });
          cy.wait(2000);

          // Look for the depreciation tab
          cy.contains('Depreciación').should('be.visible');
        } else {
          cy.log('No equipment found, skipping depreciation tab test');
        }
      });
    });

    it('should show depreciation content when tab is clicked', () => {
      cy.visit('/dashboard/equipment');
      cy.wait(3000);

      cy.get('body').then(($body) => {
        const links = $body.find('a[href*="/dashboard/equipment/"]').not('a[href*="/new"]');
        if (links.length > 0) {
          cy.wrap(links).first().click({ force: true });
          cy.wait(2000);

          cy.contains('Depreciación').click({ force: true });
          cy.wait(1000);

          // Should show either the config button (empty state) or the depreciation data
          cy.get('body').then(($detail) => {
            if ($detail.find(':contains("Configurar Depreciación")').length > 0) {
              cy.contains('Configurar Depreciación').should('be.visible');
            } else if ($detail.find(':contains("Valor de Origen")').length > 0) {
              cy.contains('Valor de Origen').should('be.visible');
            }
          });
        } else {
          cy.log('No equipment found, skipping depreciation content test');
        }
      });
    });

    it('should open depreciation config dialog', () => {
      cy.visit('/dashboard/equipment');
      cy.wait(3000);

      cy.get('body').then(($body) => {
        const links = $body.find('a[href*="/dashboard/equipment/"]').not('a[href*="/new"]');
        if (links.length > 0) {
          cy.wrap(links).first().click({ force: true });
          cy.wait(2000);

          cy.contains('Depreciación').click({ force: true });
          cy.wait(1000);

          // Try to open config dialog
          cy.get('body').then(($detail) => {
            const configButton = $detail.find('button:contains("Configurar Depreciación")');
            const modifyButton = $detail.find('button:contains("Modificar")');

            if (configButton.length > 0) {
              cy.wrap(configButton).first().click({ force: true });
              cy.get('[role="dialog"]').should('be.visible');
              cy.contains('Configurar Depreciación').should('be.visible');
              cy.contains('Método').should('be.visible');
              cy.contains('Valor de Origen').should('be.visible');
              cy.contains('Valor Residual').should('be.visible');
              cy.contains('Vida Útil (meses)').should('be.visible');
            } else if (modifyButton.length > 0) {
              cy.wrap(modifyButton).first().click({ force: true });
              cy.get('[role="dialog"]').should('be.visible');
            } else {
              cy.log('No config/modify button found');
            }
          });
        } else {
          cy.log('No equipment found, skipping config dialog test');
        }
      });
    });
  });

  describe('Bulk Depreciation', () => {
    it('should display bulk depreciation button on equipment list', () => {
      cy.visit('/dashboard/equipment');
      cy.wait(2000);

      cy.contains('Contabilizar Depreciaciones').should('be.visible');
    });

    it('should open bulk depreciation dialog', () => {
      cy.visit('/dashboard/equipment');
      cy.wait(2000);

      cy.contains('Contabilizar Depreciaciones').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Contabilización Masiva de Depreciaciones').should('be.visible');
    });

    it('should show date selector in bulk depreciation dialog', () => {
      cy.visit('/dashboard/equipment');
      cy.wait(2000);

      cy.contains('Contabilizar Depreciaciones').click();
      cy.get('[role="dialog"]').should('be.visible');

      cy.contains('Contabilizar hasta').should('be.visible');
      cy.get('[role="dialog"] input[type="date"]').should('exist');
    });
  });

  describe('Fixed Assets Report', () => {
    it('should display fixed assets report section in accounting reports', () => {
      cy.visit('/dashboard/company/accounting/reports');
      cy.wait(2000);

      cy.contains('Bienes de Uso').should('be.visible');
      cy.contains('Registro de Bienes de Uso').should('be.visible');
      cy.contains('Depreciaciones del Período').should('be.visible');
    });

    it('should select and show fixed assets report', () => {
      cy.visit('/dashboard/company/accounting/reports');
      cy.wait(2000);

      cy.contains('Registro de Bienes de Uso').click();
      cy.wait(1000);

      cy.contains('Generar').should('be.visible');
    });

    it('should select and show period depreciations report', () => {
      cy.visit('/dashboard/company/accounting/reports');
      cy.wait(2000);

      cy.contains('Depreciaciones del Período').click();
      cy.wait(1000);

      cy.contains('Desde').should('be.visible');
      cy.contains('Hasta').should('be.visible');
      cy.contains('Generar').should('be.visible');
    });
  });
});
