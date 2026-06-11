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
}

export const generateInvoicePDF = (invoiceData: InvoiceData) => {
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
          margin: 40px;
          font-size: 12px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          width: 80px;
          height: 80px;
          margin: 0 auto 10px;
        }
        .header h1 {
          margin: 5px 0;
          font-size: 16px;
          font-weight: bold;
        }
        .header p {
          margin: 3px 0;
          font-size: 11px;
        }
        .invoice-title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          margin: 20px 0;
        }
        .info-section {
          margin-bottom: 20px;
        }
        .info-row {
          margin: 5px 0;
          display: flex;
        }
        .info-label {
          font-weight: bold;
          width: 150px;
        }
        .client-box {
          float: right;
          text-align: right;
          margin-top: -60px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .text-right {
          text-align: right;
        }
        .total-row {
          font-weight: bold;
          background-color: #f9f9f9;
        }
        .footer {
          margin-top: 30px;
          font-size: 10px;
        }
        .footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="/logo.png" alt="Company Logo" class="logo">
        <h1>GRAND SENARO SECURITY (PVT) LTD</h1>
        <p>232/1/1B LAKSIRI BUILDING, WATTEGEDARA, MAHARAGAMA</p>
        <p>REAR ADMIN AND LOGISTICS DEPARTMENT</p>
        <p>21/58 SWARNA PLACE, GALWALADENIYA ROAD, MATTEGODA</p>
        <p>HOTLINES: +94 77 730 5321 | +94 71 730 5321 | +94 76 661 3165 | +94 11 365 1070</p>
      </div>

      <div class="invoice-title">INVOICE</div>

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
            <td class="text-right">LKR ${invoiceData.total.toLocaleString()}</td>
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
