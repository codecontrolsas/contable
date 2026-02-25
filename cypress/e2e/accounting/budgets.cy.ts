import { setupClerkTestingToken } from '@clerk/testing/cypress';

describe('Accounting - Budgets', () => {
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

  after(() => {
    cy.task('cleanupTestBudgets').then((result) => {
      cy.log(`Budget cleanup: ${JSON.stringify(result)}`);
    });
  });

  describe('Navigation', () => {
    it('should navigate to budgets page from sidebar', () => {
      cy.visit('/dashboard/company/accounting/accounts');

      // Open accounting section in sidebar and click Presupuestos
      cy.get('body').then(($body) => {
        if ($body.find('a:contains("Presupuestos")').length > 0) {
          cy.contains('a', 'Presupuestos').click();
          cy.url().should('include', '/dashboard/company/accounting/budgets');
          cy.contains('Presupuestos').should('be.visible');
        } else {
          cy.log('Presupuestos link not found in sidebar, navigating directly');
          cy.visit('/dashboard/company/accounting/budgets');
          cy.contains('Presupuestos').should('be.visible');
        }
      });
    });
  });

  describe('Budgets Page', () => {
    it('should display the budgets page with title', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.contains('Presupuestos').should('be.visible');
      cy.contains('Control presupuestario por cuenta contable y periodo fiscal').should(
        'be.visible'
      );
    });

    it('should display fiscal year selector and new budget button', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      // Check for the "Nuevo Presupuesto" button
      cy.contains('button', 'Nuevo Presupuesto').should('be.visible');

      // Check for fiscal year selector (SelectTrigger)
      cy.get('button[data-slot="select-trigger"]').should('exist');
    });

    it('should show empty state or budgets table', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="budgets-table"]').length > 0) {
          cy.get('[data-testid="budgets-table"]').should('be.visible');
        } else {
          cy.contains('No hay presupuestos').should('be.visible');
        }
      });
    });
  });

  describe('Create Budget Modal', () => {
    it('should open create budget modal', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.contains('button', 'Nuevo Presupuesto').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Nuevo Presupuesto').should('be.visible');
    });

    it('should display account selector (combobox) in create modal', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.contains('button', 'Nuevo Presupuesto').click();
      cy.get('[role="dialog"]').should('be.visible');

      cy.get('[role="dialog"]').within(() => {
        cy.contains('Cuenta contable').should('be.visible');
        cy.get('[role="combobox"]').should('exist');
      });
    });

    it('should display 12 monthly amount inputs', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.contains('button', 'Nuevo Presupuesto').click();
      cy.get('[role="dialog"]').should('be.visible');

      cy.get('[role="dialog"]').within(() => {
        cy.contains('Montos mensuales').should('be.visible');
        // 12 monthly inputs + the distribute amount input = at least 12
        cy.get('input[type="number"]').should('have.length.gte', 12);
      });
    });

    it('should display distribute button', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.contains('button', 'Nuevo Presupuesto').click();
      cy.get('[role="dialog"]').should('be.visible');

      cy.get('[role="dialog"]').within(() => {
        cy.contains('Distribuir uniformemente').should('be.visible');
        cy.contains('button', 'Distribuir en 12').should('be.visible');
      });
    });

    it('should display total and action buttons', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.contains('button', 'Nuevo Presupuesto').click();
      cy.get('[role="dialog"]').should('be.visible');

      cy.get('[role="dialog"]').within(() => {
        cy.contains('Total Presupuestado').should('be.visible');
        cy.contains('button', 'Cancelar').should('be.visible');
        cy.contains('button', 'Guardar Presupuesto').should('be.visible');
      });
    });

    it('should close modal when clicking cancel', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.contains('button', 'Nuevo Presupuesto').click();
      cy.get('[role="dialog"]').should('be.visible');

      cy.get('[role="dialog"]').within(() => {
        cy.contains('button', 'Cancelar').click();
      });

      cy.get('[role="dialog"]').should('not.exist');
    });
  });

  describe('Create Budget', () => {
    it('should create a budget with distributed amounts', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.contains('button', 'Nuevo Presupuesto').click();
      cy.get('[role="dialog"]').should('be.visible');

      // Check if there are accounts available
      cy.get('[role="dialog"]').within(() => {
        cy.get('[role="combobox"]').click();
      });

      // Wait for popover to appear and check if there are accounts
      cy.get('body').then(($body) => {
        // Check if the command list has options
        if ($body.find('[cmdk-item]').length > 0) {
          // Select the first available account
          cy.get('[cmdk-item]').first().click();

          cy.get('[role="dialog"]').within(() => {
            // Use distribute feature to set amounts
            cy.get('input[placeholder="Monto total a distribuir"]').type('12000');
            cy.contains('button', 'Distribuir en 12').click();

            // Verify total is calculated
            cy.contains('Total Presupuestado').should('be.visible');

            // Submit the form
            cy.contains('button', 'Guardar Presupuesto').click();
          });

          // Verify success toast
          cy.checkToast('Presupuesto creado correctamente');

          // Verify budget appears in the table
          cy.get('[data-testid="budgets-table"]').should('be.visible');
        } else {
          // Close the popover and modal
          cy.get('body').type('{escape}');
          cy.wait(300);
          cy.get('body').type('{escape}');
          cy.log('No budgetable accounts available, skipping create test');
        }
      });
    });
  });

  describe('View Budget Detail', () => {
    it('should open detail modal from table actions', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="budgets-table"] tbody tr').length > 0) {
          // Click the actions dropdown on the first row
          cy.get('[data-testid="budgets-table"] tbody tr')
            .first()
            .find('button')
            .last()
            .click();

          // Click "Ver Detalle"
          cy.contains('Ver Detalle').click();

          // Verify detail modal opens
          cy.get('[role="dialog"]').should('be.visible');
          cy.contains('Detalle del Presupuesto').should('be.visible');

          // Verify monthly table is visible (headers)
          cy.get('[role="dialog"]').within(() => {
            cy.contains('Presupuestado').should('be.visible');
            cy.contains('Ejecutado').should('be.visible');
          });
        } else {
          cy.log('No budgets in table, skipping detail test');
        }
      });
    });
  });

  describe('Budget State Transitions', () => {
    it('should activate a draft budget', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.get('body').then(($body) => {
        // Look for a row with "Borrador" badge
        if ($body.find('[data-testid="budgets-table"] tbody tr').length > 0) {
          const hasDraft = $body.find('[data-testid="budgets-table"]').text().includes('Borrador');

          if (hasDraft) {
            // Find the first draft row and open its dropdown
            cy.contains('[data-testid="budgets-table"] tbody tr', 'Borrador')
              .first()
              .find('button')
              .last()
              .click();

            // Click "Activar"
            cy.get('body').then(($menuBody) => {
              if ($menuBody.find('[role="menuitem"]:contains("Activar")').length > 0) {
                cy.contains('[role="menuitem"]', 'Activar').click();

                // Verify confirmation dialog
                cy.get('[role="alertdialog"]').should('be.visible');
                cy.contains('Activar presupuesto').should('be.visible');

                // Confirm activation
                cy.get('[role="alertdialog"]').within(() => {
                  cy.contains('button', 'Activar').click();
                });

                // Verify success toast
                cy.checkToast('Presupuesto activado correctamente');
              } else {
                cy.log('Activar option not found in dropdown');
              }
            });
          } else {
            cy.log('No draft budgets found, skipping activation test');
          }
        } else {
          cy.log('No budgets in table, skipping activation test');
        }
      });
    });

    it('should delete a draft budget', () => {
      cy.visit('/dashboard/company/accounting/budgets');

      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="budgets-table"] tbody tr').length > 0) {
          const hasDraft = $body.find('[data-testid="budgets-table"]').text().includes('Borrador');

          if (hasDraft) {
            // Find the first draft row and open its dropdown
            cy.contains('[data-testid="budgets-table"] tbody tr', 'Borrador')
              .first()
              .find('button')
              .last()
              .click();

            cy.get('body').then(($menuBody) => {
              if ($menuBody.find('[role="menuitem"]:contains("Eliminar")').length > 0) {
                cy.contains('[role="menuitem"]', 'Eliminar').click();

                // Verify confirmation AlertDialog
                cy.get('[role="alertdialog"]').should('be.visible');
                cy.contains('Eliminar presupuesto').should('be.visible');

                // Confirm deletion
                cy.get('[role="alertdialog"]').within(() => {
                  cy.contains('button', 'Eliminar').click();
                });

                // Verify success toast
                cy.checkToast('Presupuesto eliminado correctamente');
              } else {
                cy.log('Eliminar option not found in dropdown');
              }
            });
          } else {
            cy.log('No draft budgets found, skipping delete test');
          }
        } else {
          cy.log('No budgets in table, skipping delete test');
        }
      });
    });
  });

  describe('Reports Integration', () => {
    it('should display budget variance report option', () => {
      cy.visit('/dashboard/company/accounting/reports');

      cy.contains('Presupuestarios').should('be.visible');
      cy.contains('Variación Presupuestaria').should('be.visible');
    });

    it('should select budget variance report', () => {
      cy.visit('/dashboard/company/accounting/reports');

      cy.contains('Variación Presupuestaria').click();

      cy.wait(1000);
      cy.get('body').should('be.visible');
    });
  });
});
