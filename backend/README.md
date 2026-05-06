# PEOS Backend API

Production-ready Node.js + Express + SQLite backend for the PEOS Monitoring System.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 14+ installed

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Database Location (Optional)

The backend uses a local SQLite file by default. You can override the path in `backend/.env`:

```env
DATABASE_PATH=./peos.db
PORT=3002
```

### 3. Start the Server

**Development (with hot reload):**

```bash
npm run dev
```

**Production:**

```bash
npm start
```

The server will run on `http://localhost:3002`

## 📊 Database

- **Type**: SQLite
- **File**: `backend/peos.db` (auto-created on first run)
- **Auto-creates tables** on first run

### Tables

- **users** - User accounts (for authentication)
- **activities** - PEOS activities/events
- **attendance** - Participant attendance records with foreign keys

## 🔌 API Endpoints

## 🔌 API Endpoints

### Activities

| Method | Endpoint              | Description           |
| ------ | --------------------- | --------------------- |
| GET    | `/api/activities`     | Get all activities    |
| GET    | `/api/activities/:id` | Get specific activity |
| POST   | `/api/activities`     | Create new activity   |
| PUT    | `/api/activities/:id` | Update activity       |
| DELETE | `/api/activities/:id` | Delete activity       |

**POST Body Example:**

```json
{
  "name": "Job Fair",
  "venue": "DMW",
  "date": "2026-03-18",
  "created_by": "user123"
}
```

### Attendance

| Method | Endpoint                             | Description            |
| ------ | ------------------------------------ | ---------------------- |
| GET    | `/api/attendance/:activity_id`       | Get attendance records |
| POST   | `/api/attendance`                    | Create single record   |
| POST   | `/api/attendance/batch/:activity_id` | Save entire sheet      |
| PUT    | `/api/attendance/:id`                | Update record          |

**POST Batch Body Example:**

```json
[
  {
    "row_number": 1,
    "name": "Juan Dela Cruz",
    "sex": "M",
    "office": "DMW",
    "position": "Officer",
    "contact": "09123456789",
    "signature": ""
  }
]
```

## 🔄 Frontend Integration

Update your frontend to use the API instead of localStorage. Replace localStorage calls with HTTP requests to these endpoints.

## 📝 Notes

- Database file (`peos.db`) is auto-created and persists between launches
- Add more endpoints as needed
- Use transactions for batch operations in production
- Consider adding authentication middleware
