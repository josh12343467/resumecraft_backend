# ResumeCraft API (Back-End)

This is the secure Node.js, Express, and PostgreSQL back-end API for the ResumeCraft application. This server handles user authentication, data management, and on-demand PDF generation for a full-stack resume builder.

The live API is deployed on Render:
**`https://resumecraft-backend-ha21.onrender.com`**

The live front-end application (built with React) is deployed on Vercel:
**`https://resumecraft-frontend.vercel.app`** (Add your Vercel link here)

---

## 🛠️ Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** PostgreSQL (hosted on Supabase)
* **ORM:** Prisma (for database queries and migrations)
* **Authentication:** `bcryptjs` (for password hashing) & `jsonwebtoken` (JWTs)
* **PDF Generation:** `puppeteer` (for "headless" browser PDF creation)
* **CORS:** `cors` (to connect to the front-end)
* **Environment:** `dotenv`

---

## 🚀 Features

* **Secure Authentication:** Full user registration and login system with JWTs.
* **Protected Routes:** API endpoints are protected with authentication middleware, ensuring a user can only access their *own* data.
* **Full CRUD:** Complete **C**reate, **R**ead, **U**pdate, and **D**elete functionality for all resume sections.
* **Dynamic PDF Generation:** A dedicated endpoint (`/api/resume/generate`) that uses `puppeteer` to build a custom PDF from the user's data in real-time.

---

## 🔑 API Endpoints

This is a list of all the available API routes. All `/api/*` routes (except for `/auth`) are protected and require a Bearer Token.

### Authentication
* `POST /api/auth/register`: Creates a new user.
* `POST /api/auth/login`: Logs in a user and returns a JWT.

### Resume Data (All Protected)
* `GET /api/resume`: Fetches all resume data (details, experience, etc.) for the logged-in user.
* `POST /api/details`: Creates or updates the user's `PersonalDetails`.
* `POST /api/experience`: Adds a new `Experience` entry.
* `POST /api/education`: Adds a new `Education` entry.
* `POST /api/project`: Adds a new `Project` entry.
* `POST /api/skill`: Adds a new `Skill` entry.

### Deleting Data (All Protected)
* `DELETE /api/experience/:id`: Deletes a specific experience entry.
* `DELETE /api/education/:id`: Deletes a specific education entry.
* `DELETE /api/project/:id`: Deletes a specific project entry.
* `DELETE /api/skill/:id`: Deletes a specific skill entry.

### PDF Generation (Protected)
* `GET /api/resume/generate`: Returns a downloadable PDF of the user's complete resume.