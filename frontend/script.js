/* ===================================================
   Face Detection Attendance System — script.js
   Wired to Flask backend API at /api/*
   =================================================== */

const API = "";   // same origin — Flask serves frontend

// ===== STATE =====
let currentUser   = null;
let currentRole   = null;
let activeLoginTab = "user";
let cameraStream  = null;
let detectionTimer = null;
let captureInterval = null;
let editingUserId  = null;
let allUsers       = [];
let allReports     = [];

// ===== API HELPER =====
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ===== NAVIGATION =====
function navigate(page) {
  const protectedPages = ["dashboard", "admin", "attendance", "reports", "manage-users"];
  if (protectedPages.includes(page) && !currentUser) {
    showToast("Please login first", "error");
    page = "login";
  }
  if (["admin", "manage-users"].includes(page) && currentRole !== "admin") {
    showToast("Admin access required", "error");
    return;
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById("page-" + page);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(l =>
    l.classList.toggle("active", l.dataset.page === page)
  );
  document.getElementById("navLinks").classList.remove("open");

  if (page === "reports")       initReports();
  if (page === "manage-users")  initManageUsers();
  if (page === "dashboard")     initUserDashboard();
  if (page === "admin")         initAdminDashboard();
  if (page === "attendance")    resetFDPage();

  window.scrollTo(0, 0);
}
window.navigate = navigate;

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", e => { e.preventDefault(); navigate(link.dataset.page); });
});
document.getElementById("hamburger").addEventListener("click", () => {
  document.getElementById("navLinks").classList.toggle("open");
});
function scrollToFeatures() {
  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
}
window.scrollToFeatures = scrollToFeatures;

// ===== DARK MODE =====
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  const html = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
  themeToggle.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  localStorage.setItem("theme", isDark ? "light" : "dark");
});
(function () {
  if (localStorage.getItem("theme") === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }
})();

// ===== LOGIN TABS =====
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeLoginTab = tab.dataset.tab;
    document.getElementById("loginHint").textContent =
      activeLoginTab === "admin"
        ? "Demo: admin@demo.com / admin123"
        : "Demo: user@demo.com / password123";
    clearLoginErrors();
  });
});

document.getElementById("togglePw").addEventListener("click", function () {
  const pw = document.getElementById("loginPassword");
  const isText = pw.type === "text";
  pw.type = isText ? "password" : "text";
  this.innerHTML = isText ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
});

// ===== LOGIN FORM =====
document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!validateLoginForm()) return;

  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const btn      = document.getElementById("loginSubmitBtn");

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

  try {
    const user = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role: activeLoginTab })
    });
    currentUser = user;
    currentRole = user.role;
    updateNavForRole();
    showToast(`Welcome back, ${user.name}!`, "success");
    if (user.role === "admin") navigate("admin");
    else navigate("dashboard");
  } catch (err) {
    showFieldError("emailError", err.message);
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In';
  }
});

function validateLoginForm() {
  clearLoginErrors();
  let valid = true;
  const email = document.getElementById("loginEmail").value.trim();
  const pw    = document.getElementById("loginPassword").value;
  if (!email) { showFieldError("emailError", "Email is required"); valid = false; }
  if (!pw)    { showFieldError("pwError", "Password is required"); valid = false; }
  return valid;
}
function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}
function clearLoginErrors() {
  ["emailError", "pwError"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

// ===== LOGOUT =====
document.getElementById("logoutBtn").addEventListener("click", async e => {
  e.preventDefault();
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  currentUser = null; currentRole = null;
  stopCamera();
  updateNavForRole();
  navigate("home");
  showToast("Logged out successfully");
});

function updateNavForRole() {
  const loggedIn = !!currentUser;
  const isAdmin  = currentRole === "admin";
  document.getElementById("adminNavLink").style.display      = isAdmin    ? "" : "none";
  document.getElementById("attendanceNavLink").style.display = loggedIn   ? "" : "none";
  document.getElementById("reportsNavLink").style.display    = loggedIn   ? "" : "none";
  document.getElementById("logoutNavItem").style.display     = loggedIn   ? "" : "none";
}

// ===== USER DASHBOARD =====
async function initUserDashboard() {
  const name = currentUser?.name?.split(" ")[0] || "User";
  document.getElementById("dashWelcomeName").textContent = name;
  document.getElementById("sidebarName").textContent = currentUser?.name || "User";
  document.getElementById("dashDate").textContent = formatDate(new Date());

  try {
    const records = await api(`/api/attendance/user/${currentUser.id}`);
    const present = records.filter(r => r.status === "Present").length;
    const absent  = records.length - present;
    const pct     = records.length ? ((present / records.length) * 100).toFixed(1) : 0;
    document.getElementById("userPresent").textContent = present;
    document.getElementById("userAbsent").textContent  = absent;
    document.getElementById("userPercent").textContent = pct + "%";

    const tbody = document.getElementById("userRecentTable");
    tbody.innerHTML = records.slice(0, 5).map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.time_in}</td>
        <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
      </tr>
    `).join("") || '<tr><td colspan="3" style="text-align:center;color:var(--text2)">No records yet</td></tr>';
  } catch (e) {
    console.error("Dashboard load error:", e);
  }
}

// ===== ADMIN DASHBOARD =====
async function initAdminDashboard() {
  document.getElementById("adminDashDate").textContent = formatDate(new Date());
  try {
    const [stats, today] = await Promise.all([
      api("/api/attendance/stats"),
      api("/api/attendance/today")
    ]);
    // Update stat cards
    const cards = document.querySelectorAll("#page-admin .stat-card h3");
    if (cards[0]) cards[0].textContent = stats.total_users;
    if (cards[1]) cards[1].textContent = stats.present_today;
    if (cards[2]) cards[2].textContent = stats.absent_today;
    const pct = stats.total_users
      ? ((stats.present_today / stats.total_users) * 100).toFixed(1) + "%"
      : "0%";
    if (cards[3]) cards[3].textContent = pct;

    const tbody = document.getElementById("adminSummaryTable");
    tbody.innerHTML = today.map(r => `
      <tr>
        <td>${r.name}</td>
        <td>${r.user_code}</td>
        <td>${r.time_in}</td>
        <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
      </tr>
    `).join("") || '<tr><td colspan="4" style="text-align:center;color:var(--text2)">No records today</td></tr>';
  } catch (e) {
    console.error("Admin dashboard error:", e);
  }
}

function showAdminTab(tab) {}
function showDashTab(tab)  {}
window.showAdminTab = showAdminTab;
window.showDashTab  = showDashTab;

// ===== FACE DETECTION PAGE =====
function resetFDPage() {
  stopCamera();
  const status = document.getElementById("fdStatus");
  status.className = "fd-status";
  status.textContent = "";
  document.getElementById("captureBtn").disabled = true;
  document.getElementById("stopCameraBtn").style.display = "none";
  document.getElementById("startCameraBtn").style.display = "";
}

async function startCamera() {
  const placeholder = document.getElementById("cameraPlaceholder");
  const video       = document.getElementById("videoFeed");
  const overlay     = document.getElementById("scanOverlay");
  const status      = document.getElementById("fdStatus");
  const startBtn    = document.getElementById("startCameraBtn");
  const stopBtn     = document.getElementById("stopCameraBtn");
  const captureBtn  = document.getElementById("captureBtn");

  status.className = "fd-status loading";
  status.textContent = "⏳ Accessing camera...";

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = cameraStream;
    placeholder.style.display = "none";
    video.style.display = "block";
    overlay.style.display = "block";
    startBtn.style.display = "none";
    stopBtn.style.display  = "";

    status.className = "fd-status loading";
    status.textContent = "🔍 Detecting face...";

    // Show detection badge after 1.5s
    detectionTimer = setTimeout(() => {
      document.getElementById("detectionBadge").style.display = "flex";
      captureBtn.disabled = false;
      status.className = "fd-status success";
      status.textContent = "✅ Face detected! Click Capture to mark attendance.";
    }, 1500);

  } catch (err) {
    status.className = "fd-status error";
    status.textContent = "❌ Camera access denied. Please allow camera permissions.";
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  clearTimeout(detectionTimer);
  clearInterval(captureInterval);

  const video = document.getElementById("videoFeed");
  if (video) { video.srcObject = null; video.style.display = "none"; }
  const ph = document.getElementById("cameraPlaceholder");
  if (ph) { ph.style.display = "flex"; ph.innerHTML = '<i class="fas fa-camera-slash"></i><p>Camera is off</p>'; }
  const overlay = document.getElementById("scanOverlay");
  if (overlay) overlay.style.display = "none";
  const badge = document.getElementById("detectionBadge");
  if (badge) badge.style.display = "none";
  const captureBtn = document.getElementById("captureBtn");
  if (captureBtn) captureBtn.disabled = true;
  const stopBtn = document.getElementById("stopCameraBtn");
  if (stopBtn) stopBtn.style.display = "none";
  const startBtn = document.getElementById("startCameraBtn");
  if (startBtn) startBtn.style.display = "";
}

async function captureAttendance() {
  const video      = document.getElementById("videoFeed");
  const canvas     = document.getElementById("snapCanvas");
  const status     = document.getElementById("fdStatus");
  const captureBtn = document.getElementById("captureBtn");

  captureBtn.disabled = true;
  status.className = "fd-status loading";
  status.textContent = "⏳ Processing face recognition...";

  // Capture frame from video
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const b64Image = canvas.toDataURL("image/jpeg", 0.8);

  try {
    const result = await api("/api/attendance/recognize", {
      method: "POST",
      body: JSON.stringify({ image: b64Image })
    });

    if (result.already) {
      status.className = "fd-status loading";
      status.innerHTML = `<i class="fas fa-info-circle"></i> ${result.name} — already marked today`;
    } else {
      status.className = "fd-status success";
      status.innerHTML = `<i class="fas fa-check-circle"></i> Attendance Marked — ${result.name} (${result.time}) · Confidence: ${result.confidence}%`;
      showToast(`✅ Attendance marked for ${result.name}!`, "success");
    }
    stopCamera();
  } catch (err) {
    status.className = "fd-status error";
    status.textContent = "❌ " + err.message;
    captureBtn.disabled = false;
  }
}

window.startCamera        = startCamera;
window.stopCamera         = stopCamera;
window.captureAttendance  = captureAttendance;

// ===== REPORTS PAGE =====
async function initReports() {
  try {
    allReports = await api("/api/reports");
    renderReportsTable(allReports);
    // Populate user filter
    const users = await api("/api/users").catch(() => []);
    const sel = document.getElementById("filterUser");
    sel.innerHTML = '<option value="">All Users</option>' +
      users.map(u => `<option value="${u.id}">${u.name}</option>`).join("");
  } catch (e) {
    console.error("Reports error:", e);
  }
}

function renderReportsTable(records) {
  const tbody = document.getElementById("reportsBody");
  const count = document.getElementById("reportCount");
  if (!tbody) return;
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:24px">No records found</td></tr>';
    count.textContent = "0 records";
    return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.user_code}</td>
      <td>${r.date}</td>
      <td>${r.time_in}</td>
      <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
    </tr>
  `).join("");
  count.textContent = `${records.length} record${records.length !== 1 ? "s" : ""}`;
}

async function applyFilter() {
  const date   = document.getElementById("filterDate").value;
  const userId = document.getElementById("filterUser").value;
  const status = document.getElementById("filterStatus").value;
  const params = new URLSearchParams();
  if (date)   params.set("date", date);
  if (userId) params.set("user_id", userId);
  if (status) params.set("status", status);
  try {
    const records = await api("/api/reports?" + params.toString());
    renderReportsTable(records);
  } catch (e) {
    showToast("Filter error: " + e.message, "error");
  }
}

async function exportReport() {
  window.open(API + "/api/reports/export", "_blank");
}

window.applyFilter  = applyFilter;
window.exportReport = exportReport;

// ===== MANAGE USERS PAGE =====
async function initManageUsers() {
  await loadUsers();
  renderUsersTable();
}

async function loadUsers() {
  try {
    allUsers = await api("/api/users");
  } catch (e) {
    showToast("Failed to load users: " + e.message, "error");
  }
}

function renderUsersTable() {
  const search = (document.getElementById("userSearch")?.value || "").toLowerCase();
  const tbody  = document.getElementById("usersTableBody");
  if (!tbody) return;
  const filtered = allUsers.filter(u =>
    u.name.toLowerCase().includes(search) ||
    u.user_code.toLowerCase().includes(search) ||
    u.email.toLowerCase().includes(search)
  );
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:24px">No users found</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.user_code}</td>
      <td>${u.email}</td>
      <td><span class="role-badge ${u.role === 'staff' ? 'admin' : 'user'}">${capitalize(u.role)}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn btn-edit" onclick="editUser(${u.id})"><i class="fas fa-pen"></i> Edit</button>
          <button class="btn btn-primary" style="background:var(--teal);border-color:var(--teal);padding:6px 10px;font-size:0.8rem" onclick="openEnrollModal(${u.id}, '${u.name}')"><i class="fas fa-face-smile"></i> Enroll</button>
          <button class="btn btn-danger" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join("");
}

document.getElementById("userForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!validateUserForm()) return;
  const payload = {
    user_code: document.getElementById("uId").value.trim(),
    name:      document.getElementById("uName").value.trim(),
    email:     document.getElementById("uEmail").value.trim(),
    role:      document.getElementById("uRole").value,
    password:  document.getElementById("uPassword")?.value || "password123"
  };
  try {
    if (editingUserId) {
      await api(`/api/users/${editingUserId}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("User updated", "success");
    } else {
      await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
      showToast("User added", "success");
    }
    resetUserForm();
    await loadUsers();
    renderUsersTable();
  } catch (err) {
    showToast(err.message, "error");
  }
});

function editUser(uid) {
  const u = allUsers.find(x => x.id === uid);
  if (!u) return;
  editingUserId = uid;
  document.getElementById("uName").value  = u.name;
  document.getElementById("uId").value    = u.user_code;
  document.getElementById("uEmail").value = u.email;
  document.getElementById("uRole").value  = u.role;
  document.getElementById("userFormTitle").innerHTML = '<i class="fas fa-pen"></i> Edit User';
  document.getElementById("userFormBtn").innerHTML   = '<i class="fas fa-save"></i> Save Changes';
  document.getElementById("uId").disabled = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteUser(uid) {
  if (!confirm("Delete this user? This also removes their attendance records.")) return;
  try {
    await api(`/api/users/${uid}`, { method: "DELETE" });
    showToast("User deleted", "error");
    await loadUsers();
    renderUsersTable();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetUserForm() {
  editingUserId = null;
  document.getElementById("userForm").reset();
  document.getElementById("uId").disabled = false;
  document.getElementById("userFormTitle").innerHTML = '<i class="fas fa-user-plus"></i> Add New User';
  document.getElementById("userFormBtn").innerHTML   = '<i class="fas fa-plus"></i> Add User';
  ["uNameErr","uIdErr","uEmailErr"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

function validateUserForm() {
  let valid = true;
  const name  = document.getElementById("uName").value.trim();
  const id    = document.getElementById("uId").value.trim();
  const email = document.getElementById("uEmail").value.trim();
  if (!name)  { document.getElementById("uNameErr").textContent  = "Name required";  valid = false; }
  if (!id)    { document.getElementById("uIdErr").textContent    = "ID required";    valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById("uEmailErr").textContent = "Valid email required"; valid = false;
  }
  return valid;
}

window.editUser         = editUser;
window.deleteUser       = deleteUser;
window.resetUserForm    = resetUserForm;
window.renderUsersTable = renderUsersTable;

// ===== FACE ENROLL MODAL =====
let enrollUserId = null;
let enrollStream = null;

function openEnrollModal(uid, name) {
  enrollUserId = uid;
  document.getElementById("enrollModalTitle").textContent = `Enroll Face — ${name}`;
  document.getElementById("enrollModal").style.display = "flex";
  document.getElementById("enrollStatus").className = "fd-status";
  document.getElementById("enrollStatus").textContent = "";
  startEnrollCamera();
}

async function startEnrollCamera() {
  const video = document.getElementById("enrollVideo");
  const ph    = document.getElementById("enrollPlaceholder");
  try {
    enrollStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = enrollStream;
    video.style.display = "block";
    ph.style.display = "none";
    document.getElementById("enrollCaptureBtn").disabled = false;
  } catch {
    document.getElementById("enrollStatus").className = "fd-status error";
    document.getElementById("enrollStatus").textContent = "Camera access denied";
  }
}

function closeEnrollModal() {
  if (enrollStream) { enrollStream.getTracks().forEach(t => t.stop()); enrollStream = null; }
  document.getElementById("enrollModal").style.display = "none";
  const video = document.getElementById("enrollVideo");
  video.srcObject = null; video.style.display = "none";
  document.getElementById("enrollPlaceholder").style.display = "flex";
}

async function captureEnroll() {
  const video  = document.getElementById("enrollVideo");
  const canvas = document.getElementById("enrollCanvas");
  const status = document.getElementById("enrollStatus");
  const btn    = document.getElementById("enrollCaptureBtn");
  btn.disabled = true;
  status.className = "fd-status loading";
  status.textContent = "⏳ Processing face...";
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const b64 = canvas.toDataURL("image/jpeg", 0.8);
  try {
    await api(`/api/users/${enrollUserId}/enroll`, { method: "POST", body: JSON.stringify({ image: b64 }) });
    status.className = "fd-status success";
    status.textContent = "✅ Face enrolled successfully!";
    showToast("Face enrolled!", "success");
    await loadUsers(); renderUsersTable();
    setTimeout(closeEnrollModal, 1500);
  } catch (err) {
    status.className = "fd-status error";
    status.textContent = "❌ " + err.message;
    btn.disabled = false;
  }
}

window.openEnrollModal  = openEnrollModal;
window.closeEnrollModal = closeEnrollModal;
window.captureEnroll    = captureEnroll;

// ===== TOAST =====
let toastTimer;
function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

// ===== HELPERS =====
function formatDate(d) {
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {
  // Check if already logged in (session cookie)
  try {
    const user = await api("/api/auth/me");
    currentUser = user;
    currentRole = user.role;
    updateNavForRole();
    navigate(user.role === "admin" ? "admin" : "dashboard");
  } catch {
    navigate("home");
  }
});
