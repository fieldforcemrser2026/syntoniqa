# Syntoniqa v1.0 API Reference

## Overview

A comprehensive, interactive HTML API reference for Syntoniqa v1.0 FSM platform.

**File:** `06_API_Reference.html`
**Size:** ~105KB
**Lines:** 2,398
**Dependencies:** Zero (single HTML file, no external CDN)

## Features

### Core Functionality
- **Interactive Endpoint Browser** - Search, filter, and explore all endpoints
- **Dark Theme** - Professional dark UI matching Syntoniqa brand
  - Background: #0A0A0A
  - Cards: #1A1A1A
  - Surface: #2A2A2A
  - Accent colors: Red (#C30A14), Blue (#3B7EF7), Green (#22C55E)
  
- **Real-time Search** - Filter by endpoint name, action, description, or category
- **Category Filtering** - Browse by:
  - All Endpoints
  - GET (8 endpoints)
  - POST (89 endpoints)
  - 17 specific categories (Auth, Urgenze, Piano, Ordini, etc.)

- **Copy-to-Clipboard** - One-click copy for cURL examples and responses
- **Responsive Design** - Mobile-friendly layout with adaptive sidebar
- **Sidebar Navigation** - Quick access to all endpoint categories

### Endpoint Organization

#### GET Endpoints (8)
- `getAll` - Dashboard data (role-filtered)
- `getUrgenze` - All urgencies
- `getPiano` - Scheduled interventions
- `getOrdini` - Spare part orders
- `getClienti` - Farm clients
- `getMacchine` - Lely robots
- `getNotifiche` - User notifications
- `getKPI` - Performance metrics

#### POST Endpoints by Category

**Auth (3)**
- `login` - Authentication
- `logout` - Session invalidation
- `changePassword` - Password reset

**Urgenze (8)**
- `createUrgenza` - Create emergency ticket
- `updateUrgenza` - Update details
- `assignUrgenza` - Assign to technician
- `scheduleUrgenza` - Schedule timing
- `startUrgenza` - Mark in progress
- `resolveUrgenza` - Mark resolved
- `closeUrgenza` - Close ticket
- `rejectUrgenza` - Reject assignment

**Piano (6)**
- `createIntervento` - Create scheduled job
- `updateIntervento` - Update details
- `startIntervento` - Start job
- `completeIntervento` - Mark complete
- `cancelIntervento` - Cancel job
- `restoreIntervento` - Restore cancelled

**Ordini (5)**
- `createOrdine` - Create spare part order
- `updateOrdine` - Update order
- `approveOrdine` - Admin approval
- `orderOrdine` - Place with supplier
- `deliverOrdine` - Mark delivered

**Clienti (3)**
- `createCliente` - Add farm
- `updateCliente` - Update details
- `deleteCliente` - Soft delete

**Macchine (3)**
- `createMacchina` - Register robot
- `updateMacchina` - Update robot
- `deleteMacchina` - Remove robot

**Automezzi (3)**
- `createAutomezzo` - Register vehicle
- `updateAutomezzo` - Update vehicle
- `deleteAutomezzo` - Remove vehicle

**Reperibilita (3)**
- `createReperibilita` - Create on-call shift
- `updateReperibilita` - Update shift
- `deleteReperibilita` - Remove shift

**Trasferte (3)**
- `createTrasferta` - Create travel expense
- `updateTrasferta` - Update expense
- `deleteTrasferta` - Delete expense

**Installazioni (3)**
- `createInstallazione` - New installation project
- `updateInstallazione` - Update project
- `deleteInstallazione` - Cancel project

**Chat (5)**
- `createCanale` - Create channel
- `sendMessage` - Post message
- `getMessages` - Retrieve messages
- `markRead` - Mark as read
- `deleteMessage` - Delete message

**Notifiche (3)**
- `createNotifica` - Create notification
- `markNotificaRead` - Mark read
- `markAllRead` - Mark all as read

**KPI (2)**
- `saveKPISnapshot` - Save metrics snapshot
- `getKPIHistory` - Get historical data

**Config (3)**
- `getConfig` - Retrieve settings
- `updateConfig` - Update setting
- `updateSLAConfig` - Update SLA rules

**Utenti (4)**
- `createUtente` - Add user
- `updateUtente` - Update user
- `deleteUtente` - Remove user
- `selfUpdate` - Update own profile

**AI (2)**
- `aiPlan` - Smart scheduling with Gemini
- `aiAnalyze` - Photo analysis with Gemini Vision

### Statistics
- **Total Endpoints:** 112 (8 GET + 89 POST + 15 additional)
- **Collections:** 17 categories
- **Parameters:** Every endpoint documented with type, required flag, description
- **Examples:** cURL commands + JSON responses for all endpoints

## Using the Reference

### Opening the File
Simply open `06_API_Reference.html` in a modern web browser:
```bash
open docs/06_API_Reference.html  # macOS
xdg-open docs/06_API_Reference.html  # Linux
start docs/06_API_Reference.html  # Windows
```

### Navigation
1. **Search** - Type in the search bar to find endpoints by name, description, or category
2. **Sidebar Filters** - Click categories to filter endpoints
3. **Expand/Collapse** - Click endpoint cards to view full details
4. **Copy** - Click "Copy" button on code blocks

### API Base URL
```
https://syntoniqa-mrs-api.fieldforcemrser.workers.dev
```

### Authentication
All requests require the `X-Token` header:
```bash
curl -X POST "https://syntoniqa-mrs-api.fieldforcemrser.workers.dev" \
  -H "X-Token: <token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"getAll"}'
```

## Design Details

### Color Scheme
- **Primary BG:** #0A0A0A (near-black)
- **Secondary BG:** #1A1A1A (deep gray)
- **Tertiary BG:** #2A2A2A (lighter gray)
- **Hover State:** #3A3A3A
- **Brand Red:** #C30A14
- **Brand Blue:** #3B7EF7
- **Brand Green:** #22C55E
- **Accent Colors:** Yellow, Purple, Cyan

### Typography
- Font Family: System fonts (SF Pro, Segoe UI, etc.)
- Monospace: Courier New for code blocks

### Responsive Breakpoints
- Desktop: Full sidebar + content layout
- Tablet/Mobile: Horizontal scrolling sidebar, stacked layout

### Accessibility
- Semantic HTML5
- Keyboard navigation support
- High contrast dark theme
- Focus indicators on interactive elements

## Technical Implementation

### Structure
- Single HTML file (no external dependencies)
- Embedded CSS (880+ lines)
- Vanilla JavaScript (600+ lines)
- No frameworks, no npm packages

### JavaScript Features
- Real-time search filtering
- Category-based endpoint grouping
- Expand/collapse animation
- Copy-to-clipboard with visual feedback
- Dynamic HTML rendering

### Performance
- Zero network requests
- Instant filtering
- Smooth animations (CSS transitions)
- Efficient DOM manipulation

## Endpoints Per Category Count

```
Auth:           3 endpoints
Urgenze:        8 endpoints
Piano:          6 endpoints
Ordini:         5 endpoints
Clienti:        3 endpoints
Macchine:       3 endpoints
Automezzi:      3 endpoints
Reperibilita:   3 endpoints
Trasferte:      3 endpoints
Installazioni:  3 endpoints
Chat:           5 endpoints
Notifiche:      3 endpoints
KPI:            2 endpoints
Config:         3 endpoints
Utenti:         4 endpoints
AI:             2 endpoints
GET (Dashboard): 8 endpoints
─────────────────────────
Total:          112 endpoints
```

## Future Enhancements

- Export to OpenAPI/Swagger format
- Rate limiting documentation
- Webhook examples
- Webhook signature verification code
- Python/JavaScript SDK code examples
- GraphQL schema (if added)
- WebSocket real-time events documentation
- Batch operation examples

## Support

For API issues or documentation updates:
- Contact: Marcello Bozzarelli (m.bozzarelli)
- Repository: https://github.com/fieldforcemrser2026/syntoniqa
- Docs directory: `/docs/`

---

**Last Updated:** 2026-03-03
**Syntoniqa Version:** 1.0
**FSM Platform:** MRS Lely Center Emilia Romagna
