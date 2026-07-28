// Deep import of pdf-parse v1's implementation, bypassing its index.js
// (whose debug-mode check breaks under bundlers). No published types.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
  }
  function pdfParse(data: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdfParse;
}
