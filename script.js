/* ===================================================
   Face Detection Attendance System — script.js
   Pure JS: routing, auth simulation, face detection sim
   =================================================== */

// ===== STATE =====
let currentUser = null;       // logged-in user object
let currentRole = null;       // 'user' | 'admin'
let activeLoginTab = 'user';  // login tab
let cameraStream = null;      // MediaStream for webcam
let detectionTimer = null;    // face detection simulation timer
let editingUserId = null;     // user being edited in manage-users

// ===== DEMO DATA =====
const DEMO_USERS = {
  'user@demo.com':  { password: 'password123', name: 'Alice Johnson', id: 'STU001', role: 'user' },
  'admin@demo.com': { password: 'admin123',    name: 'Admin',         id: 'ADM001', role: 'admin' },
};

// Managed users list (admin can CRUD)
let usersList = [
  { id: 'STU001', name: 'Alice Johnson', email: 'alice@demo.com', role: 'student' },
  { id: 'STU002', name: 'Bob Smith',     email: 'bob@demo.com',   role: 'student' },
  { id: 'STU003', name: 'Carol White',   email: 'carol@demo.com', role: 'student' },
  { id: 'STU004', name: 'David Brown',   email: 'david@demo.com', role: 'staff'   },
  { id: 'STU005', name: 'Eve Davis',     email: 'eve@demo.com',   role: 'student' },
];

// Attendance records
const attendanceRecords = [
  { name: 'Alice Johnson', id: 'STU001', date: '2026-04-10', time: '09:02 AM', status: 'Present' },
  { name: 'Bob Smith',     id: 'STU002', date: '2026-04-10', time: '09:15 AM', status: 'Late'    },
  { name: 'Carol White',   id: 'STU003', date: '2026-04-10', time: '--',       status: 'Absent'  },
  { name: 'David Brown',   id: 'STU004', date: '2026-04-10', time: '08:58 AM', status: 'Present' },
  { name: 'Eve Davis',     id: 'STU005', date: '2026-04-10', time: '09:05 AM', status: 'Present' },
  { name: 'Alice Johnson', id: 'STU001', date: '2026-04-11', time: '09:00 AM', status: 'Present' },
  { name: 'Bob Smith',     id: 'STU002', date: '2026-04-11', time: '--',       status: 'Absent'  },
  { name: 'Carol White',   id: 'STU003', date: '2026-04-11', time: '09:10 AM', status: 'Present' },
  { name: 'David Brown',   id: 'STU004', date: '2026-04-11', time: '09:01 AM', status: 'Present' },
  { name: 'Eve Davis',     id: 'STU005', date: '2026-04-11', time: '09:20 AM', status: 'Late'    },
];

// Recent attendance for user dashboard
const userRecentRecords = [
  { date: '2026-04-11', time: '09:00 AM', status: 'Present' },
  { date: '2026-04-10', time: '09:02 AM', status: 'Present' },
  { date: '2026-04-09', time: '--',       status: 'Absent'  },
  { date: '2026-04-08', time: '09:15 AM', status: 'Late'    },
  { date: '2026-04-07', time: '08:55 AM', status: 'Present' },
];

// Admin today summary
const adminTodaySummary = [
  { name: 'Alice Johnson', id: 'STU001', time: '09:02 AM', status: 'Present' },
  { name: 'Bob Smith',     id: 'STU002', time: '09:15 AM', status: 'Late'    },
  { name: 'Carol White',   id: 'STU003', time: '--',       status: 'Absent'  },
  { name: 'David Brown',   id: 'STU004', time: '08:58 AM', status: 'Present' },
  { name: 'Eve Davis',     id: 'STU005', time: '09:05 AM', status: 'Present' },
];

// ===== NAVIGATION =====
function navigate(page) {
  // Guard protected pages
  const protectedPages = ['dashboard', 'admin', 'attendance', 'reports', 'manage-users'];
  if (protectedPages.includes(page) && !currentUser) {
    showToast('Please login first', 'error');
    page = 'login';
  }
  // Admin-only pages
  if (['admin', 'manage-users'].includes(page) && currentRole !== 'admin') {
    showToast('Admin access required', 'error');
    return;
  }

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show target page
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });

  // Close mobile menu
  document.getElementById('navLinks').classList.remove('open');

  // Page-specific init
  if (page === 'reports')       initReports();
  if (page === 'manage-users')  renderUsersTable();
  if (page === 'dashboard')     initUserDashboard();
  if (page === 'admin')         initAdminDashboard();
  if (page === 'attendance')    resetFDPage();

  // Scroll to top
  window.scrollTo(0, 0);
}

// Expose globally for onclick attributes
window.navigate = navigate;

// Nav link click handler
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigate(link.dataset.page);
  });
});

// Hamburger toggle
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});

// Scroll to features (home page)
function scrollToFeatures() {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
}
window.scrollToFeatures = scrollToFeatures;

// ===== DARK MODE =====
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  themeToggle.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
});

// Restore saved theme
(function () {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }
})();

// ===== LOGIN TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeLoginTab = tab.dataset.tab;
    // Update hint
    const hint = document.getElementById('loginHint');
    hint.textContent = activeLoginTab === 'admin'
      ? 'Demo: admin@demo.com / admin123'
      : 'Demo: user@demo.com / password123';
    clearLoginErrors();
  });
});

// ===== PASSWORD TOGGLE =====
document.getElementById('togglePw').addEventListener('click', function () {
  const pw = document.getElementById('loginPassword');
  const isText = pw.type === 'text';
  pw.type = isText ? 'password' : 'text';
  this.innerHTML = isText ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
});

// ===== LOGIN FORM =====
document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  if (!validateLoginForm()) return;

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginSubmitBtn');

  // Simulate loading
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In';

    const user = DEMO_USERS[email];
    if (!user || user.password !== password) {
      showFieldError('emailError', 'Invalid email or password');
      showToast('Login failed. Check credentials.', 'error');
      return;
    }
    if (activeLoginTab === 'admin' && user.role !== 'admin') {
      showFieldError('emailError', 'This account does not have admin access');
      return;
    }
    if (activeLoginTab === 'user' && user.role !== 'user') {
      showFieldError('emailError', 'Please use the Admin Login tab');
      return;
    }

    // Success
    currentUser = user;
    currentRole = user.role;
    updateNavForRole();
    showToast(`Welcome back, ${user.name}!`, 'success');

    if (user.role === 'admin') navigate('admin');
    else navigate('dashboard');
  }, 900);
});

function validateLoginForm() {
  clearLoginErrors();
  let valid = true;
  const email = document.getElementById('loginEmail').value.trim();
  const pw = document.getElementById('loginPassword').value;
  if (!email) { showFieldError('emailError', 'Email is required'); valid = false; }
  if (!pw)    { showFieldError('pwError', 'Password is required'); valid = false; }
  else if (pw.length < 6) { showFieldError('pwError', 'Password must be at least 6 characters'); valid = false; }
  return valid;
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
  // Highlight input
  const inputMap = { emailError: 'loginEmail', pwError: 'loginPassword' };
  const inp = document.getElementById(inputMap[id]);
  if (inp) inp.classList.add('error');
}

function clearLoginErrors() {
  ['emailError', 'pwError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  ['loginEmail', 'loginPassword'].forEach(id => {
    document.getElementById(id)?.classList.remove('error');
  });
}

// ===== LOGOUT =====
document.getElementById('logoutBtn').addEventListener('click', e => {
  e.preventDefault();
  currentUser = null; currentRole = null;
  stopCamera();
  updateNavForRole();
  navigate('home');
  showToast('Logged out successfully');
});

function updateNavForRole() {
  const isLoggedIn = !!currentUser;
  const isAdmin = currentRole === 'admin';
  document.getElementById('adminNavLink').style.display      = isAdmin    ? '' : 'none';
  document.getElementById('attendanceNavLink').style.display = isLoggedIn ? '' : 'none';
  document.getElementById('reportsNavLink').style.display    = isLoggedIn ? '' : 'none';
  document.getElementById('logoutNavItem').style.display     = isLoggedIn ? '' : 'none';
}

// ===== USER DASHBOARD =====
function initUserDashboard() {
  const name = currentUser?.name?.split(' ')[0] || 'User';
  document.getElementById('dashWelcomeName').textContent = name;
  document.getElementById('sidebarName').textContent = currentUser?.name || 'User';
  document.getElementById('dashDate').textContent = formatDate(new Date());

  // Render recent table
  const tbody = document.getElementById('userRecentTable');
  tbody.innerHTML = userRecentRecords.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
    </tr>
  `).join('');
}

// ===== ADMIN DASHBOARD =====
function initAdminDashboard() {
  document.getElementById('adminDashDate').textContent = formatDate(new Date());
  const tbody = document.getElementById('adminSummaryTable');
  tbody.innerHTML = adminTodaySummary.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.id}</td>
      <td>${r.time}</td>
      <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
    </tr>
  `).join('');
}

function showAdminTab(tab) { /* placeholder for future tab switching */ }
function showDashTab(tab)  { /* placeholder for future tab switching */ }
window.showAdminTab = showAdminTab;
window.showDashTab  = showDashTab;

// ===== FACE DETECTION PAGE =====
function resetFDPage() {
  stopCamera();
  document.getElementById('fdStatus').className = 'fd-status';
  document.getElementById('fdStatus').textContent = '';
  document.getElementById('captureBtn').disabled = true;
  document.getElementById('stopCameraBtn').style.display = 'none';
  document.getElementById('startCameraBtn').style.display = '';
}

async function startCamera() {
  const placeholder = document.getElementById('cameraPlaceholder');
  const video = document.getElementById('videoFeed');
  const overlay = document.getElementById('scanOverlay');
  const status = document.getElementById('fdStatus');
  const startBtn = document.getElementById('startCameraBtn');
  const stopBtn = document.getElementById('stopCameraBtn');
  const captureBtn = document.getElementById('captureBtn');

  status.className = 'fd-status loading';
  status.textContent = '⏳ Accessing camera...';

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = cameraStream;
    placeholder.style.display = 'none';
    video.style.display = 'block';
    overlay.style.display = 'block';
    startBtn.style.display = 'none';
    stopBtn.style.display = '';

    status.className = 'fd-status loading';
    status.textContent = '🔍 Detecting face...';

    // Simulate face detection after 2s
    detectionTimer = setTimeout(() => {
      document.getElementById('detectionBadge').style.display = 'flex';
      captureBtn.disabled = false;
      status.className = 'fd-status success';
      status.textContent = '✅ Face detected! Ready to capture.';
    }, 2000);

  } catch (err) {
    // Fallback: simulate camera with placeholder (no real webcam needed)
    placeholder.innerHTML = '<i class="fas fa-user-circle" style="font-size:5rem;color:#4f46e5"></i><p>Simulated Camera Feed</p>';
    overlay.style.display = 'block';
    startBtn.style.display = 'none';
    stopBtn.style.display = '';

    status.className = 'fd-status loading';
    status.textContent = '🔍 Simulating face detection...';

    detectionTimer = setTimeout(() => {
      document.getElementById('detectionBadge').style.display = 'flex';
      captureBtn.disabled = false;
      status.className = 'fd-status success';
      status.textContent = '✅ Face detected! Ready to capture.';
    }, 2000);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  clearTimeout(detectionTimer);
  const video = document.getElementById('videoFeed');
  if (video) { video.srcObject = null; video.style.display = 'none'; }
  const placeholder = document.getElementById('cameraPlaceholder');
  if (placeholder) {
    placeholder.style.display = 'flex';
    placeholder.innerHTML = '<i class="fas fa-camera-slash"></i><p>Camera is off</p>';
  }
  const overlay = document.getElementById('scanOverlay');
  if (overlay) overlay.style.display = 'none';
  const badge = document.getElementById('detectionBadge');
  if (badge) badge.style.display = 'none';
  const captureBtn = document.getElementById('captureBtn');
  if (captureBtn) captureBtn.disabled = true;
  const stopBtn = document.getElementById('stopCameraBtn');
  if (stopBtn) stopBtn.style.display = 'none';
  const startBtn = document.getElementById('startCameraBtn');
  if (startBtn) startBtn.style.display = '';
}

function captureAttendance() {
  const status = document.getElementById('fdStatus');
  const captureBtn = document.getElementById('captureBtn');
  captureBtn.disabled = true;
  status.className = 'fd-status loading';
  status.textContent = '⏳ Processing attendance...';

  // Simulate processing delay
  setTimeout(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toISOString().split('T')[0];

    // Add to records
    attendanceRecords.unshift({
      name: currentUser?.name || 'Unknown',
      id: currentUser?.id || 'N/A',
      date: dateStr,
      time: timeStr,
      status: 'Present'
    });

    status.className = 'fd-status success';
    status.innerHTML = `<i class="fas fa-check-circle"></i> Attendance Marked Successfully! — ${timeStr}`;
    showToast('Attendance marked successfully!', 'success');
    stopCamera();
  }, 1500);
}

window.startCamera = startCamera;
window.stopCamera  = stopCamera;
window.captureAttendance = captureAttendance;

// ===== REPORTS PAGE =====
function initReports() {
  renderReportsTable(attendanceRecords);
}

function renderReportsTable(records) {
  const tbody = document.getElementById('reportsBody');
  const count = document.getElementById('reportCount');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:24px">No records found</td></tr>';
    count.textContent = '0 records';
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.id}</td>
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
    </tr>
  `).join('');
  count.textContent = `${records.length} record${records.length !== 1 ? 's' : ''}`;
}

function applyFilter() {
  const date   = document.getElementById('filterDate').value;
  const user   = document.getElementById('filterUser').value.toLowerCase();
  const status = document.getElementById('filterStatus').value.toLowerCase();

  const filtered = attendanceRecords.filter(r => {
    const matchDate   = !date   || r.date === date;
    const matchUser   = !user   || r.name.toLowerCase().includes(user);
    const matchStatus = !status || r.status.toLowerCase() === status;
    return matchDate && matchUser && matchStatus;
  });
  renderReportsTable(filtered);
}

function exportReport() {
  const rows = [['Name', 'ID', 'Date', 'Time', 'Status']];
  attendanceRecords.forEach(r => rows.push([r.name, r.id, r.date, r.time, r.status]));
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'attendance_report.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('Report exported!', 'success');
}

window.applyFilter  = applyFilter;
window.exportReport = exportReport;

// ===== MANAGE USERS PAGE =====
function renderUsersTable() {
  const search = (document.getElementById('userSearch')?.value || '').toLowerCase();
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const filtered = usersList.filter(u =>
    u.name.toLowerCase().includes(search) ||
    u.id.toLowerCase().includes(search) ||
    u.email.toLowerCase().includes(search)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:24px">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.id}</td>
      <td>${u.email}</td>
      <td><span class="role-badge ${u.role === 'staff' ? 'admin' : 'user'}">${capitalize(u.role)}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn btn-edit" onclick="editUser('${u.id}')"><i class="fas fa-pen"></i> Edit</button>
          <button class="btn btn-danger" onclick="deleteUser('${u.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Add / Edit user form submit
document.getElementById('userForm').addEventListener('submit', function (e) {
  e.preventDefault();
  if (!validateUserForm()) return;

  const name  = document.getElementById('uName').value.trim();
  const id    = document.getElementById('uId').value.trim();
  const email = document.getElementById('uEmail').value.trim();
  const role  = document.getElementById('uRole').value;

  if (editingUserId) {
    // Update existing
    const idx = usersList.findIndex(u => u.id === editingUserId);
    if (idx !== -1) usersList[idx] = { id, name, email, role };
    showToast('User updated successfully', 'success');
  } else {
    // Check duplicate ID
    if (usersList.find(u => u.id === id)) {
      document.getElementById('uIdErr').textContent = 'User ID already exists';
      return;
    }
    usersList.push({ id, name, email, role });
    showToast('User added successfully', 'success');
  }

  resetUserForm();
  renderUsersTable();
});

function editUser(userId) {
  const user = usersList.find(u => u.id === userId);
  if (!user) return;
  editingUserId = userId;
  document.getElementById('uName').value  = user.name;
  document.getElementById('uId').value    = user.id;
  document.getElementById('uEmail').value = user.email;
  document.getElementById('uRole').value  = user.role;
  document.getElementById('userFormTitle').innerHTML = '<i class="fas fa-pen"></i> Edit User';
  document.getElementById('userFormBtn').innerHTML   = '<i class="fas fa-save"></i> Save Changes';
  document.getElementById('uId').disabled = true; // don't allow ID change on edit
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  usersList = usersList.filter(u => u.id !== userId);
  renderUsersTable();
  showToast('User deleted', 'error');
}

function resetUserForm() {
  editingUserId = null;
  document.getElementById('userForm').reset();
  document.getElementById('uId').disabled = false;
  document.getElementById('userFormTitle').innerHTML = '<i class="fas fa-user-plus"></i> Add New User';
  document.getElementById('userFormBtn').innerHTML   = '<i class="fas fa-plus"></i> Add User';
  ['uNameErr', 'uIdErr', 'uEmailErr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function validateUserForm() {
  let valid = true;
  const name  = document.getElementById('uName').value.trim();
  const id    = document.getElementById('uId').value.trim();
  const email = document.getElementById('uEmail').value.trim();
  if (!name)  { document.getElementById('uNameErr').textContent  = 'Name is required';  valid = false; }
  if (!id)    { document.getElementById('uIdErr').textContent    = 'ID is required';    valid = false; }
  if (!email) { document.getElementById('uEmailErr').textContent = 'Email is required'; valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('uEmailErr').textContent = 'Enter a valid email'; valid = false;
  }
  return valid;
}

window.editUser      = editUser;
window.deleteUser    = deleteUser;
window.resetUserForm = resetUserForm;
window.renderUsersTable = renderUsersTable;

// ===== TOAST =====
let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== HELPERS =====
function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  navigate('home');
});
