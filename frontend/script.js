/* ===================================================
   FaceAttend College Edition — script.js
   =================================================== */

const API = "";
let currentRole  = null;   // 'admin' | 'teacher'
let currentUser  = null;   // {id, name, email, role}
let allTeachers  = [];
let allStudents  = [];
let editingTeacherId  = null;
let editingStudentId  = null;
let assigningTeacherId = null;
let enrollStudentId   = null;
let enrollStream      = null;
let kioskStream       = null;
let kioskContext      = null;  // {branch, class_name, section}

// ── Gmail validation ─────────────────────────────────────────────────────────
const GMAIL_RE = /^[a-zA-Z0-9._%+\-]+@gmail\.com$/;
function isValidGmail(email) { return GMAIL_RE.test(email.trim().toLowerCase()); }

// ── Button loading helper ─────────────────────────────────────────────────────
function btnLoad(btn, text = "Please wait...") {
  btn.disabled = true;
  btn._orig = btn.innerHTML;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
}
function btnReset(btn) {
  btn.disabled = false;
  if (btn._orig) { btn.innerHTML = btn._orig; btn._orig = null; }
}

// ── API helper ────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Navigation ────────────────────────────────────────────────────────────────
function navigate(page) {
  const adminPages   = ["admin-dash","manage-teachers","manage-students","admin-reports"];
  const teacherPages = ["teacher-dash","teacher-reports"];
  const authPages    = ["kiosk"];

  if (adminPages.includes(page) && currentRole !== "admin") {
    showToast("Admin login required", "error"); page = "login";
  }
  if (teacherPages.includes(page) && currentRole !== "teacher") {
    showToast("Teacher login required", "error"); page = "login";
  }
  if (page === "kiosk" && !currentRole) {
    showToast("Please login first", "error"); page = "login";
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(l =>
    l.classList.toggle("active", l.dataset.page === page)
  );
  document.getElementById("navLinks").classList.remove("open");

  if (page === "admin-dash")       initAdminDash();
  if (page === "manage-structure") initManageStructure();
  if (page === "manage-teachers")  initManageTeachers();
  if (page === "manage-students")  initManageStudents();
  if (page === "admin-reports")    initAdminReports();
  if (page === "teacher-dash")     initTeacherDash();
  if (page === "teacher-reports")  initTeacherReports();
  if (page === "kiosk")            initKiosk();

  window.scrollTo(0, 0);
}
window.navigate = navigate;

document.querySelectorAll(".nav-link").forEach(l =>
  l.addEventListener("click", e => { e.preventDefault(); navigate(l.dataset.page); })
);
document.getElementById("hamburger").addEventListener("click", () =>
  document.getElementById("navLinks").classList.toggle("open")
);

// ── Dark mode ─────────────────────────────────────────────────────────────────
const themeBtn = document.getElementById("themeToggle");
themeBtn.addEventListener("click", () => {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
  themeBtn.innerHTML = dark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  localStorage.setItem("theme", dark ? "light" : "dark");
});
if (localStorage.getItem("theme") === "dark") {
  document.documentElement.setAttribute("data-theme", "dark");
  themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
}

// ── Login tabs ────────────────────────────────────────────────────────────────
let activeLoginTab = "admin";
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeLoginTab = tab.dataset.tab;
    const forgotRow = document.getElementById("forgotRow");
    if (forgotRow) forgotRow.style.display = activeLoginTab === "teacher" ? "" : "none";
    clearLoginErrors();
  });
});
// Hide forgot password for admin by default
document.addEventListener("DOMContentLoaded", () => {
  const fr = document.getElementById("forgotRow");
  if (fr) fr.style.display = "none";
});

document.getElementById("togglePw").addEventListener("click", function () {
  const pw = document.getElementById("loginPassword");
  pw.type = pw.type === "text" ? "password" : "text";
  this.innerHTML = pw.type === "text" ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
});

function togglePwField(inputId, btn) {
  const inp = document.getElementById(inputId);
  inp.type = inp.type === "text" ? "password" : "text";
  btn.innerHTML = inp.type === "text" ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}
window.togglePwField = togglePwField;

// Forgot password link
document.getElementById("forgotLink").addEventListener("click", e => {
  e.preventDefault();
  navigate("reset");
});

// ── Login form ────────────────────────────────────────────────────────────────
document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  clearLoginErrors();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const pw    = document.getElementById("loginPassword").value;

  if (!email) { setErr("emailError", "Email is required"); return; }
  if (!isValidGmail(email)) {
    setErr("emailError", "Please enter a valid Gmail address (must end with @gmail.com)");
    return;
  }
  if (!pw) { setErr("pwError", "Password is required"); return; }

  const btn = document.getElementById("loginSubmitBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

  try {
    const user = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: pw, role: activeLoginTab })
    });
    currentUser = user;
    currentRole = user.role;
    updateNav();
    showToast(`Welcome, ${user.name}!`, "success");
    if (user.role === "admin")   navigate("admin-dash");
    else                         navigate("teacher-dash");
  } catch (err) {
    const msg = err.message;
    if (msg.includes("password")) setErr("pwError", msg);
    else setErr("emailError", msg);
    showToast(msg, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In';
  }
});

function clearLoginErrors() {
  ["emailError","pwError"].forEach(id => setErr(id, ""));
  ["loginEmail","loginPassword"].forEach(id =>
    document.getElementById(id)?.classList.remove("error")
  );
}
function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function doLogout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  currentUser = null; currentRole = null;
  kioskStop();
  updateNav();
  navigate("login");
  showToast("Logged out");
}
window.doLogout = doLogout;
document.getElementById("logoutBtn").addEventListener("click", e => { e.preventDefault(); doLogout(); });

function updateNav() {
  const isAdmin   = currentRole === "admin";
  const isTeacher = currentRole === "teacher";
  const loggedIn  = !!currentRole;
  document.getElementById("navAdminDash").style.display   = isAdmin   ? "" : "none";
  document.getElementById("navTeacherDash").style.display = isTeacher ? "" : "none";
  document.getElementById("navKiosk").style.display       = loggedIn  ? "" : "none";
  document.getElementById("navLogin").style.display       = loggedIn  ? "none" : "";
  document.getElementById("navLogoutItem").style.display  = loggedIn  ? "" : "none";
}


// ── Reset Password ────────────────────────────────────────────────────────────
async function sendResetOtp() {
  const email = document.getElementById("resetEmail").value.trim().toLowerCase();
  setErr("resetEmailErr", "");
  if (!email) { setErr("resetEmailErr", "Email is required"); return; }
  if (!isValidGmail(email)) { setErr("resetEmailErr", "Only @gmail.com addresses accepted"); return; }
  const btn = document.querySelector("#resetStep1 .btn");
  btnLoad(btn, "Sending...");
  try {
    await api("/api/auth/send-otp", { method: "POST", body: JSON.stringify({ email }) });
    document.getElementById("resetEmailDisplay").textContent = email;
    document.getElementById("resetStep1").style.display = "none";
    document.getElementById("resetStep2").style.display = "";
    showToast("OTP sent to " + email, "success");
  } catch (err) {
    setErr("resetEmailErr", err.message);
    btnReset(btn);
  }
}
window.sendResetOtp = sendResetOtp;

async function doResetPassword() {
  const email   = document.getElementById("resetEmail").value.trim().toLowerCase();
  const otp     = document.getElementById("resetOtp").value.trim();
  const newPass = document.getElementById("resetNewPw").value;
  setErr("resetOtpErr", ""); setErr("resetNewPwErr", "");
  if (!otp)     { setErr("resetOtpErr", "OTP is required"); return; }
  if (otp.length !== 6) { setErr("resetOtpErr", "OTP must be 6 digits"); return; }
  if (!newPass) { setErr("resetNewPwErr", "New password is required"); return; }
  if (newPass.length < 6) { setErr("resetNewPwErr", "Password must be at least 6 characters"); return; }
  const btn = document.querySelector("#resetStep2 .btn-primary");
  btnLoad(btn, "Resetting...");
  try {
    const res = await api("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, new_password: newPass })
    });
    showToast(res.message, "success");
    navigate("login");
  } catch (err) {
    setErr("resetOtpErr", err.message);
    btnReset(btn);
  }
}
window.doResetPassword = doResetPassword;

// ── Admin Dashboard ───────────────────────────────────────────────────────────
let adminTodayAll = [];

async function initAdminDash() {
  document.getElementById("adminDashDate").textContent = formatDate(new Date());
  if (currentUser) document.getElementById("adminSidebarName").textContent = currentUser.name;
  try {
    const [stats, today, teachers, students] = await Promise.all([
      api("/api/attendance/stats"),
      api("/api/attendance/today"),
      api("/api/teachers"),
      api("/api/students")
    ]);
    document.getElementById("statTeachers").textContent = teachers.length;
    document.getElementById("statStudents").textContent = students.length;
    document.getElementById("statPresent").textContent  = stats.present_today;
    document.getElementById("statAbsent").textContent   = stats.absent_today;
    adminTodayAll = today;
    populateAdminFilters(today);
    renderAdminSummary(today);
  } catch (e) { console.error(e); }
}

function populateAdminFilters(records) {
  const branches = [...new Set(records.map(r => r.branch))].sort();
  const classes  = [...new Set(records.map(r => r.class_name))].sort();
  const sections = [...new Set(records.map(r => r.section))].sort();
  fillSelect("adminFilterBranch",  branches,  "All Branches");
  fillSelect("adminFilterClass",   classes,   "All Classes");
  fillSelect("adminFilterSection", sections,  "All Sections");
}

function adminFilterClass() {
  const branch  = document.getElementById("adminFilterBranch").value;
  const cls     = document.getElementById("adminFilterClass").value;
  const section = document.getElementById("adminFilterSection").value;
  const filtered = adminTodayAll.filter(r =>
    (!branch  || r.branch === branch) &&
    (!cls     || r.class_name === cls) &&
    (!section || r.section === section)
  );
  renderAdminSummary(filtered);
}
window.adminFilterClass = adminFilterClass;

function renderAdminSummary(records) {
  const tbody = document.getElementById("adminSummaryTable");
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:20px">No attendance records today</td></tr>';
    return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.name}</td><td>${r.roll_no}</td><td>${r.branch}</td>
      <td>${r.class_name}</td><td>${r.section}</td><td>${r.time_in}</td>
      <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
    </tr>
  `).join("");
}

// ── Manage Teachers ───────────────────────────────────────────────────────────
async function initManageTeachers() {
  await loadTeachers();
  renderTeachersTable();
}

async function loadTeachers() {
  try { allTeachers = await api("/api/teachers"); }
  catch (e) { showToast("Failed to load teachers", "error"); }
}

function renderTeachersTable() {
  const q     = (document.getElementById("teacherSearch")?.value || "").toLowerCase();
  const tbody = document.getElementById("teachersTableBody");
  if (!tbody) return;
  const list = allTeachers.filter(t =>
    t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
  );
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:20px">No teachers found</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(t => `
    <tr>
      <td>${t.name}</td>
      <td>${t.email}</td>
      <td><span style="color:var(--text2);font-size:0.82rem">${t.assignment_count} class${t.assignment_count !== 1 ? 'es' : ''}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn btn-edit" onclick="openAssignPanel(${t.id},'${escHtml(t.name)}')"><i class="fas fa-link"></i> Assign</button>
          <button class="btn btn-danger" onclick="deleteTeacher(${t.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join("");
}
window.renderTeachersTable = renderTeachersTable;

async function sendTeacherOtp() {
  const email = document.getElementById("tEmail").value.trim().toLowerCase();
  setErr("tEmailErr", "");
  if (!email) { setErr("tEmailErr", "Email is required"); return; }
  if (!isValidGmail(email)) { setErr("tEmailErr", "Only @gmail.com addresses are accepted"); return; }
  const btn = document.querySelector("#teacherForm .btn-outline");
  btnLoad(btn, "Sending...");
  try {
    await api("/api/teachers/send-verify-otp", { method: "POST", body: JSON.stringify({ email }) });
    document.getElementById("tOtpGroup").style.display = "";
    showToast("OTP sent to " + email, "success");
  } catch (err) { setErr("tEmailErr", err.message); }
  finally { btnReset(btn); }
}
window.sendTeacherOtp = sendTeacherOtp;

document.getElementById("teacherForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name  = document.getElementById("tName").value.trim();
  const email = document.getElementById("tEmail").value.trim().toLowerCase();
  const otp   = document.getElementById("tOtp").value.trim();
  setErr("tNameErr",""); setErr("tEmailErr",""); setErr("tOtpErr","");
  if (!name)  { setErr("tNameErr",  "Name is required"); return; }
  if (!email) { setErr("tEmailErr", "Email is required"); return; }
  if (!isValidGmail(email)) { setErr("tEmailErr", "Only @gmail.com addresses accepted"); return; }
  if (!otp)   { setErr("tOtpErr",   "OTP is required — click Send OTP first"); return; }
  const btn = document.getElementById("teacherFormBtn");
  btnLoad(btn, "Creating...");
  try {
    const res = await api("/api/teachers", { method: "POST", body: JSON.stringify({ name, email, otp }) });
    showToast(res.message, "success");
    resetTeacherForm();
    await loadTeachers(); renderTeachersTable();
  } catch (err) { showToast(err.message, "error"); btnReset(btn); }
});

function resetTeacherForm() {
  editingTeacherId = null;
  document.getElementById("teacherForm").reset();
  document.getElementById("tOtpGroup").style.display = "none";
  document.getElementById("assignSection").style.display = "none";
  ["tNameErr","tEmailErr","tOtpErr"].forEach(id => setErr(id, ""));
}
window.resetTeacherForm = resetTeacherForm;

async function deleteTeacher(tid) {
  if (!confirm("Delete this teacher and all their assignments?")) return;
  try {
    await api(`/api/teachers/${tid}`, { method: "DELETE" });
    showToast("Teacher deleted", "error");
    await loadTeachers(); renderTeachersTable();
  } catch (err) { showToast(err.message, "error"); }
}
window.deleteTeacher = deleteTeacher;

async function openAssignPanel(tid, name) {
  assigningTeacherId = tid;
  document.getElementById("assignTeacherName").textContent = name;
  document.getElementById("assignSection").style.display = "";
  // Load branch dropdown
  await loadAssignBranchDropdown();
  await loadAssignments(tid);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.openAssignPanel = openAssignPanel;

async function loadAssignBranchDropdown() {
  try {
    const branches = await api("/api/structure/branches");
    const sel = document.getElementById("assignBranch");
    sel.innerHTML = '<option value="">-- Select Branch --</option>' +
      branches.map(b => `<option value="${b}">${b}</option>`).join("");
    const clsSel = document.getElementById("assignClass");
    const secSel = document.getElementById("assignSection2");
    clsSel.innerHTML = '<option value="">-- Select Class --</option>'; clsSel.disabled = true;
    secSel.innerHTML = '<option value="">-- Select Section --</option>'; secSel.disabled = true;
  } catch (e) { console.error(e); }
}

async function onAssignBranchChange() {
  const branch = document.getElementById("assignBranch").value;
  const clsSel = document.getElementById("assignClass");
  const secSel = document.getElementById("assignSection2");
  clsSel.innerHTML = '<option value="">-- Select Class --</option>'; clsSel.disabled = true;
  secSel.innerHTML = '<option value="">-- Select Section --</option>'; secSel.disabled = true;
  if (!branch) return;
  try {
    const classes = await api(`/api/structure/classes?branch=${encodeURIComponent(branch)}`);
    clsSel.innerHTML = '<option value="">-- Select Class --</option>' +
      classes.map(c => `<option value="${c}">${c}</option>`).join("");
    clsSel.disabled = false;
  } catch (e) { console.error(e); }
}
window.onAssignBranchChange = onAssignBranchChange;

async function onAssignClassChange() {
  const branch = document.getElementById("assignBranch").value;
  const cls    = document.getElementById("assignClass").value;
  const secSel = document.getElementById("assignSection2");
  secSel.innerHTML = '<option value="">-- Select Section --</option>'; secSel.disabled = true;
  if (!branch || !cls) return;
  try {
    const sections = await api(`/api/structure/sections?branch=${encodeURIComponent(branch)}&class_name=${encodeURIComponent(cls)}`);
    secSel.innerHTML = '<option value="">-- Select Section --</option>' +
      sections.map(s => `<option value="${s}">${s}</option>`).join("");
    secSel.disabled = false;
  } catch (e) { console.error(e); }
}
window.onAssignClassChange = onAssignClassChange;

async function loadAssignments(tid) {
  try {
    const list = await api(`/api/teachers/${tid}/assignments`);
    const el   = document.getElementById("assignmentsList");
    if (!list.length) { el.innerHTML = '<p style="color:var(--text2);font-size:0.85rem">No assignments yet</p>'; return; }
    el.innerHTML = list.map(a => `
      <span class="assignment-tag">
        ${a.branch} — ${a.class_name} — Sec ${a.section}
        <button onclick="removeAssignment(${tid},${a.id})" title="Remove"><i class="fas fa-xmark"></i></button>
      </span>
    `).join("");
  } catch (e) { console.error(e); }
}

async function addAssignment() {
  if (!assigningTeacherId) return;
  const branch = document.getElementById("assignBranch").value;
  const cls    = document.getElementById("assignClass").value;
  const sec    = document.getElementById("assignSection2").value;
  if (!branch || !cls || !sec) { showToast("Select branch, class and section", "error"); return; }
  const btn = document.querySelector("#assignSection .btn-primary");
  if (btn) btnLoad(btn, "Assigning...");
  try {
    await api(`/api/teachers/${assigningTeacherId}/assignments`, {
      method: "POST",
      body: JSON.stringify({ branch, class_name: cls, section: sec })
    });
    showToast("Assignment added", "success");
    await loadAssignBranchDropdown();
    await loadAssignments(assigningTeacherId);
    await loadTeachers(); renderTeachersTable();
  } catch (err) { showToast(err.message, "error"); }
  finally { if (btn) btnReset(btn); }
}
window.addAssignment = addAssignment;

async function removeAssignment(tid, aid) {
  try {
    await api(`/api/teachers/${tid}/assignments/${aid}`, { method: "DELETE" });
    showToast("Assignment removed", "error");
    await loadAssignments(tid);
    await loadTeachers(); renderTeachersTable();
  } catch (err) { showToast(err.message, "error"); }
}
window.removeAssignment = removeAssignment;


// ── Manage Students ───────────────────────────────────────────────────────────
async function initManageStudents() {
  await loadStudents();
  await loadStudentBranchDropdown();
  populateStudentFilters();
  renderStudentsTable();
}

async function loadStudents() {
  try { allStudents = await api("/api/students"); }
  catch (e) { showToast("Failed to load students", "error"); }
}

function populateStudentFilters() {
  const branches = [...new Set(allStudents.map(s => s.branch))].sort();
  const classes  = [...new Set(allStudents.map(s => s.class_name))].sort();
  const sections = [...new Set(allStudents.map(s => s.section))].sort();
  fillSelect("sFilterBranch",  branches,  "All Branches");
  fillSelect("sFilterClass",   classes,   "All Classes");
  fillSelect("sFilterSection", sections,  "All Sections");
}

function renderStudentsTable() {
  const q       = (document.getElementById("studentSearch")?.value || "").toLowerCase();
  const branch  = document.getElementById("sFilterBranch")?.value  || "";
  const cls     = document.getElementById("sFilterClass")?.value   || "";
  const section = document.getElementById("sFilterSection")?.value || "";
  const tbody   = document.getElementById("studentsTableBody");
  if (!tbody) return;

  const list = allStudents.filter(s =>
    (!branch  || s.branch === branch) &&
    (!cls     || s.class_name === cls) &&
    (!section || s.section === section) &&
    (!q || s.name.toLowerCase().includes(q) || s.roll_no.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
  );

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:20px">No students found</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(s => `
    <tr>
      <td>${s.name}</td><td>${s.roll_no}</td><td>${s.branch}</td>
      <td>${s.class_name}</td><td>${s.section}</td>
      <td>
        ${s.sample_count > 0
          ? `<span class="face-enrolled-badge"><i class="fas fa-check"></i> ${s.sample_count}</span>`
          : `<span class="face-none-badge"><i class="fas fa-xmark"></i> None</span>`}
      </td>
      <td>
        <div class="action-btns">
          <button class="btn btn-edit" onclick="editStudent(${s.id})"><i class="fas fa-pen"></i></button>
          <button class="btn btn-primary" style="background:var(--teal);border-color:var(--teal);padding:6px 10px;font-size:0.8rem" onclick="openEnrollModal(${s.id},'${escHtml(s.name)}')"><i class="fas fa-face-smile"></i> Enroll</button>
          <button class="btn btn-outline" style="padding:6px 10px;font-size:0.8rem" onclick="openImagesModal(${s.id},'${escHtml(s.name)}')" ${s.image_count > 0 ? "" : "disabled"}><i class="fas fa-images"></i></button>
          <button class="btn btn-danger" onclick="deleteStudent(${s.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join("");
}
window.renderStudentsTable = renderStudentsTable;

async function sendStudentOtp() {
  const email = document.getElementById("sEmail").value.trim().toLowerCase();
  setErr("sEmailErr", "");
  if (!email) { setErr("sEmailErr", "Email is required"); return; }
  if (!isValidGmail(email)) { setErr("sEmailErr", "Only @gmail.com addresses are accepted"); return; }
  const btn = document.querySelector("#studentForm .btn-outline[onclick='sendStudentOtp()']") ||
              document.querySelector("#studentForm button[onclick='sendStudentOtp()']");
  if (btn) btnLoad(btn, "Sending...");
  try {
    await api("/api/students/send-verify-otp", { method: "POST", body: JSON.stringify({ email }) });
    document.getElementById("sOtpGroup").style.display = "";
    showToast("OTP sent to " + email, "success");
  } catch (err) { setErr("sEmailErr", err.message); }
  finally { if (btn) btnReset(btn); }
}
window.sendStudentOtp = sendStudentOtp;

document.getElementById("studentForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name    = document.getElementById("sName").value.trim();
  const roll    = document.getElementById("sRoll").value.trim();
  const email   = document.getElementById("sEmail").value.trim().toLowerCase();
  const otp     = document.getElementById("sOtp").value.trim();
  const branch  = document.getElementById("sBranch").value.trim().toUpperCase();
  const cls     = document.getElementById("sClass").value.trim();
  const section = document.getElementById("sSection").value.trim().toUpperCase();

  ["sNameErr","sRollErr","sEmailErr","sOtpErr","sBranchErr","sClassErr","sSectionErr"].forEach(id => setErr(id,""));

  let ok = true;
  if (!name)    { setErr("sNameErr",    "Required"); ok = false; }
  if (!roll)    { setErr("sRollErr",    "Required"); ok = false; }
  if (!email)   { setErr("sEmailErr",   "Required"); ok = false; }
  else if (!isValidGmail(email)) { setErr("sEmailErr", "Only @gmail.com accepted"); ok = false; }
  if (!otp)     { setErr("sOtpErr",     "OTP required — click Send OTP first"); ok = false; }
  if (!branch)  { setErr("sBranchErr",  "Required"); ok = false; }
  if (!cls)     { setErr("sClassErr",   "Required"); ok = false; }
  if (!section) { setErr("sSectionErr", "Required"); ok = false; }
  if (!ok) return;

  const submitBtn = document.getElementById("studentFormBtn");
  btnLoad(submitBtn, "Saving...");
  if (editingStudentId) {
    try {
      await api(`/api/students/${editingStudentId}`, {
        method: "PUT",
        body: JSON.stringify({ name, roll_no: roll, email, branch, class_name: cls, section })
      });
      showToast("Student updated", "success");
      resetStudentForm();
      await loadStudents(); populateStudentFilters(); renderStudentsTable();
    } catch (err) { showToast(err.message, "error"); btnReset(submitBtn); }
  } else {
    try {
      await api("/api/students", {
        method: "POST",
        body: JSON.stringify({ roll_no: roll, name, email, branch, class_name: cls, section, otp })
      });
      showToast("Student added", "success");
      resetStudentForm();
      await loadStudents(); populateStudentFilters(); renderStudentsTable();
    } catch (err) { showToast(err.message, "error"); btnReset(submitBtn); }
  }
});

async function editStudent(sid) {
  const s = allStudents.find(x => x.id === sid);
  if (!s) return;
  editingStudentId = sid;
  document.getElementById("sName").value  = s.name;
  document.getElementById("sRoll").value  = s.roll_no;
  document.getElementById("sEmail").value = s.email;
  document.getElementById("sOtpGroup").style.display = "none";
  document.getElementById("studentFormTitle").innerHTML = '<i class="fas fa-pen"></i> Edit Student';
  document.getElementById("studentFormBtn").innerHTML   = '<i class="fas fa-save"></i> Save Changes';

  // Set cascading dropdowns
  await loadStudentBranchDropdown();
  document.getElementById("sBranch").value = s.branch;
  await onStudentBranchChange();
  document.getElementById("sClass").value = s.class_name;
  await onStudentClassChange();
  document.getElementById("sSection").value = s.section;

  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.editStudent = editStudent;

async function deleteStudent(sid) {
  if (!confirm("Delete this student and all their attendance records?")) return;
  try {
    await api(`/api/students/${sid}`, { method: "DELETE" });
    showToast("Student deleted", "error");
    await loadStudents(); populateStudentFilters(); renderStudentsTable();
  } catch (err) { showToast(err.message, "error"); }
}
window.deleteStudent = deleteStudent;

function resetStudentForm() {
  editingStudentId = null;
  document.getElementById("studentForm").reset();
  document.getElementById("sOtpGroup").style.display = "none";
  document.getElementById("studentFormTitle").innerHTML = '<i class="fas fa-user-plus"></i> Add New Student';
  document.getElementById("studentFormBtn").innerHTML   = '<i class="fas fa-plus"></i> Add Student';
  ["sNameErr","sRollErr","sEmailErr","sOtpErr","sBranchErr","sClassErr","sSectionErr"].forEach(id => setErr(id,""));
  // Reset cascading dropdowns
  const clsSel = document.getElementById("sClass");
  const secSel = document.getElementById("sSection");
  if (clsSel) { clsSel.innerHTML = '<option value="">-- Select Class --</option>'; clsSel.disabled = true; }
  if (secSel) { secSel.innerHTML = '<option value="">-- Select Section --</option>'; secSel.disabled = true; }
  loadStudentBranchDropdown();
}
window.resetStudentForm = resetStudentForm;


// ── Enroll Modal ──────────────────────────────────────────────────────────────
function openEnrollModal(sid, name) {
  enrollStudentId = sid;
  document.getElementById("enrollModalTitle").innerHTML = `<i class="fas fa-face-smile"></i> Enroll Face — ${name}`;
  document.getElementById("enrollModal").style.display = "flex";
  document.getElementById("enrollStatus").className    = "fd-status";
  document.getElementById("enrollStatus").textContent  = "";
  document.getElementById("enrollCaptureBtn").disabled = true;
  startEnrollCamera();
}
window.openEnrollModal = openEnrollModal;

async function startEnrollCamera() {
  const video = document.getElementById("enrollVideo");
  const ph    = document.getElementById("enrollPlaceholder");
  try {
    enrollStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = enrollStream;
    video.style.display = "block"; ph.style.display = "none";
    document.getElementById("enrollCaptureBtn").disabled = false;
  } catch {
    document.getElementById("enrollStatus").className   = "fd-status error";
    document.getElementById("enrollStatus").textContent = "❌ Camera access denied";
  }
}

function closeEnrollModal() {
  if (enrollStream) { enrollStream.getTracks().forEach(t => t.stop()); enrollStream = null; }
  document.getElementById("enrollModal").style.display = "none";
  const v = document.getElementById("enrollVideo");
  v.srcObject = null; v.style.display = "none";
  document.getElementById("enrollPlaceholder").style.display = "flex";
}
window.closeEnrollModal = closeEnrollModal;

async function captureEnroll() {
  const video  = document.getElementById("enrollVideo");
  const canvas = document.getElementById("enrollCanvas");
  const status = document.getElementById("enrollStatus");
  const btn    = document.getElementById("enrollCaptureBtn");
  btn.disabled = true;

  const instructions = [
    "Look straight at camera",
    "Turn slightly left",
    "Turn slightly right",
    "Tilt head slightly up",
    "Tilt head slightly down",
    "Move a little closer",
    "Move a little back",
    "Normal position — final capture"
  ];

  const images = [];
  for (let i = 0; i < 8; i++) {
    status.className   = "fd-status loading";
    status.textContent = `📸 Sample ${i+1}/8 — ${instructions[i]}`;
    await new Promise(r => setTimeout(r, 900));
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    images.push(canvas.toDataURL("image/jpeg", 0.9));
  }

  status.textContent = "⏳ Processing with AI model...";
  try {
    const res = await api(`/api/students/${enrollStudentId}/enroll`, {
      method: "POST", body: JSON.stringify({ images })
    });
    status.className   = "fd-status success";
    status.textContent = "✅ " + res.message;
    showToast(res.message, "success");
    await loadStudents(); renderStudentsTable();
    setTimeout(closeEnrollModal, 2000);
  } catch (err) {
    status.className   = "fd-status error";
    status.textContent = "❌ " + err.message;
    btn.disabled = false;
  }
}
window.captureEnroll = captureEnroll;

// ── Face Images Modal ─────────────────────────────────────────────────────────
async function openImagesModal(sid, name) {
  document.getElementById("imagesModalTitle").innerHTML = `<i class="fas fa-images"></i> Face Images — ${name}`;
  document.getElementById("faceImagesGrid").innerHTML   = '<p style="color:var(--text2);padding:20px">Loading...</p>';
  document.getElementById("imagesModal").style.display  = "flex";
  try {
    const imgs = await api(`/api/students/${sid}/images`);
    if (!imgs.length) {
      document.getElementById("faceImagesGrid").innerHTML = '<p style="color:var(--text2);padding:20px">No images enrolled yet.</p>';
      return;
    }
    document.getElementById("faceImagesGrid").innerHTML = imgs.map((img, i) => `
      <div class="face-img-item">
        <img src="${img.image_b64}" alt="Sample ${i+1}" />
        <div class="face-img-label">Sample ${i+1}</div>
      </div>
    `).join("");
  } catch (err) {
    document.getElementById("faceImagesGrid").innerHTML = `<p style="color:var(--danger);padding:20px">Error: ${err.message}</p>`;
  }
}
window.openImagesModal = openImagesModal;

function closeImagesModal() {
  document.getElementById("imagesModal").style.display = "none";
}
window.closeImagesModal = closeImagesModal;

// ── Admin Reports ─────────────────────────────────────────────────────────────
let allReports = [];

async function initAdminReports() {
  try {
    const [reports, classes] = await Promise.all([
      api("/api/reports"),
      api("/api/reports/classes")
    ]);
    allReports = reports;
    populateReportFilters(classes);
    renderReportsTable(reports);
  } catch (e) { console.error(e); }
}

function populateReportFilters(classes) {
  const branches = [...new Set(classes.map(c => c.branch))].sort();
  const cls      = [...new Set(classes.map(c => c.class_name))].sort();
  const sections = [...new Set(classes.map(c => c.section))].sort();
  fillSelect("rFilterBranch",  branches,  "All");
  fillSelect("rFilterClass",   cls,       "All");
  fillSelect("rFilterSection", sections,  "All");
}

async function applyReportFilter() {
  const date    = document.getElementById("rFilterDate").value;
  const branch  = document.getElementById("rFilterBranch").value;
  const cls     = document.getElementById("rFilterClass").value;
  const section = document.getElementById("rFilterSection").value;
  const status  = document.getElementById("rFilterStatus").value;
  const params  = new URLSearchParams();
  if (date)    params.set("date", date);
  if (branch)  params.set("branch", branch);
  if (cls)     params.set("class_name", cls);
  if (section) params.set("section", section);
  if (status)  params.set("status", status);
  try {
    const records = await api("/api/reports?" + params.toString());
    renderReportsTable(records);
  } catch (e) { showToast("Filter error", "error"); }
}
window.applyReportFilter = applyReportFilter;

function renderReportsTable(records) {
  const tbody = document.getElementById("reportsBody");
  const count = document.getElementById("reportCount");
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:20px">No records found</td></tr>';
    count.textContent = "0 records"; return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.name}</td><td>${r.roll_no}</td><td>${r.branch}</td>
      <td>${r.class_name}</td><td>${r.section}</td><td>${r.date}</td>
      <td>${r.time_in}</td>
      <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
    </tr>
  `).join("");
  count.textContent = `${records.length} record${records.length !== 1 ? "s" : ""}`;
}

function exportReport() {
  const date    = document.getElementById("rFilterDate")?.value    || "";
  const branch  = document.getElementById("rFilterBranch")?.value  || "";
  const cls     = document.getElementById("rFilterClass")?.value   || "";
  const section = document.getElementById("rFilterSection")?.value || "";
  const params  = new URLSearchParams();
  if (date)    params.set("date", date);
  if (branch)  params.set("branch", branch);
  if (cls)     params.set("class_name", cls);
  if (section) params.set("section", section);
  window.open(API + "/api/reports/export?" + params.toString(), "_blank");
}
window.exportReport = exportReport;


// ── Teacher Dashboard ─────────────────────────────────────────────────────────
async function initTeacherDash() {
  if (currentUser) {
    document.getElementById("teacherDashName").textContent    = currentUser.name;
    document.getElementById("teacherSidebarName").textContent = currentUser.name;
  }
  document.getElementById("teacherDashDate").textContent = formatDate(new Date());
  try {
    const [stats, today, assignments] = await Promise.all([
      api("/api/attendance/stats"),
      api("/api/attendance/today"),
      api("/api/teachers/my-assignments")
    ]);
    document.getElementById("tStatStudents").textContent = stats.total_students;
    document.getElementById("tStatPresent").textContent  = stats.present_today;
    document.getElementById("tStatAbsent").textContent   = stats.absent_today;

    // Render assignments
    const el = document.getElementById("teacherAssignmentsList");
    if (!assignments.length) {
      el.innerHTML = '<p style="color:var(--text2)">No classes assigned yet. Contact admin.</p>';
    } else {
      el.innerHTML = assignments.map(a => `
        <span class="assignment-tag" style="font-size:0.9rem;padding:6px 14px">
          <i class="fas fa-chalkboard" style="color:var(--primary)"></i>
          ${a.branch} — ${a.class_name} — Section ${a.section}
        </span>
      `).join("");
    }

    // Today's table
    const tbody = document.getElementById("teacherSummaryTable");
    if (!today.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:20px">No attendance today yet</td></tr>';
    } else {
      tbody.innerHTML = today.map(r => `
        <tr>
          <td>${r.name}</td><td>${r.roll_no}</td>
          <td>${r.class_name}</td><td>${r.section}</td>
          <td>${r.time_in}</td>
          <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>
      `).join("");
    }
  } catch (e) { console.error(e); }
}

// ── Teacher Reports ───────────────────────────────────────────────────────────
async function initTeacherReports() {
  if (currentUser) document.getElementById("teacherSidebarName2").textContent = currentUser.name;
  try {
    const [reports, classes] = await Promise.all([
      api("/api/reports"),
      api("/api/reports/classes")
    ]);
    // Populate class filter
    const sel = document.getElementById("trFilterClass");
    sel.innerHTML = '<option value="">All My Classes</option>' +
      classes.map(c => `<option value="${c.branch}|${c.class_name}|${c.section}">${c.branch} — ${c.class_name} — Sec ${c.section}</option>`).join("");
    renderTeacherReports(reports);
  } catch (e) { console.error(e); }
}

async function applyTeacherReportFilter() {
  const date   = document.getElementById("trFilterDate").value;
  const combo  = document.getElementById("trFilterClass").value;
  const status = document.getElementById("trFilterStatus").value;
  const params = new URLSearchParams();
  if (date)   params.set("date", date);
  if (status) params.set("status", status);
  if (combo) {
    const [branch, cls, section] = combo.split("|");
    params.set("branch", branch); params.set("class_name", cls); params.set("section", section);
  }
  try {
    const records = await api("/api/reports?" + params.toString());
    renderTeacherReports(records);
  } catch (e) { showToast("Filter error", "error"); }
}
window.applyTeacherReportFilter = applyTeacherReportFilter;

function renderTeacherReports(records) {
  const tbody = document.getElementById("teacherReportsBody");
  const count = document.getElementById("teacherReportCount");
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:20px">No records found</td></tr>';
    count.textContent = "0 records"; return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.name}</td><td>${r.roll_no}</td>
      <td>${r.class_name}</td><td>${r.section}</td>
      <td>${r.date}</td><td>${r.time_in}</td>
      <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
    </tr>
  `).join("");
  count.textContent = `${records.length} record${records.length !== 1 ? "s" : ""}`;
}

// ── Kiosk (Teacher takes attendance) ─────────────────────────────────────────
async function initKiosk() {
  kioskStop();
  document.getElementById("kioskResult").style.display = "none";
  const s = document.getElementById("kioskStatus");
  s.className = "fd-status"; s.textContent = "";

  if (!currentRole) { navigate("login"); return; }

  // Load teacher's assigned classes into selector
  try {
    let assignments;
    if (currentRole === "teacher") {
      assignments = await api("/api/teachers/my-assignments");
    } else {
      // Admin: load all distinct classes
      assignments = await api("/api/reports/classes");
    }

    const sel = document.getElementById("kioskClassSelect");
    sel.innerHTML = '<option value="">-- Select Class --</option>' +
      assignments.map(a =>
        `<option value="${a.branch}|${a.class_name}|${a.section}">${a.branch} — ${a.class_name} — Section ${a.section}</option>`
      ).join("");

    document.getElementById("kioskClassSelector").style.display = "";
    document.getElementById("kioskMain").style.display = "none";
  } catch (e) {
    showToast("Failed to load classes", "error");
  }
}

function kioskSelectClass() {
  const val = document.getElementById("kioskClassSelect").value;
  if (!val) { showToast("Please select a class", "error"); return; }
  const [branch, class_name, section] = val.split("|");
  kioskContext = { branch, class_name, section };
  document.getElementById("kioskClassBadge").textContent =
    `${branch} — ${class_name} — Section ${section}`;
  document.getElementById("kioskClassSelector").style.display = "none";
  document.getElementById("kioskMain").style.display = "";
  document.getElementById("kioskClassLabel").textContent =
    `Taking attendance for: ${branch} — ${class_name} — Section ${section}`;
}
window.kioskSelectClass = kioskSelectClass;

function kioskChangeClass() {
  kioskStop();
  kioskContext = null;
  document.getElementById("kioskClassSelector").style.display = "";
  document.getElementById("kioskMain").style.display = "none";
  document.getElementById("kioskResult").style.display = "none";
  const s = document.getElementById("kioskStatus");
  s.className = "fd-status"; s.textContent = "";
}
window.kioskChangeClass = kioskChangeClass;

async function kioskStart() {
  const video   = document.getElementById("kioskVideo");
  const ph      = document.getElementById("kioskPlaceholder");
  const overlay = document.getElementById("kioskOverlay");
  const status  = document.getElementById("kioskStatus");

  status.className   = "fd-status loading";
  status.textContent = "⏳ Starting camera...";

  try {
    kioskStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = kioskStream;
    video.style.display = "block"; ph.style.display = "none";
    overlay.style.display = "block";
    document.getElementById("kioskStartBtn").style.display   = "none";
    document.getElementById("kioskStopBtn").style.display    = "";
    document.getElementById("kioskCaptureBtn").disabled      = false;
    status.className   = "fd-status success";
    status.textContent = "✅ Camera ready — click Capture when ready";
  } catch {
    status.className   = "fd-status error";
    status.textContent = "❌ Camera access denied. Please allow camera in browser.";
  }
}
window.kioskStart = kioskStart;

function kioskStop() {
  if (kioskStream) { kioskStream.getTracks().forEach(t => t.stop()); kioskStream = null; }
  const video = document.getElementById("kioskVideo");
  if (video) { video.srcObject = null; video.style.display = "none"; }
  const ph = document.getElementById("kioskPlaceholder");
  if (ph) { ph.style.display = "flex"; ph.innerHTML = '<i class="fas fa-camera-slash"></i><p>Camera is off</p>'; }
  const overlay = document.getElementById("kioskOverlay");
  if (overlay) overlay.style.display = "none";
  const startBtn = document.getElementById("kioskStartBtn");
  const stopBtn  = document.getElementById("kioskStopBtn");
  const capBtn   = document.getElementById("kioskCaptureBtn");
  if (startBtn) startBtn.style.display = "";
  if (stopBtn)  stopBtn.style.display  = "none";
  if (capBtn)   capBtn.disabled        = true;
}
window.kioskStop = kioskStop;

async function kioskCapture() {
  if (!kioskContext) { showToast("No class selected", "error"); return; }
  const video  = document.getElementById("kioskVideo");
  const canvas = document.getElementById("kioskCanvas");
  const status = document.getElementById("kioskStatus");
  const btn    = document.getElementById("kioskCaptureBtn");

  btn.disabled = true;
  status.className   = "fd-status loading";
  status.textContent = "⏳ Recognising face...";
  document.getElementById("kioskResult").style.display = "none";

  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const b64 = canvas.toDataURL("image/jpeg", 0.9);

  try {
    const res = await api("/api/attendance/recognize", {
      method: "POST",
      body: JSON.stringify({
        image:      b64,
        branch:     kioskContext.branch,
        class_name: kioskContext.class_name,
        section:    kioskContext.section
      })
    });

    kioskStop();
    status.className   = "fd-status success";
    status.textContent = res.already
      ? `ℹ️ Already marked today — ${res.name}`
      : res.message;

    document.getElementById("resultName").textContent = res.name;
    document.getElementById("resultRoll").textContent = "Roll No: " + res.roll_no;
    document.getElementById("resultClass").textContent =
      `${res.branch} — ${res.class_name} — Section ${res.section}`;
    document.getElementById("resultTime").textContent = res.already
      ? "Already marked today"
      : `Date: ${res.day}  |  Time: ${res.time}`;
    document.getElementById("resultConf").textContent = "Confidence: " + res.confidence + "%";
    document.getElementById("kioskResult").style.display = "flex";

    if (!res.already) showToast(`✅ ${res.name} — Attendance Marked!`, "success");

  } catch (err) {
    status.className   = "fd-status error";
    status.textContent = "❌ " + err.message;
    btn.disabled = false;
  }
}
window.kioskCapture = kioskCapture;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fillSelect(id, values, allLabel) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">${allLabel}</option>` +
    values.map(v => `<option value="${v}" ${v === current ? "selected" : ""}>${v}</option>`).join("");
}

function formatDate(d) {
  return d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function escHtml(s) {
  return String(s).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

let toastTimer;
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3500);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await api("/api/auth/me");
    currentUser = user;
    currentRole = user.role;
    updateNav();
    if (user.role === "admin")   navigate("admin-dash");
    else if (user.role === "teacher") navigate("teacher-dash");
    else navigate("login");
  } catch {
    navigate("login");
  }
});

// ── Manage Structure ──────────────────────────────────────────────────────────
let allStructure = [];

async function initManageStructure() {
  await loadStructure();
  renderStructureTable();
}

async function loadStructure() {
  try { allStructure = await api("/api/structure"); }
  catch (e) { showToast("Failed to load structure", "error"); }
}

function renderStructureTable() {
  const q     = (document.getElementById("structureSearch")?.value || "").toLowerCase();
  const tbody = document.getElementById("structureTableBody");
  if (!tbody) return;
  const list = allStructure.filter(s =>
    s.branch.toLowerCase().includes(q) ||
    s.class_name.toLowerCase().includes(q) ||
    s.section.toLowerCase().includes(q)
  );
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:20px">No entries yet. Add your first branch above.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(s => `
    <tr>
      <td><strong>${s.branch}</strong></td>
      <td>${s.class_name}</td>
      <td>${s.section}</td>
      <td>
        <button class="btn btn-danger" onclick="deleteStructureEntry(${s.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}
window.renderStructureTable = renderStructureTable;

async function addStructureEntry() {
  const branch  = document.getElementById("strBranch").value.trim().toUpperCase();
  const cls     = document.getElementById("strClass").value.trim();
  const section = document.getElementById("strSection").value.trim().toUpperCase();
  setErr("strBranchErr", ""); setErr("strClassErr", ""); setErr("strSectionErr", "");
  let ok = true;
  if (!branch)  { setErr("strBranchErr",  "Required"); ok = false; }
  if (!cls)     { setErr("strClassErr",   "Required"); ok = false; }
  if (!section) { setErr("strSectionErr", "Required"); ok = false; }
  if (!ok) return;
  const btn = document.querySelector("#page-manage-structure .btn-primary.full-width");
  if (btn) btnLoad(btn, "Adding...");
  try {
    const res = await api("/api/structure", {
      method: "POST", body: JSON.stringify({ branch, class_name: cls, section })
    });
    showToast(res.message, "success");
    document.getElementById("strBranch").value  = "";
    document.getElementById("strClass").value   = "";
    document.getElementById("strSection").value = "";
    await loadStructure(); renderStructureTable();
  } catch (err) { showToast(err.message, "error"); }
  finally { if (btn) btnReset(btn); }
}
window.addStructureEntry = addStructureEntry;

async function deleteStructureEntry(id) {
  if (!confirm("Remove this entry?")) return;
  try {
    await api(`/api/structure/${id}`, { method: "DELETE" });
    showToast("Entry removed", "error");
    await loadStructure();
    renderStructureTable();
  } catch (err) { showToast(err.message, "error"); }
}
window.deleteStructureEntry = deleteStructureEntry;

// ── Student form cascading dropdowns ─────────────────────────────────────────
async function loadStudentBranchDropdown() {
  try {
    const branches = await api("/api/structure/branches");
    const sel = document.getElementById("sBranch");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Select Branch --</option>' +
      branches.map(b => `<option value="${b}" ${b === current ? "selected" : ""}>${b}</option>`).join("");
    // reset downstream
    const clsSel = document.getElementById("sClass");
    const secSel = document.getElementById("sSection");
    if (clsSel) { clsSel.innerHTML = '<option value="">-- Select Class --</option>'; clsSel.disabled = true; }
    if (secSel) { secSel.innerHTML = '<option value="">-- Select Section --</option>'; secSel.disabled = true; }
  } catch (e) { console.error(e); }
}

async function onStudentBranchChange() {
  const branch = document.getElementById("sBranch").value;
  const clsSel = document.getElementById("sClass");
  const secSel = document.getElementById("sSection");
  clsSel.innerHTML = '<option value="">-- Select Class --</option>';
  clsSel.disabled  = true;
  secSel.innerHTML = '<option value="">-- Select Section --</option>';
  secSel.disabled  = true;
  if (!branch) return;
  try {
    const classes = await api(`/api/structure/classes?branch=${encodeURIComponent(branch)}`);
    clsSel.innerHTML = '<option value="">-- Select Class --</option>' +
      classes.map(c => `<option value="${c}">${c}</option>`).join("");
    clsSel.disabled = false;
  } catch (e) { console.error(e); }
}
window.onStudentBranchChange = onStudentBranchChange;

async function onStudentClassChange() {
  const branch = document.getElementById("sBranch").value;
  const cls    = document.getElementById("sClass").value;
  const secSel = document.getElementById("sSection");
  secSel.innerHTML = '<option value="">-- Select Section --</option>';
  secSel.disabled  = true;
  if (!branch || !cls) return;
  try {
    const sections = await api(`/api/structure/sections?branch=${encodeURIComponent(branch)}&class_name=${encodeURIComponent(cls)}`);
    secSel.innerHTML = '<option value="">-- Select Section --</option>' +
      sections.map(s => `<option value="${s}">${s}</option>`).join("");
    secSel.disabled = false;
  } catch (e) { console.error(e); }
}
window.onStudentClassChange = onStudentClassChange;
