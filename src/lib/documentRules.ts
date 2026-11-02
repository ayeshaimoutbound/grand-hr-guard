export function needsClientSelection(kind: string, category: string): boolean {
  return kind === "company" || (kind === "general" && ["Quotation", "Proposal"].includes(category));
}