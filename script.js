// ================= STATE =================
const STORAGE_KEY = "employees";
let formConfig = [];      // loaded from employeeForm.json
let employees = [];       // loaded from employees.json (then kept in localStorage)
let editingId = null;     // null = add mode, otherwise the Employee ID being edited

const $ = (id) => document.getElementById(id);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ================= DATA LAYER (JSON) =================
async function loadData() {
  formConfig = await (await fetch("employeeForm.json")).json();
  const saved = localStorage.getItem(STORAGE_KEY);
  employees = saved ? JSON.parse(saved) : await (await fetch("employees.json")).json();
}
const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));

function generateId() {
  const max = employees.reduce((m, e) => Math.max(m, parseInt(e.employeeId.replace(/\D/g, "")) || 0), 0);
  return "EMP" + String(max + 1).padStart(3, "0");
}

// ================= VALIDATION =================
function validate(d, editId = null) {
  const e = {};
  formConfig.forEach((f) => {
    const skip = editId && f.type === "password";            // blank password = keep old one
    if (f.required && !d[f.name] && !skip) e[f.name] = "This field is required";
  });

  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = "Enter a valid email address";
  if (d.mobile && !/^\d{10}$/.test(d.mobile)) e.mobile = "Enter a valid 10-digit mobile number";

  if (d.password || !editId) {
    if (d.password && d.password.length < 6) e.password = "Password must be at least 6 characters";
    if (d.password !== d.confirmPassword) e.confirmPassword ||= "Passwords do not match";
  }

  const others = employees.filter((x) => x.employeeId !== editId);
  if (d.employeeId && others.some((x) => x.employeeId.toLowerCase() === d.employeeId.toLowerCase()))
    e.employeeId = "Employee ID already exists";
  if (d.email && others.some((x) => x.email.toLowerCase() === d.email.toLowerCase()))
    e.email ||= "Email is already registered";

  return e;
}

// ================= CRUD =================
function createEmployee(data) {
  const errors = validate(data);
  if (Object.keys(errors).length) return { ok: false, message: "Please fix the errors in the form", errors };

  const emp = { ...data, employeeId: data.employeeId || generateId() };
  delete emp.confirmPassword;
  employees.push(emp);
  saveData();
  return { ok: true, message: `Employee ${emp.employeeId} added successfully` };
}

const getAllEmployees = () => employees;

function getEmployeeById(id) {
  if (!id) return { ok: false, message: "Employee ID is missing" };
  const emp = employees.find((e) => e.employeeId === id);
  return emp ? { ok: true, data: emp } : { ok: false, message: "Employee not found" };
}

function updateEmployee(id, data) {
  const found = getEmployeeById(id);
  if (!found.ok) return found;

  const errors = validate(data, id);
  if (Object.keys(errors).length) return { ok: false, message: "Please fix the errors in the form", errors };

  const old = found.data;
  const updated = { ...old, ...data, employeeId: old.employeeId, password: data.password || old.password, photo: data.photo || old.photo };
  delete updated.confirmPassword;
  employees[employees.indexOf(old)] = updated;
  saveData();
  return { ok: true, message: `Employee ${id} updated successfully` };
}

function deleteEmployee(id) {
  const found = getEmployeeById(id);
  if (!found.ok) return found;
  employees = employees.filter((e) => e.employeeId !== id);
  saveData();
  return { ok: true, message: `Employee ${id} deleted successfully` };
}

function searchEmployees(text) {
  const q = text.trim().toLowerCase();
  return employees.filter((e) => [e.employeeId, e.name, e.email].some((v) => v.toLowerCase().includes(q)));
}

// ================= UI: FORM =================
function fieldHTML(f) {
  let input;
  if (f.type === "select")
    input = `<select name="${f.name}"><option value="">Select</option>${f.options.map((o) => `<option>${o}</option>`).join("")}</select>`;
  else if (f.type === "radio")
    input = `<div class="radios">${f.options.map((o) => `<label><input type="radio" name="${f.name}" value="${o}">${o}</label>`).join("")}</div>`;
  else
    input = `<input type="${f.type}" name="${f.name}" ${f.type === "file" ? 'accept="image/*"' : ""}>`;
  return `<div class="field" id="field-${f.name}"><label>${f.label}${f.required ? " *" : ""}</label>${input}<small class="error"></small></div>`;
}

function renderForm() {
  $("fields").innerHTML = formConfig.map(fieldHTML).join("");
}

function showErrors(errors = {}) {
  formConfig.forEach((f) => {
    const box = $("field-" + f.name);
    box.classList.toggle("invalid", !!errors[f.name]);
    box.querySelector(".error").textContent = errors[f.name] || "";
  });
}

function resetForm() {
  $("empForm").reset();
  editingId = null;
  $("formTitle").textContent = "Add Employee";
  $("submitBtn").textContent = "Add Employee";
  document.querySelector('[name="employeeId"]').readOnly = false;
  showErrors();
}

function startEdit(id) {
  const { ok, data, message } = getEmployeeById(id);
  if (!ok) return toast(message, "error");

  resetForm();
  editingId = id;
  formConfig.forEach((f) => {
    if (f.type === "file" || f.type === "password") return;
    if (f.type === "radio") {
      const r = document.querySelector(`[name="${f.name}"][value="${data[f.name]}"]`);
      if (r) r.checked = true;
    } else {
      document.querySelector(`[name="${f.name}"]`).value = data[f.name] || "";
    }
  });
  document.querySelector('[name="employeeId"]').readOnly = true;
  $("formTitle").textContent = "Update Employee " + id;
  $("submitBtn").textContent = "Update Employee";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ================= UI: TABLE & DETAILS =================
const avatar = (e) => (e.photo ? `<img class="avatar" src="${e.photo}" alt="">` : `<span class="avatar"></span>`);

function renderTable(list = getAllEmployees()) {
  $("tableBody").innerHTML = list.length
    ? list.map((e) => `
      <tr>
        <td>${avatar(e)}</td>
        <td>${esc(e.employeeId)}</td><td>${esc(e.name)}</td><td>${esc(e.email)}</td>
        <td>${esc(e.mobile)}</td><td>${esc(e.department)}</td>
        <td><div class="row-actions">
          <button data-act="view" data-id="${esc(e.employeeId)}">View</button>
          <button data-act="edit" data-id="${esc(e.employeeId)}">Edit</button>
          <button data-act="delete" data-id="${esc(e.employeeId)}" class="danger">Delete</button>
        </div></td>
      </tr>`).join("")
    : `<tr><td colspan="7" class="empty">No employees found</td></tr>`;
}

function showDetails(id) {
  const { ok, data, message } = getEmployeeById(id);
  if (!ok) return toast(message, "error");
  const rows = [["Employee ID", data.employeeId], ["Name", data.name], ["Email", data.email], ["Mobile", data.mobile],
    ["Gender", data.gender], ["Date of Birth", data.dob], ["Department", data.department],
    ["Designation", data.designation], ["Date of Joining", data.doj], ["Employment Type", data.employmentType]];
  $("details").hidden = false;
  $("details").innerHTML = `<h2>Employee Details</h2>${avatar(data)}<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
  $("details").scrollIntoView({ behavior: "smooth" });
}

let toastTimer;
function toast(msg, type = "success") {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 3000);
}

// ================= PHOTO =================
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) return resolve("");
    if (file.size > 200 * 1024) return reject("Photo must be smaller than 200KB");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// ================= EVENTS =================
$("empForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const raw = Object.fromEntries(new FormData(ev.target));
  const data = {};
  formConfig.forEach((f) => { if (f.type !== "file") data[f.name] = String(raw[f.name] || "").trim(); });

  try {
    data.photo = await readPhoto(raw.photo);
  } catch (msg) {
    showErrors({ photo: msg });
    return toast(msg, "error");
  }

  const result = editingId ? updateEmployee(editingId, data) : createEmployee(data);
  if (!result.ok) {
    showErrors(result.errors);
    return toast(result.message, "error");
  }
  toast(result.message);
  resetForm();
  renderTable();
});

$("resetBtn").addEventListener("click", resetForm);
$("search").addEventListener("input", (ev) => renderTable(searchEmployees(ev.target.value)));

$("tableBody").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn) return;
  const { act, id } = btn.dataset;
  if (act === "view") showDetails(id);
  if (act === "edit") startEdit(id);
  if (act === "delete" && confirm(`Delete employee ${id}?`)) {
    const result = deleteEmployee(id);
    toast(result.message, result.ok ? "success" : "error");
    if (editingId === id) resetForm();
    $("details").hidden = true;
    renderTable(searchEmployees($("search").value));
  }
});

// Browsers cannot write to a file directly, so this downloads the current data as employees.json
$("exportBtn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(employees, null, 2)], { type: "application/json" }));
  link.download = "employees.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

// ================= START =================
(async function init() {
  try {
    await loadData();
    renderForm();
    renderTable();
  } catch (err) {
    document.querySelector("main").innerHTML = "<p class='card'>Could not load JSON files. Run the project with a local server (e.g. VS Code Live Server).</p>";
  }
})();
