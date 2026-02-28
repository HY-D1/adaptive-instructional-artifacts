#!/usr/bin/env node
/**
 * Create a minimal sample PDF for testing the PDF index builder.
 * This uses Node.js built-in modules to generate a valid PDF file.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../docs/pdf-sources/sample.pdf');

// Minimal PDF structure with "SQL Learning Guide" content
// This is a simplified PDF that pdftotext can extract
const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 5 0 R
  >>
>>
>>
endobj

4 0 obj
<<
/Length 500
>>
stream
BT
/F1 12 Tf
50 700 Td
(SQL Learning Guide) Tj
0 -20 Td
(A guide to learning SQL basics including SELECT statements) Tj
0 -20 Td
(WHERE clauses for filtering data and JOIN operations for combining tables.) Tj
0 -20 Td
(Understanding GROUP BY for aggregation and ORDER BY for sorting results.) Tj
0 -20 Td
(Common errors include missing quotes around string values and undefined column names.) Tj
0 -20 Td
(Always check your table schema before writing queries to ensure column names are correct.) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000314 00000 n 
0000000864 00000 n 

trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
941
%%EOF`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, pdfContent, 'binary');
console.log(`Created sample PDF: ${outputPath}`);
