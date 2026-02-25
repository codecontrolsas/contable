import ExcelJS from 'exceljs';

const THEME = {
  headerBg: '6b7280',
  headerText: 'FFFFFF',
  instructionBg: 'dbeafe',
  exampleBg: 'fef3c7',
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: THEME.headerText }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: THEME.headerBg },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin' },
    };
  });
}

function addInstructionRow(
  sheet: ExcelJS.Worksheet,
  colCount: number,
  text: string
) {
  const row = sheet.addRow([text]);
  row.getCell(1).font = { italic: true, size: 10, color: { argb: '1e40af' } };
  row.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: THEME.instructionBg },
  };
  sheet.mergeCells(row.number, 1, row.number, colCount);
}

/**
 * Genera plantilla Excel para importar facturas de venta de apertura
 */
export async function generateSalesInvoicesTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Baxer ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Facturas de Venta');

  // Instrucciones
  addInstructionRow(sheet, 7, 'INSTRUCCIONES: Completar cada fila con los datos de una factura pendiente de cobro.');
  addInstructionRow(sheet, 7, 'El campo "Cliente" debe coincidir exactamente con el nombre o CUIT registrado en el sistema.');
  addInstructionRow(sheet, 7, 'Tipos válidos: FACTURA A, FACTURA B, FACTURA C, NOTA CREDITO A, NOTA CREDITO B, NOTA CREDITO C');
  addInstructionRow(sheet, 7, 'Formato de fechas: DD/MM/YYYY');
  sheet.addRow([]);

  // Headers
  const headers = [
    'Cliente (Nombre o CUIT)',
    'Tipo Comprobante',
    'Punto de Venta',
    'Número',
    'Fecha Emisión',
    'Fecha Vencimiento',
    'Total',
  ];

  const headerRow = sheet.addRow(headers);
  styleHeader(headerRow);

  // Ejemplo
  const exampleRow = sheet.addRow([
    'Empresa Ejemplo S.A.',
    'FACTURA A',
    '0001',
    '00000123',
    '01/01/2025',
    '31/01/2025',
    150000,
  ]);
  exampleRow.eachCell((cell) => {
    cell.font = { italic: true, color: { argb: '92400e' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: THEME.exampleBg },
    };
  });

  // Ancho de columnas
  sheet.columns = [
    { width: 30 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 18 },
    { width: 15 },
  ];

  // Formatear columna Total como número
  sheet.getColumn(7).numFmt = '#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Genera plantilla Excel para importar facturas de compra de apertura
 */
export async function generatePurchaseInvoicesTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Baxer ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Facturas de Compra');

  // Instrucciones
  addInstructionRow(sheet, 7, 'INSTRUCCIONES: Completar cada fila con los datos de una factura pendiente de pago.');
  addInstructionRow(sheet, 7, 'El campo "Proveedor" debe coincidir exactamente con la razón social, nombre comercial o CUIT registrado.');
  addInstructionRow(sheet, 7, 'Tipos válidos: FACTURA A, FACTURA B, FACTURA C, NOTA CREDITO A, NOTA CREDITO B, NOTA CREDITO C');
  addInstructionRow(sheet, 7, 'Formato de fechas: DD/MM/YYYY');
  sheet.addRow([]);

  // Headers
  const headers = [
    'Proveedor (Razón Social o CUIT)',
    'Tipo Comprobante',
    'Punto de Venta',
    'Número',
    'Fecha Emisión',
    'Fecha Vencimiento',
    'Total',
  ];

  const headerRow = sheet.addRow(headers);
  styleHeader(headerRow);

  // Ejemplo
  const exampleRow = sheet.addRow([
    'Distribuidora Norte S.R.L.',
    'FACTURA A',
    '0003',
    '00004567',
    '15/01/2025',
    '15/02/2025',
    85000,
  ]);
  exampleRow.eachCell((cell) => {
    cell.font = { italic: true, color: { argb: '92400e' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: THEME.exampleBg },
    };
  });

  // Ancho de columnas
  sheet.columns = [
    { width: 35 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 18 },
    { width: 15 },
  ];

  // Formatear columna Total como número
  sheet.getColumn(7).numFmt = '#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
