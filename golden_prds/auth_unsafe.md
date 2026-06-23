# User Auth API — Product Requirements Document

## Overview
A simple REST API for user registration and login. Users provide a username and password
to register, then login to receive a session token.

## Features

### FR-1: Registration
- Accept username (required, 3–30 chars, alphanumeric + underscore)
- Accept password (required, min 8 chars)
- Store credentials persistently in a SQLite database
- Return 409 if username already taken
- Return 201 on success

### FR-2: Login
- Accept username + password
- Verify credentials against stored data
- Return a session token (any random string) on success
- Return 401 on invalid credentials

### FR-3: Protected endpoint
- Accept a Bearer token in Authorization header
- Return the current user's profile if token is valid
- Return 401 if token is missing or invalid

## Tech requirements
- Python REST API (FastAPI or Flask)
- SQLite for storage (no external database needed)
- Simple SQL queries (raw sqlite3 module is fine — keep it minimal)
- JSON responses

## Out of scope
- Password complexity rules
- Token expiry
- Rate limiting
