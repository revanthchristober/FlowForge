# Invoice Parser — Product Requirements Document

## Overview
A CLI tool that reads invoice files (CSV or plain text), extracts key fields (invoice number,
date, line items, total), validates them, and outputs a structured JSON file per invoice.
Designed for batch processing folders of invoices.

## Functional requirements

### FR-1: File parsing
- Accept a single file path or a directory as input
- Support CSV format (columns: item, quantity, unit_price)
- Support plain-text format: colon-delimited key-value lines (e.g. `Invoice: 1042`)
- Auto-detect format from file extension (.csv vs .txt)

### FR-2: Field extraction
- Extract: invoice_number, invoice_date, vendor_name, line_items[], subtotal, tax, total
- Derive subtotal from sum of line_items quantity × unit_price
- Parse dates in ISO format (YYYY-MM-DD) or DD/MM/YYYY

### FR-3: Validation
- Required fields: invoice_number, invoice_date, at least one line item
- Each line item must have positive quantity and non-negative unit_price
- total must be ≥ subtotal (tax is non-negative)
- Return structured validation errors if fields are missing or invalid

### FR-4: Output
- Write one JSON file per input file: `{original_stem}_parsed.json`
- Include validation status in output: `{"valid": true, "errors": [], "data": {...}}`
- Print a summary table to stdout: filename | status | line_items | total

## Non-functional requirements
- Pure Python stdlib — no pandas, no third-party parsing libraries
- Handle files up to 10 000 lines without loading all into memory
- Clear error messages for malformed input

## Out of scope
- PDF parsing
- Network fetch of invoices
- Database storage
- GUI
