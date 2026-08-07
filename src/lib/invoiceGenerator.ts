import { format } from "date-fns";
import { PDF_HEADER_STYLES, getPdfHeaderHtml } from "./pdfHeader";

interface InvoiceLineItem {
  period: string;
  rank: string;
  officers: string;
  shifts: number;
  rate: number;
  amount: number;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  duration: string;
  companyName: string;
  companyAddress: string;
  lineItems: InvoiceLineItem[];
  total: number;
  sscl?: number;
  vat?: number;
  grandTotal?: number;
}

// Taxes removed — grand total equals the subtotal.
export const computeInvoiceTaxes = (subtotal: number) => ({
  subtotal,
  sscl: 0,
  vat: 0,
  grandTotal: subtotal,
});

const money = (n: number) =>
  `LKR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const generateInvoicePDF = (invoiceData: InvoiceData) => {
  const subtotal = invoiceData.total;
  const grandTotal = subtotal;

  // Create HTML content for the invoice
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoiceData.invoiceNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 32px;
          font-size: 12px;
          color: #111;
        }
        ${PDF_HEADER_STYLES}
        .info-section { margin-bottom: 18px; }
        .info-row { margin: 4px 0; display: flex; }
        .info-label { font-weight: bold; width: 150px; }
        .client-box {
          float: right;
          text-align: right;
          margin-top: -60px;
          padding: 8px 12px;
          border-left: 3px solid #00855e;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 18px 0;
        }
        th, td {
          border: 1px solid #cfd8d6;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #e6f4ef;
          color: #014d3a;
          font-weight: bold;
        }
        .text-right { text-align: right; }
        .total-row {
          font-weight: bold;
          background-color: #f4faf7;
        }
        .footer {
          margin-top: 24px;
          font-size: 10px;
          border-top: 1px solid #cfd8d6;
          padding-top: 10px;
          color: #444;
        }
        .footer p { margin: 4px 0; }
      </style>
    </head>
    <body>
      ${getPdfHeaderHtml("INVOICE")}

      <div class="info-section">
        <div class="info-row">
          <span class="info-label">INVOICE DATE:</span>
          <span>${invoiceData.invoiceDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">INVOICE NO:</span>
          <span>${invoiceData.invoiceNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">DURATION:</span>
          <span>${invoiceData.duration}</span>
        </div>
      </div>

      <div class="client-box">
        <strong>${invoiceData.companyName}</strong><br>
        ${invoiceData.companyAddress}
      </div>

      <table>
        <thead>
          <tr>
            <th>PERIOD</th>
            <th>RANK</th>
            <th>NO OF OFFICERS</th>
            <th class="text-right">NO OF SHIFTS</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceData.lineItems.map(item => `
            <tr>
              <td>${item.period}</td>
              <td>${item.rank}</td>
              <td>${item.officers}</td>
              <td class="text-right">${item.shifts}</td>
              <td class="text-right">LKR ${item.rate.toLocaleString()}</td>
              <td class="text-right">LKR ${item.amount.toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3"></td>
            <td class="text-right">${invoiceData.lineItems.reduce((sum, item) => sum + item.shifts, 0)}</td>
            <td class="text-right">TOTAL</td>
            <td class="text-right">${money(subtotal)}</td>
          </tr>
          <tr>
            <td colspan="4"></td>
            <td class="text-right">SSCL (2.5%)</td>
            <td class="text-right">${money(sscl)}</td>
          </tr>
          <tr>
            <td colspan="4"></td>
            <td class="text-right">VAT (18%)</td>
            <td class="text-right">${money(vat)}</td>
          </tr>
          <tr class="total-row">
            <td colspan="4"></td>
            <td class="text-right">GRAND TOTAL</td>
            <td class="text-right">${money(grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <p>Changes if any in this invoice will be adjusted (Debited/credited) in the following month invoice please.</p>
        <p>Cheques should be drawn in favour of "Grand Senaro Security (Pvt) Ltd and crossed,</p>
        <p>Account payee only or deposit at Account no - 8139-0595| Bank of Ceylon, Maharagama</p>
      </div>
    </body>
    </html>
  `;

  // Open print dialog
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

export const generateInvoiceNumber = (companyNumber: string, year: number, month: number): string => {
  const yearShort = year.toString().slice(-2);
  const monthPadded = month.toString().padStart(2, '0');
  return `${companyNumber}-${monthPadded}-${yearShort}`;
};
