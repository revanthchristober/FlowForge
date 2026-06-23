# Mini CRM — Product Requirements Document

## Overview
A lightweight REST API for a Customer Relationship Management system. Manages contacts,
companies, and notes. Supports full-text search across all entities.

## Functional requirements

### FR-1: Contacts
- Create a contact with: first_name, last_name (both required), email (optional), phone (optional)
- List contacts (paginated, 20/page), filter by company
- Retrieve a single contact by ID
- Update any contact field
- Delete a contact (soft delete — mark as archived, don't remove)

### FR-2: Companies
- Create a company with: name (required), domain (optional), industry (optional)
- List companies (paginated), filter by industry
- Retrieve by ID; update; delete (soft)
- Count of active contacts shown on company detail

### FR-3: Notes
- Attach a note to a contact or a company (not both — one must be set, not both)
- Note has: body (required, max 5000 chars), created_at (auto), updated_at (auto)
- List notes for a contact or company (newest first)
- Edit and delete notes

### FR-4: Search
- Single search endpoint: `GET /search?q=term`
- Returns ranked results across contacts (name + email), companies (name + domain), notes (body)
- Minimum: substring match; bonus: ranked by field priority (contact name > company name > note body)

## Non-functional requirements
- Python REST API (FastAPI)
- SQLite for storage (no external DB setup required)
- JSON responses with consistent envelope
- 422 validation errors with field-level messages
- Test coverage: at minimum CRUD happy paths + search

## Out of scope
- Authentication
- Email sending
- Pipeline / deal tracking
- File attachments
- Import/export CSV
