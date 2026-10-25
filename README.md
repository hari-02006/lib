# Library Management REST API

A beginner-friendly library collection manager with a responsive admin dashboard and REST API built with Node.js, Express, and MongoDB using Mongoose. The dashboard is plain HTML, CSS, and JavaScript served by the Express application.

## Requirements

- Node.js 18 or later
- npm
- A MongoDB Atlas cluster (or another MongoDB connection URI)
- Postman for manual API testing

## Setup

1. Open a terminal in the `library-management-api` folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Open `.env` and replace the example `MONGODB_URI` with your MongoDB connection string. For example:

   ```env
   PORT=3000
   MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/library_management?retryWrites=true&w=majority
   ```

   Replace the username, password, and cluster host with your own values. URL-encode reserved characters in the username or password before putting them in the URI. For example, `@` inside a password must be written as `%40`; otherwise, the URI parser can mistake part of the password for the cluster hostname. Never commit `.env` or share its credentials; it is excluded by `.gitignore`.

4. Start the API:

   ```bash
   npm start
   ```

   For local development with Node.js watch mode:

   ```bash
   npm run dev
   ```

The API listens on `http://localhost:3000` by default. If the MongoDB connection cannot be established, the server reports the startup error and exits.

## Book fields

| Field | Type | Rules |
|---|---|---|
| `title` | String | Required, non-empty |
| `author` | String | Required, non-empty |
| `isbn` | String | Required, non-empty, unique |
| `category` | String | Required, non-empty |
| `quantity` | Number | Required, finite, non-negative |
| `available` | Boolean | Optional; defaults to `true` |
| `description` | String | Optional; up to 500 characters |
| `coverImage` | String | Optional HTTP(S) image URL; if omitted, the dashboard looks up a cover by ISBN |
| `createdAt` | Date | Automatically set by Mongoose |
| `updatedAt` | Date | Automatically set by Mongoose |

## API endpoints

All book endpoints use JSON. Successful creation returns `201 Created`; successful retrieval, update, and deletion return `200 OK`. Invalid input or IDs return `400 Bad Request`, duplicate ISBNs return `409 Conflict`, and missing books return `404 Not Found`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | Library dashboard |
| `GET` | `/api/health` | Database health status |
| `POST` | `/api/books` | Add a book |
| `GET` | `/api/books` | Retrieve all books |
| `GET` | `/api/books/stats` | Collection totals for the dashboard |
| `GET` | `/api/books/categories` | List distinct book categories |
| `GET` | `/api/books/:id` | Retrieve one book |
| `PUT` | `/api/books/:id` | Update one or more book fields |
| `DELETE` | `/api/books/:id` | Delete a book |

## Test with Postman

Start the local server and set the request URL base to `http://localhost:3000`. For hosted deployment, replace that base with your Render service URL.

For both `POST` and `PUT`, select **Body → raw**, then choose **JSON** from the format dropdown. Postman will send the request as JSON.

### 1. Add a book

- Method: `POST`
- URL: `http://localhost:3000/api/books`
- Body → raw → JSON:

```json
{
  "title": "Introduction to Algorithms",
  "author": "Thomas H. Cormen",
  "isbn": "9780131103627",
  "category": "Computer Science",
  "quantity": 5,
  "available": true
}
```

Expected: `201 Created`, with the stored book, generated `_id`, `createdAt`, and `updatedAt`:

```json
{
  "_id": "67a123456789012345678901",
  "title": "Introduction to Algorithms",
  "author": "Thomas H. Cormen",
  "isbn": "9780131103627",
  "category": "Computer Science",
  "quantity": 5,
  "available": true,
  "createdAt": "2025-02-04T10:00:00.000Z",
  "updatedAt": "2025-02-04T10:00:00.000Z",
  "__v": 0
}
```

The example `_id` and dates are illustrative; MongoDB generates the actual values. Copy the `_id` from your response. Replace `BOOK_ID` with it in the single-book GET, PUT, and DELETE URLs below.

### 2. Retrieve all books

- Method: `GET`
- URL: `http://localhost:3000/api/books`
- Expected: `200 OK`, with a JSON array (possibly empty):

```json
[
  {
    "_id": "67a123456789012345678901",
    "title": "Introduction to Algorithms",
    "author": "Thomas H. Cormen",
    "isbn": "9780131103627",
    "category": "Computer Science",
    "quantity": 5,
    "available": true,
    "createdAt": "2025-02-04T10:00:00.000Z",
    "updatedAt": "2025-02-04T10:00:00.000Z",
    "__v": 0
  }
]
```

### 3. Retrieve one book by ID

- Method: `GET`
- URL: `http://localhost:3000/api/books/BOOK_ID`
- Replace `BOOK_ID` with the copied `_id`.
- Expected: `200 OK` and the book object. An unknown valid ID returns `404 Not Found`.

### 4. Update a book

- Method: `PUT`
- URL: `http://localhost:3000/api/books/BOOK_ID`
- Body → raw → JSON. Send one or more fields; omitted fields are unchanged:

```json
{
  "quantity": 8,
  "available": true
}
```

- Expected: `200 OK` and the updated book object. Mongoose refreshes `updatedAt`.

### 5. Delete a book

- Method: `DELETE`
- URL: `http://localhost:3000/api/books/BOOK_ID`
- Expected: `200 OK`:

```json
{
  "message": "Book deleted successfully",
  "id": "67a123456789012345678901"
}
```

Deleting a book that does not exist returns `404 Not Found`.

### 6. Check API and database status

- Method: `GET`
- URL: `http://localhost:3000/api/health`
- Expected: `200 OK`:

```json
{
  "status": "ok",
  "database": "connected"
}
```

### 7. Test invalid input

Send a `POST` to `/api/books` with Body → raw → JSON:

```json
{
  "title": " ",
  "author": "An Author",
  "isbn": "9780000000001",
  "category": "Computer Science",
  "quantity": -1
}
```

Expected: `400 Bad Request` with a message explaining the invalid title or quantity. For an invalid `available` value, use a non-boolean such as `"true"` and expect `400 Bad Request`.

### 8. Test a duplicate ISBN

Send the create-book request again with an ISBN already stored, such as `9780131103627`.

Expected: `409 Conflict`:

```json
{
  "message": "A book with this ISBN already exists"
}
```

### 9. Test an invalid or nonexistent book ID

- Invalid format: request `GET http://localhost:3000/api/books/not-an-id` and expect `400 Bad Request`.
- Nonexistent valid ID: request `GET http://localhost:3000/api/books/000000000000000000000000` and expect `404 Not Found`:

```json
{
  "message": "Book not found"
}
```

The same ID validation and not-found behavior applies to `PUT` and `DELETE`.

## Frontend dashboard

After starting the server, open `http://localhost:3000` in a browser. The dashboard includes:

- Collection overview and recently added titles
- Search by title, author, ISBN, or category
- Category and availability filters, with pagination
- Book detail, create, edit, and delete confirmation views
- A responsive sidebar for smaller screens

Book forms include an optional description. The dashboard uses the same REST API and MongoDB data as Postman. The profile shown is a workspace label, not an authentication system; no login or user authorization is implemented.

On first startup, five sample books are added only when the database collection is empty. Book covers are shown on the dashboard, in the book list, and on each book's detail page. When adding a book, paste an optional HTTP(S) cover image URL; if the field is blank, the dashboard tries to find a cover using the book's ISBN and displays a local placeholder if no cover is available.

## Deploy to Render

1. Push this project to a GitHub repository. Ensure `.env` is not committed; `.gitignore` excludes it.
2. In Render, create a **Web Service** connected to the repository.
3. Set the **Root Directory** to `library-management-api` if this project is inside a larger repository.
4. Set **Build Command** to `npm install` and **Start Command** to `npm start`.
5. Add environment variables in Render's service settings:
   - `MONGODB_URI`: your MongoDB Atlas connection string
   - `NODE_ENV`: `production` (optional)
6. If the database user's password contains reserved URI characters, URL-encode them in `MONGODB_URI` before saving it in Render. For example, replace `@` with `%40` in the password portion. Do not put database credentials in source files or commit `.env`.
7. In MongoDB Atlas, allow the Render service to connect through the cluster's network access settings. For production, use a suitably restricted network policy and a dedicated database user.
8. Deploy. Render supplies the `PORT` environment variable automatically. Open the service URL for the frontend and test `/api/health` and the `/api/books` endpoints.

If Render logs show `querySrv ENOTFOUND` with a fragment of your password as the hostname, check that reserved characters in the Render `MONGODB_URI` are percent-encoded. Update the value in the Render dashboard and redeploy; changing your local `.env` does not change Render's environment variables.

## Project structure

```text
library-management-api/
├── models/
│   └── Book.js
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── routes/
│   └── books.js
├── .env
├── .gitignore
├── package.json
├── README.md
└── server.js
```
