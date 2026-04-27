/* ===================================================
   FaceAttend — script.js
   Admin-only system. Kiosk attendance is public.
   =================================================== */

const API = "";
let isAdmin   = false;
let allUsers  = [];
let editingId = null;

// ── API helper ──────────────────────────────────────────────────────────────
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

// ── Navigation ───────────────────────────────────────────────────────────────
function navigate(page) {
  const adminPages = ["admin", "manage-users", "reports"];
  if (adminPages.includes(page) && !isAdmin) {
    showToast("Admin login required", "error");
    page = "login";
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(l =>
    l.classList.toggle("active", l.dataset.page === page)
  );
  document.getElementById("navLinks").classList.remove("open");

  if (page === "admin")        initAdminDash();
  if (page === "manage-users") initManageUsers();
  if (page === "reports")      initReports();
  if (page === "kiosk")        kioskReset();

  window.scrollTo(0, 0);
}
window.navigate = navigate;

document.querySelectorAll(".nav-link").forEach(l =>
  l.addEventListener("click", e => { e.preventDefault(); navigate(l.dataset.page); })
);
document.getElementById("hamburger").addEventListener("click", () =>
  document.getElementById("navLinks").classList.toggle("open")
);

// ── Dark mode ────────────────────────────────────────────────────────────────
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

// ── Login ────────────────────────────────────────────────────────────────────
document.getElementById("togglePw").addEventListener("click", function () {
  const pw = document.getElementById("loginPassword");
  pw.type = pw.type === "text" ? "password" : "text";
  this.innerHTML = pw.type === "text"
    ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
});

document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const pw    = document.getElementById("loginPassword").value;
  document.getElementById("emailError").textContent = "";
  document.getElementById("pwError").textContent    = "";

  if (!email) { document.getElementById("emailError").textContent = "Email required"; return; }
  if (!pw)    { document.getElementById("pwError").textContent    = "Password required"; return; }

  const btn = document.getElementById("loginSubmitBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: pw, role: "admin" })
    });
    isAdmin = true;
    updateNav();
    showToast("Welcome, Admin!", "success");
    navigate("admin");
  } catch (err) {
    document.getElementById("emailError").textContent = err.message;
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In';
  }
});

async function doLogout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  isAdmin = false;
  updateNav();
  navigate("kiosk");
  showToast("Logged out");
}
window.doLogout = doLogout;
document.getElementById("logoutBtn").addEventListener("click", e => { e.preventDefault(); doLogout(); });

function updateNav() {
  ["navAdmin","navManage","navReports","navLogoutItem"].forEach(id =>
    document.getElementById(id).style.display = isAdmin ? "" : "none"
  );
  document.getElementById("navLogin").style.display = isAdmin ? "none" : "";
}

// ── Admin Dashboard ──────────────────────────────────────────────────────────
async function initAdminDash() {
  document.getElementById("adminDashDate").textContent = formatDate(new Date());
  try {
    const [stats, today] = await Promise.all([
      api("/api/attendance/stats"),
      api("/api/attendance/today")
    ]);
    document.getElementById("statTotal").textContent   = stats.total_users;
    document.getElementById("statPresent").textContent = stats.present_today;
    document.getElementById("statAbsent").textContent  = stats.absent_today;
    document.getElementById("statPct").textContent     = stats.total_users
      ? ((stats.present_today / stats.total_users) * 100).toFixed(1) + "%" : "0%";

    document.getElementById("adminSummaryTable").innerHTML = today.length
      ? today.map(r => `<tr>
          <td>${r.name}</td><td>${r.user_code}</td><td>${r.time_in}</td>
          <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>`).join("")
      : '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:20px">No attendance today yet</td></tr>';
  } catch (e) { console.error(e); }
}

// ── Manage Users ─────────────────────────────────────────────────────────────
async function initManageUsers() {
  await loadUsers();
  renderUsersTable();
}

async function loadUsers() {
  try { allUsers = await api("/api/users"); }
  catch (e) { showToast("Failed to load users", "error"); }
}

function renderUsersTable() {
  const q     = (document.getElementById("userSearch")?.value || "").toLowerCase();
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  const list = allUsers.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.user_code.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q)
  );

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:20px">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.user_code}</td>
      <td>${u.email}</td>
      <td><span class="role-badge ${u.role === 'staff' ? 'admin' : 'user'}">${cap(u.role)}</span></td>
      <td>
        ${u.sample_count > 0
          ? `<span class="face-enrolled-badge"><i class="fas fa-check"></i> ${u.sample_count} samples</span>`
          : `<span class="face-none-badge"><i class="fas fa-xmark"></i> Not enrolled</span>`}
      </td>
      <td>
        <div class="action-btns">
          <button class="btn btn-edit" onclick="editUser(${u.id})"><i class="fas fa-pen"></i></button>
          <button class="btn btn-primary" style="background:var(--teal);border-color:var(--teal);padding:6px 10px;font-size:0.8rem" onclick="openEnrollModal(${u.id},'${u.name}')"><i class="fas fa-face-smile"></i> Enroll</button>
          <button class="btn btn-outline" style="padding:6px 10px;font-size:0.8rem" onclick="openImagesModal(${u.id},'${u.name}')" ${u.image_count > 0 ? "" : "disabled"}><i class="fas fa-images"></i> View</button>
          <button class="btn btn-danger" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join("");
}
window.renderUsersTable = renderUsersTable;

document.getElementById("userForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!validateUserForm()) return;
  const payload = {
    user_code: document.getElementById("uId").value.trim(),
    name:      document.getElementById("uName").value.trim(),
    email:     document.getElementById("uEmail").value.trim(),
    role:      document.getElementById("uRole").value
  };
  try {
    if (editingId) {
      await api(`/api/users/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("User updated", "success");
    } else {
      await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
      showToast("User added", "success");
    }
    resetUserForm();
    await loadUsers(); renderUsersTable();
  } catch (err) { showToast(err.message, "error"); }
});

function editUser(uid) {
  const u = allUsers.find(x => x.id === uid);
  if (!u) return;
  editingId = uid;
  document.getElementById("uName").value  = u.name;
  document.getElementById("uId").value    = u.user_code;
  document.getElementById("uEmail").value = u.email;
  document.getElementById("uRole").value  = u.role;
  document.getElementById("uId").disabled = true;
  document.getElementById("userFormTitle").innerHTML = '<i class="fas fa-pen"></i> Edit User';
  document.getElementById("userFormBtn").innerHTML   = '<i class="fas fa-save"></i> Save Changes';
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteUser(uid) {
  if (!confirm("Delete this user and all their attendance records?")) return;
  try {
    await api(`/api/users/${uid}`, { method: "DELETE" });
    showToast("User deleted", "error");
    await loadUsers(); renderUsersTable();
  } catch (err) { showToast(err.message, "error"); }
}

function resetUserForm() {
  editingId = null;
  document.getElementById("userForm").reset();
  document.getElementById("uId").disabled = false;
  document.getElementById("userFormTitle").innerHTML = '<i class="fas fa-user-plus"></i> Add New User';
  document.getElementById("userFormBtn").innerHTML   = '<i class="fas fa-plus"></i> Add User';
  ["uNameErr","uIdErr","uEmailErr"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = "";
  });
}
window.resetUserForm = resetUserForm;

function validateUserForm() {
  let ok = true;
  const name  = document.getElementById("uName").value.trim();
  const id    = document.getElementById("uId").value.trim();
  const email = document.getElementById("uEmail").value.trim();
  if (!name)  { document.getElementById("uNameErr").textContent  = "Required"; ok = false; }
  if (!id)    { document.getElementById("uIdErr").textContent    = "Required"; ok = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById("uEmailErr").textContent = "Valid email required"; ok = false;
  }
  return ok;
}

window.editUser   = editUser;
window.deleteUser = deleteUser;

// ── Enroll Modal ─────────────────────────────────────────────────────────────
let enrollUserId = null;
let enrollStream = null;

function openEnrollModal(uid, name) {
  enrollUserId = uid;
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
    const res = await api(`/api/users/${enrollUserId}/enroll`, {
      method: "POST", body: JSON.stringify({ images })
    });
    status.className   = "fd-status success";
    status.textContent = "✅ " + res.message;
    showToast(res.message, "success");
    await loadUsers(); renderUsersTable();
    setTimeout(closeEnrollModal, 2000);
  } catch (err) {
    status.className   = "fd-status error";
    status.textContent = "❌ " + err.message;
    btn.disabled = false;
  }
}
window.captureEnroll = captureEnroll;

// ── Face Images Modal ─────────────────────────────────────────────────────────
async function openImagesModal(uid, name) {
  document.getElementById("imagesModalTitle").innerHTML =
    `<i class="fas fa-images"></i> Face Images — ${name}`;
  document.getElementById("faceImagesGrid").innerHTML =
    '<p style="color:var(--text2);padding:20px">Loading...</p>';
  document.getElementById("imagesModal").style.display = "flex";

  try {
    const imgs = await api(`/api/users/${uid}/images`);
    if (!imgs.length) {
      document.getElementById("faceImagesGrid").innerHTML =
        '<p style="color:var(--text2);padding:20px">No images enrolled yet.</p>';
      return;
    }
    document.getElementById("faceImagesGrid").innerHTML = imgs.map((img, i) => `
      <div class="face-img-item">
        <img src="${img.image_b64}" alt="Sample ${i+1}" />
        <div class="face-img-label">Sample ${i+1}</div>
      </div>
    `).join("");
  } catch (err) {
    document.getElementById("faceImagesGrid").innerHTML =
      `<p style="color:var(--danger);padding:20px">Error: ${err.message}</p>`;
  }
}
window.openImagesModal = openImagesModal;

function closeImagesModal() {
  document.getElementById("imagesModal").style.display = "none";
}
window.closeImagesModal = closeImagesModal;

// ── Kiosk (public attendance) ─────────────────────────────────────────────────
let kioskStream = null;

function kioskReset() {
  kioskStop();
  const s = document.getElementById("kioskStatus");
  s.className = "fd-status"; s.textContent = "";
  document.getElementById("kioskResult").style.display = "none";
  document.getElementById("kioskCaptureBtn").disabled  = true;
}

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

function kioskStop() {
  if (kioskStream) { kioskStream.getTracks().forEach(t => t.stop()); kioskStream = null; }
  const video = document.getElementById("kioskVideo");
  if (video) { video.srcObject = null; video.style.display = "none"; }
  const ph = document.getElementById("kioskPlaceholder");
  if (ph) { ph.style.display = "flex"; ph.innerHTML = '<i class="fas fa-camera-slash"></i><p>Camera is off</p>'; }
  const overlay = document.getElementById("kioskOverlay");
  if (overlay) overlay.style.display = "none";
  document.getElementById("kioskStartBtn").style.display  = "";
  document.getElementById("kioskStopBtn").style.display   = "none";
  document.getElementById("kioskCaptureBtn").disabled     = true;
}

async function kioskCapture() {
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
      method: "POST", body: JSON.stringify({ image: b64 })
    });

    kioskStop();
    status.className   = "fd-status success";
    status.textContent = res.already
      ? `ℹ️ Already marked today — ${res.name}`
      : "✅ Attendance marked!";

    document.getElementById("resultName").textContent = res.name;
    document.getElementById("resultCode").textContent = "ID: " + res.user_code;
    document.getElementById("resultTime").textContent = res.already
      ? "Already marked today" : "Time: " + res.time;
    document.getElementById("resultConf").textContent = "Confidence: " + res.confidence + "%";
    document.getElementById("kioskResult").style.display = "flex";

    if (!res.already) showToast(`✅ ${res.name} — Attendance Marked!`, "success");

  } catch (err) {
    status.className   = "fd-status error";
    status.textContent = "❌ " + err.message;
    btn.disabled = false;
  }
}

window.kioskStart   = kioskStart;
window.kioskStop    = kioskStop;
window.kioskCapture = kioskCapture;

// ── Reports ───────────────────────────────────────────────────────────────────
async function initReports() {
  try {
    const [records, users] = await Promise.all([
      api("/api/reports"),
      api("/api/users")
    ]);
    renderReportsTable(records);
    const sel = document.getElementById("filterUser");
    sel.innerHTML = '<option value="">All Users</option>' +
      users.map(u => `<option value="${u.id}">${u.name}</option>`).join("");
  } catch (e) { console.error(e); }
}

function renderReportsTable(records) {
  const tbody = document.getElementById("reportsBody");
  const count = document.getElementById("reportCount");
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:20px">No records found</td></tr>';
    count.textContent = "0 records"; return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.name}</td><td>${r.user_code}</td><td>${r.date}</td>
      <td>${r.time_in}</td>
      <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
    </tr>
  `).join("");
  count.textContent = `${records.length} record${records.length !== 1 ? "s" : ""}`;
}

async function applyFilter() {
  const p = new URLSearchParams();
  const d = document.getElementById("filterDate").value;
  const u = document.getElementById("filterUser").value;
  const s = document.getElementById("filterStatus").value;
  if (d) p.set("date", d);
  if (u) p.set("user_id", u);
  if (s) p.set("status", s);
  try {
    const records = await api("/api/reports?" + p.toString());
    renderReportsTable(records);
  } catch (e) { showToast("Filter error", "error"); }
}

function exportReport() { window.open(API + "/api/reports/export", "_blank"); }

window.applyFilter  = applyFilter;
window.exportReport = exportReport;

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d) {
  return d.toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await api("/api/auth/me");
    if (user.role === "admin") {
      isAdmin = true;
      updateNav();
      navigate("admin");
      return;
    }
  } catch {}
  navigate("kiosk");
});
