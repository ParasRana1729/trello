# Trello Clone

A lightweight Trello clone built with Node.js, Express, and vanilla JavaScript. Supports organizations, boards, members, and issue tracking with JWT authentication.

**Live:** [trello-clone-pro.up.railway.app](https://trello-clone-pro.up.railway.app)

## Features

- User signup and signin with JWT auth
- Create and manage organizations
- Add/remove members to organizations
- Create boards within organizations
- Create, update, and delete issues on boards
- Role-based access (admin vs member)

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** HTML, CSS, JavaScript
- **Auth:** JSON Web Tokens

## Getting Started

```bash
npm install
npm start
```

Server runs at `http://localhost:3000`.

## Testing

```bash
npm test
```

41 tests covering all API endpoints and auth middleware.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Health check |
| POST | `/signup` | No | Create account |
| POST | `/signin` | No | Login, returns JWT |
| GET | `/orgs` | Yes | List user's orgs |
| POST | `/create-org` | Yes | Create organization |
| DELETE | `/org` | Yes | Delete organization (admin) |
| GET | `/members` | Yes | List org members |
| POST | `/add-member-to-org` | Yes | Add member (admin) |
| PUT | `/members` | Yes | Remove member (admin) |
| GET | `/boards` | Yes | List boards |
| POST | `/board` | Yes | Create board |
| DELETE | `/board` | Yes | Delete board (admin) |
| POST | `/issue` | Yes | Create issue |
| PUT | `/issue` | Yes | Update issue |
| DELETE | `/issue` | Yes | Delete issue |
| GET | `/users` | Yes | List all users |
