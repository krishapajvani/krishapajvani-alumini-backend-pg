// ================= STATE =================
const STORAGE_KEY = "employees";
let formConfig = [];
let employees = [];
let isBulkEditing = false;
let insertFormCounter = 0;

const $ = (id) => document.getElementById(id);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ================= DATA LAYER =================
async function loadData() {
  formConfig = await (await fetch("employeeForm.json")).json();
  const saved = localStorage.getItem(STORAGE_KEY);
  employees = saved ? JSON.parse(saved) : await (await fetch("employees.json")).json();
}
const saveData = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));

function generateId(currentEmployees = employees) {
  const max = currentEmployees.reduce((m, e) => Math.max(m, parseInt(String(e.employeeId).replace(/\D/g, "")) || 0), 0);
  return "EMP" + String(max + 1).padStart(3, "0");
}

// ================= VALIDATION =================
function validate(d, editId = null, existingPool = employees) {
  const e = {};
  formConfig.forEach((f) => {
    const skip = editId && f.type === "password";
    if (f.required && !d[f.name] && !skip) e[f.name] = "Required";
  });

  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = "Invalid email";
  if (d.mobile && !/^\d{10}$/.test(d.mobile)) e.mobile = "10 digits required";

  if (d.password || !editId) {
    if (d.password && d.password.length < 6) e.password = "Min 6 chars";
    if (d.password !== d.confirmPassword && !editId) e.confirmPassword ||= "Mismatch";
  }

  const others = existingPool.filter((x) => x.employeeId !== editId);
  if (d.employeeId && others.some((x) => x.employeeId.toLowerCase() === d.employeeId.toLowerCase())) {
    e.employeeId = "Duplicate ID";
  }
  if (d.email && others.some((x) => x.email.toLowerCase() === d.email.toLowerCase())) {
    e.email ||= "Email exists";
  }

  return e;
}

// ================= 1. BULK INSERT SECTION =================
function createFieldHTML(f, formIndex) {
  const fieldId = `field_${formIndex}_${f.name}`;
  let input;

  if (f.type === "select") {
    input = `<select id="${fieldId}" name="${f.name}">
      <option value="">Select ${f.label}</option>
      ${(f.options || []).map((o) => `<option value="${o}">${o}</option>`).join("")}
    </select>`;
  } else if (f.type === "radio") {
    input = `<div class="radios">
      ${(f.options || []).map((o) => `
        <label><input type="radio" name="${f.name}_${formIndex}" value="${o}"> ${o}</label>
      `).join("")}
    </div>`;
  } else {
    input = `<input type="${f.type}" id="${fieldId}" name="${f.name}" ${f.type === "file" ? 'accept="image/*"' : ""}>`;
  }

  return `
    <div class="field" data-field="${f.name}">
      <label for="${fieldId}">${f.label}${f.required ? " *" : ""}</label>
      ${input}
      <small class="error"></small>
    </div>
  `;
}

function addEmployeeFormBlock() {
  insertFormCounter++;
  const container = $("formsContainer");
  const formDiv = document.createElement("div");
  formDiv.className = "employee-entry-block";
  formDiv.dataset.formIndex = insertFormCounter;

  const currentCount = container.children.length + 1;
  formDiv.innerHTML = `
    <div class="entry-header">
      <span class="entry-title">Employee Form #${currentCount}</span>
      ${container.children.length > 0 ? `<button type="button" class="danger remove-form-btn">Remove</button>` : ""}
    </div>
    <div class="form-grid">
      ${formConfig.map((f) => createFieldHTML(f, insertFormCounter)).join("")}
    </div>
  `;

  if (container.children.length > 0) {
    formDiv.querySelector(".remove-form-btn").addEventListener("click", () => {
      formDiv.remove();
      updateFormTitles();
    });
  }

  container.appendChild(formDiv);
}

function updateFormTitles() {
  const forms = $("formsContainer").querySelectorAll(".employee-entry-block");
  forms.forEach((form, idx) => {
    form.querySelector(".entry-title").textContent = `Employee Form #${idx + 1}`;
  });
}

function resetInsertForms() {
  $("formsContainer").innerHTML = "";
  insertFormCounter = 0;
  addEmployeeFormBlock();
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) return resolve("");
    if (file.size > 200 * 1024) return reject("Photo max 200KB");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// Bulk Insert Submission
$("bulkInsertForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formBlocks = Array.from($("formsContainer").querySelectorAll(".employee-entry-block"));
  const newEmployees = [];
  let hasErrors = false;
  let tempPool = [...employees];

  for (const block of formBlocks) {
    const fIdx = block.dataset.formIndex;
    const data = {};

    formConfig.forEach((f) => {
      if (f.type === "radio") {
        const checked = block.querySelector(`input[name="${f.name}_${fIdx}"]:checked`);
        data[f.name] = checked ? checked.value : "";
      } else if (f.type === "file") {
        const fileInput = block.querySelector(`input[name="${f.name}"]`);
        data._file = fileInput ? fileInput.files[0] : null;
      } else {
        const input = block.querySelector(`[name="${f.name}"]`);
        data[f.name] = input ? input.value.trim() : "";
      }
    });

    if (data._file) {
      try {
        data.photo = await readPhoto(data._file);
      } catch (err) {
        hasErrors = true;
        const errEl = block.querySelector(`[data-field="photo"] .error`);
        if (errEl) errEl.textContent = err;
      }
    } else {
      data.photo = "";
    }
    delete data._file;

    // Validate
    const errs = validate(data, null, tempPool);
    block.querySelectorAll(".field").forEach((box) => {
      const fieldName = box.dataset.field;
      const msg = errs[fieldName] || "";
      box.classList.toggle("invalid", !!msg);
      box.querySelector(".error").textContent = msg;
    });

    if (Object.keys(errs).length > 0) {
      hasErrors = true;
    } else {
      if (!data.employeeId) data.employeeId = generateId(tempPool);
      delete data.confirmPassword;
      tempPool.push(data);
      newEmployees.push(data);
    }
  }

  if (hasErrors) {
    return toast("Please resolve errors across all forms before bulk inserting", "error");
  }

  employees.push(...newEmployees);
  saveData();
  toast(`Bulk Insert successful! Added ${newEmployees.length} employee(s).`);
  resetInsertForms();
  renderEmployeeList();
});

$("addMoreBtn").addEventListener("click", () => addEmployeeFormBlock());
$("resetInsertBtn").addEventListener("click", resetInsertForms);

// ================= 2 & 5. ALL EMPLOYEES: EDITABLE VIEW & CARDS =================
function renderEmployeeList(list = employees) {
  const container = $("employeeList");

  if (!list.length) {
    container.innerHTML = `<div class="empty-msg">No employees found.</div>`;
    updateBulkControls();
    return;
  }

  container.innerHTML = list.map((emp) => {
    return `
      <div class="emp-card" data-id="${esc(emp.employeeId)}">
        <!-- 5. Checkbox on the far left -->
        <input type="checkbox" class="row-select" data-id="${esc(emp.employeeId)}">

        <!-- Profile photo -->
        <div class="emp-avatar-wrap">
          ${emp.photo ? `<img src="${emp.photo}" class="avatar" alt="">` : `<div class="avatar"></div>`}
        </div>

        <!-- Editable employee inputs (Direct HTML Controls, not static text) -->
        <div class="emp-controls-grid">
          <div class="ctrl-item">
            <label>ID</label>
            <input type="text" data-key="employeeId" value="${esc(emp.employeeId)}" readonly>
          </div>
          <div class="ctrl-item">
            <label>Name</label>
            <input type="text" data-key="name" value="${esc(emp.name)}">
          </div>
          <div class="ctrl-item">
            <label>Email</label>
            <input type="email" data-key="email" value="${esc(emp.email)}">
          </div>
          <div class="ctrl-item">
            <label>Mobile</label>
            <input type="tel" data-key="mobile" value="${esc(emp.mobile)}">
          </div>
          <div class="ctrl-item">
            <label>Password</label>
            <input type="password" data-key="password" value="${esc(emp.password || "")}" placeholder="••••••">
          </div>
          <div class="ctrl-item">
            <label>Gender</label>
            <select data-key="gender">
              <option value="Male" ${emp.gender === "Male" ? "selected" : ""}>Male</option>
              <option value="Female" ${emp.gender === "Female" ? "selected" : ""}>Female</option>
              <option value="Other" ${emp.gender === "Other" ? "selected" : ""}>Other</option>
            </select>
          </div>
          <div class="ctrl-item">
            <label>DOB</label>
            <input type="date" data-key="dob" value="${esc(emp.dob || "")}">
          </div>
          <div class="ctrl-item">
            <label>Department</label>
            <select data-key="department">
              ${["HR", "Engineering", "Finance", "Marketing", "Sales"].map(d => `
                <option value="${d}" ${emp.department === d ? "selected" : ""}>${d}</option>
              `).join("")}
            </select>
          </div>
          <div class="ctrl-item">
            <label>Designation</label>
            <select data-key="designation">
              ${["Manager", "Team Lead", "Developer", "Designer", "Analyst"].map(d => `
                <option value="${d}" ${emp.designation === d ? "selected" : ""}>${d}</option>
              `).join("")}
            </select>
          </div>
          <div class="ctrl-item">
            <label>Type</label>
            <select data-key="employmentType">
              ${["Full Time", "Part Time", "Intern", "Contract"].map(t => `
                <option value="${t}" ${emp.employmentType === t ? "selected" : ""}>${t}</option>
              `).join("")}
            </select>
          </div>
          <div class="ctrl-item file-input-wrap">
            <label>Photo</label>
            <input type="file" data-key="photo" accept="image/*">
          </div>
        </div>

        <!-- Individual Edit & Delete actions on the far right -->
        <div class="emp-actions">
          <button type="button" class="single-edit-btn" data-id="${esc(emp.employeeId)}">Edit</button>
          <button type="button" class="danger single-delete-btn" data-id="${esc(emp.employeeId)}">Delete</button>
        </div>
      </div>
    `;
  }).join("");

  updateBulkControls();
}

// ================= 3. BULK UPDATE SECTION =================
function toggleBulkEdit(active) {
  isBulkEditing = active;
  const listCard = document.querySelector(".list-section");
  listCard.classList.toggle("bulk-edit-mode", active);
  $("bulkEditBtn").hidden = active;
  $("bulkEditActions").hidden = !active;

  document.querySelectorAll(".emp-card").forEach((card) => {
    card.classList.toggle("is-editing", active);
  });
}

$("bulkEditBtn").addEventListener("click", () => toggleBulkEdit(true));
$("cancelBulkEditBtn").addEventListener("click", () => {
  toggleBulkEdit(false);
  renderEmployeeList(getFilteredEmployees());
});

$("saveBulkEditBtn").addEventListener("click", async () => {
  const cards = document.querySelectorAll(".emp-card");
  let hasErrors = false;
  const updatedRecords = [];

  for (const card of cards) {
    const id = card.dataset.id;
    const old = employees.find(e => e.employeeId === id);
    if (!old) continue;

    const data = { ...old };
    card.querySelectorAll("[data-key]").forEach((input) => {
      const key = input.dataset.key;
      if (key !== "photo") data[key] = input.value.trim();
    });

    const fileInput = card.querySelector('input[data-key="photo"]');
    if (fileInput && fileInput.files[0]) {
      try {
        data.photo = await readPhoto(fileInput.files[0]);
      } catch (err) {
        toast(err, "error");
        hasErrors = true;
      }
    }

    const errs = validate(data, id);
    if (Object.keys(errs).length > 0) {
      hasErrors = true;
      card.style.outline = "2px solid var(--danger)";
    } else {
      card.style.outline = "none";
      updatedRecords.push(data);
    }
  }

  if (hasErrors) {
    return toast("Validation failed on one or more rows. Please review inputs.", "error");
  }

  updatedRecords.forEach((rec) => {
    const idx = employees.findIndex((e) => e.employeeId === rec.employeeId);
    if (idx !== -1) employees[idx] = rec;
  });

  saveData();
  toggleBulkEdit(false);
  renderEmployeeList(getFilteredEmployees());
  toast(`Bulk update successful! Updated ${updatedRecords.length} records.`);
});

// ================= 4. BULK DELETE & SELECTION =================
function updateBulkControls() {
  const selectedBoxes = document.querySelectorAll(".row-select:checked");
  const count = selectedBoxes.length;
  const totalBoxes = document.querySelectorAll(".row-select");

  $("selectAllCheckbox").checked = totalBoxes.length > 0 && count === totalBoxes.length;
  $("selectAllCheckbox").indeterminate = count > 0 && count < totalBoxes.length;

  $("bulkDeleteBtn").disabled = count === 0;

  if (count > 0) {
    $("selectionBadge").hidden = false;
    $("selectedCountText").textContent = `${count} selected`;
  } else {
    $("selectionBadge").hidden = true;
  }

  // Row selection visual toggle
  document.querySelectorAll(".emp-card").forEach((card) => {
    const chk = card.querySelector(".row-select");
    card.classList.toggle("selected", chk && chk.checked);
  });
}

$("selectAllCheckbox").addEventListener("change", (e) => {
  const isChecked = e.target.checked;
  document.querySelectorAll(".row-select").forEach((chk) => {
    chk.checked = isChecked;
  });
  updateBulkControls();
});

$("bulkDeleteBtn").addEventListener("click", () => {
  const selectedBoxes = Array.from(document.querySelectorAll(".row-select:checked"));
  const idsToDelete = selectedBoxes.map((b) => b.dataset.id);
  const count = idsToDelete.length;

  if (!count) return;

  const confirmed = confirm(`Are you sure you want to delete ${count} selected employee(s)? This cannot be undone.`);
  if (!confirmed) return;

  employees = employees.filter((e) => !idsToDelete.includes(e.employeeId));
  saveData();
  toast(`Bulk Delete successful! Removed ${count} employee(s).`);
  renderEmployeeList(getFilteredEmployees());
});

// Row event listeners
$("employeeList").addEventListener("change", (e) => {
  if (e.target.classList.contains("row-select")) {
    updateBulkControls();
  }
});

$("employeeList").addEventListener("click", async (e) => {
  const delBtn = e.target.closest(".single-delete-btn");
  if (delBtn) {
    const id = delBtn.dataset.id;
    if (confirm(`Are you sure you want to delete employee ${id}?`)) {
      employees = employees.filter((x) => x.employeeId !== id);
      saveData();
      toast(`Deleted employee ${id}`);
      renderEmployeeList(getFilteredEmployees());
    }
    return;
  }

  const editBtn = e.target.closest(".single-edit-btn");
  if (editBtn) {
    const card = editBtn.closest(".emp-card");
    const id = editBtn.dataset.id;
    const isNowEditing = !card.classList.contains("is-editing");

    if (isNowEditing) {
      card.classList.add("is-editing");
      editBtn.textContent = "Save";
      editBtn.classList.add("primary");
    } else {
      // Save single row
      const old = employees.find(x => x.employeeId === id);
      const data = { ...old };
      card.querySelectorAll("[data-key]").forEach((input) => {
        if (input.dataset.key !== "photo") data[input.dataset.key] = input.value.trim();
      });

      const fileInput = card.querySelector('input[data-key="photo"]');
      if (fileInput && fileInput.files[0]) {
        try { data.photo = await readPhoto(fileInput.files[0]); } catch(err) { return toast(err, "error"); }
      }

      const errs = validate(data, id);
      if (Object.keys(errs).length) {
        return toast("Please fix validation errors on this row", "error");
      }

      const idx = employees.findIndex(x => x.employeeId === id);
      employees[idx] = data;
      saveData();
      toast(`Updated employee ${id}`);
      card.classList.remove("is-editing");
      editBtn.textContent = "Edit";
      editBtn.classList.remove("primary");
      renderEmployeeList(getFilteredEmployees());
    }
  }
});

// ================= SEARCH & EXPORT =================
function getFilteredEmployees() {
  const q = $("search").value.trim().toLowerCase();
  if (!q) return employees;
  return employees.filter((e) => [e.employeeId, e.name, e.email].some((v) => String(v).toLowerCase().includes(q)));
}

$("search").addEventListener("input", () => renderEmployeeList(getFilteredEmployees()));

$("exportBtn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(employees, null, 2)], { type: "application/json" }));
  link.download = "employees.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

// ================= TOAST =================
let toastTimer;
function toast(msg, type = "success") {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 3200);
}

// ================= INITIALIZATION =================
(async function init() {
  try {
    await loadData();
    resetInsertForms();
    renderEmployeeList();
  } catch (err) {
    document.querySelector("main").innerHTML = `
      <div class='card'>
        <h2>Error Loading Data</h2>
        <p>Could not load JSON files. Please run via a local server (e.g. Live Server or python -m http.server).</p>
      </div>`;
  }
})();