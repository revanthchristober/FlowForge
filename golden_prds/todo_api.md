# Todo API — Product Requirements Document

## Overview
A production-ready REST API for managing personal todo items. Users can create, read,
update, and delete todos, mark them complete, and filter by status.

## Functional requirements

### FR-1: Todo lifecycle
- Create a todo with a title (required, max 200 chars) and optional description
- List all todos (paginated, default 20/page)
- Retrieve a single todo by ID
- Update title, description, or completion status
- Delete a todo permanently

### FR-2: Filtering and sorting
- Filter by `status`: `all` | `pending` | `complete`
- Sort by `created_at` (default: newest first) or `title` (A-Z)
- Filter + sort can be combined

### FR-3: Validation
- Title is required and must be 1–200 characters
- Description is optional, max 1000 characters
- Return 422 with field-level error messages on invalid input

### FR-4: Error handling
- 404 for unknown todo IDs
- 400 for malformed requests
- Consistent JSON error envelope: `{"error": "...", "detail": {...}}`

## Non-functional requirements
- Python REST API (FastAPI preferred)
- Persistent SQL storage
- JSON responses with consistent schema
- Response time < 200ms for list/get operations
- Test coverage for all endpoints (happy path + error cases)

## Out of scope
- Authentication / user accounts
- Tags or categories
- Due dates
- Attachments
