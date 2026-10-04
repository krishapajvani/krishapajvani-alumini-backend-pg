EMPLOYEE MANAGEMENT - Backend Task (JavaScript + JSON)
Task: task1-employee-registration-04-10-2026

HOW TO RUN
1. Open the folder in VS Code.
2. Right-click index.html -> "Open with Live Server".
   (Or run: npx serve   /   python -m http.server)
   A local server is required because the browser blocks fetch() on file:// URLs.

FILES
index.html        Page layout (form, search, table, details)
style.css         Responsive styling
script.js         All logic: CRUD, validation, search, display
employees.json    Starting (mock) database
employeeForm.json Form field definitions - the form is generated from this file

HOW DATA IS STORED
- First load reads employees.json.
- Changes are saved in the browser (localStorage) because browsers cannot write files.
- Click "Download JSON" to export the latest data as employees.json and replace the file.

CRUD FUNCTIONS (script.js)
createEmployee(data)      Create
getAllEmployees()         Read all
getEmployeeById(id)       Read by ID
updateEmployee(id, data)  Update
deleteEmployee(id)        Delete
searchEmployees(text)     Search by ID / Name / Email

VALIDATION & ERROR HANDLING
- Required fields
- Valid email format
- Valid mobile number (10 digits)
- Password min 6 characters and Confirm Password match
- Duplicate Employee ID / Duplicate Email
- Missing / invalid Employee ID, Employee not found (update, delete, view)
- Photo size limit (200KB)
- Success and error messages shown as toast notifications

NOTES
- Employee ID is auto-generated (EMP001, EMP002, ...) if left blank.
- Confirm Password is only used for validation and is not stored.
- Passwords are stored as plain text for learning only. Real apps must hash them.
