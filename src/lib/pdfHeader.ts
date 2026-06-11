// Shared branded header for printable / PDF documents
export const PDF_HEADER_STYLES = `
  .gs-header {
    border-bottom: 3px solid #00855e;
    padding-bottom: 14px;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .gs-header .gs-logo {
    width: 86px;
    height: 86px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .gs-header .gs-info { flex: 1; }
  .gs-header h1 {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 800;
    color: #014d3a;
    letter-spacing: 0.5px;
  }
  .gs-header .gs-tag {
    font-size: 10.5px;
    color: #00855e;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 6px;
  }
  .gs-header .gs-contact {
    font-size: 10.5px;
    line-height: 1.55;
    color: #222;
    margin: 0;
  }
  .gs-header .gs-contact strong { color: #014d3a; }
  .gs-doc-title {
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 2px;
    margin: 10px 0 18px;
    color: #014d3a;
  }
`;

export function getPdfHeaderHtml(docTitle?: string) {
  return `
    <div class="gs-header">
      <img src="/logo.png" alt="Grand Senaro Security" class="gs-logo" />
      <div class="gs-info">
        <h1>GRAND SENARO SECURITY (PVT) LTD</h1>
        <p class="gs-tag">Professional Security &amp; Protection Services</p>
        <p class="gs-contact">
          <strong>Head Office:</strong> 21/58, Swarna Place, Galwaladeniya Road, Mattegoda<br/>
          <strong>Operational HQ:</strong> No. 187, 3rd Floor, Old Road, Maharagama<br/>
          <strong>Mobile:</strong> 0777305321 &nbsp;|&nbsp; 0717305321 &nbsp;|&nbsp; 0711778137 &nbsp;&nbsp; <strong>Tel/Fax:</strong> 011-2182979<br/>
          <strong>Email:</strong> info@grandsenaro.biz &nbsp;|&nbsp; <strong>Web:</strong> www.grandsenaro.biz
        </p>
      </div>
    </div>
    ${docTitle ? `<div class="gs-doc-title">${docTitle}</div>` : ""}
  `;
}
