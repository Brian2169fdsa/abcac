// ═══════════════════════════════════════════════════════════
// ABCAC ADMIN CONSOLE — Supabase Integration (admin.js)
// Privileged reads/writes are authorized server-side by Postgres RLS
// (policies keyed on profiles.portal_role = 'admin'). Email/Stripe-type
// side effects go through the admin-notify Edge Function (service role).
// ═══════════════════════════════════════════════════════════

let adminUser = null;
let adminProfile = null;
let membersCache = [];

// ─── Toasts ───
function toast(msg, type) {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(function () { t.remove(); }, 4000);
}

// ─── Helpers ───
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function money(cents) { return '$' + ((cents || 0) / 100).toFixed(2); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function title(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
}
function badge(status) {
  const map = {
    active: 'b-green', approved: 'b-green', paid: 'b-green', completed: 'b-green', sent: 'b-green',
    pending: 'b-amber', under_review: 'b-amber', submitted: 'b-blue',
    rejected: 'b-red', expired: 'b-red', unpaid: 'b-red', suspended: 'b-red'
  };
  return '<span class="badge ' + (map[status] || 'b-gray') + '">' + esc(title(status || 'unknown')) + '</span>';
}
function memberName(p) {
  if (!p) return '—';
  return esc(((p.first_name || '') + ' ' + (p.last_name || '')).trim() || p.email || '—');
}
function setBtn(btn, loading) {
  if (!btn) return;
  if (loading) { btn.dataset.t = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
  else { btn.disabled = false; btn.textContent = btn.dataset.t || 'Submit'; }
}

// ─── Audit + notify (best-effort) ───
async function audit(action, table, id, details) {
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: adminUser.id, action: action, target_table: table, target_id: id, details: details || null
    });
  } catch (e) { /* non-blocking */ }
}
async function notifyMember(memberId, subject, message) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(SUPABASE_URL + '/functions/v1/admin-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session ? session.access_token : '') },
      body: JSON.stringify({ member_id: memberId, subject: subject, message: message })
    });
  } catch (e) { /* email is best-effort; DB write already succeeded */ }
}

// ═══ AUTH ═══
async function adminLogin() {
  const email = document.getElementById('admEmail').value.trim();
  const password = document.getElementById('admPassword').value;
  if (!email || !password) { toast('Enter email and password.', 'warning'); return; }
  const btn = document.getElementById('admLoginBtn');
  setBtn(btn, true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast('Login failed: ' + error.message, 'error'); return; }
    const ok = await enterConsole(data.user);
    if (!ok) await supabase.auth.signOut();
  } catch (e) {
    toast('Unexpected error. Try again.', 'error');
  } finally {
    setBtn(btn, false);
  }
}

async function enterConsole(user) {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.portal_role !== 'admin') {
    toast('This account does not have admin access.', 'error');
    return false;
  }
  adminUser = user;
  adminProfile = profile;
  document.getElementById('whoami').textContent = memberName(profile) + ' · Admin';
  document.getElementById('authGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  await loadEverything();
  return true;
}

async function adminLogout() {
  try { await supabase.auth.signOut(); } catch (e) {}
  adminUser = null; adminProfile = null;
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('authGate').classList.remove('hidden');
  document.getElementById('admPassword').value = '';
}

window.addEventListener('DOMContentLoaded', async function () {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await enterConsole(session.user);
  } catch (e) { /* show gate */ }
});

// ═══ NAV ═══
function nav(page) {
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav a').forEach(function (a) { a.classList.remove('active'); });
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  const link = document.querySelector('.nav a[data-page="' + page + '"]');
  if (link) link.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');
}

// ═══ LOAD EVERYTHING ═══
async function loadEverything() {
  await Promise.all([
    loadAccountApprovals(), loadDocuments(), loadCEUs(), loadApplications(), loadRequests(), loadMembers()
  ]);
}

// ═══ ACCOUNT APPROVALS ═══
async function loadAccountApprovals() {
  const body = document.getElementById('approvalsBody');
  if (!body) return;
  // Pending accounts that have been submitted for review.
  const { data, error } = await supabase
    .from('profiles')
    .select('*, certifications(cert_type,cert_number,status)')
    .eq('account_status', 'pending')
    .not('account_submitted_at', 'is', null)
    .order('account_submitted_at', { ascending: true });
  if (error) { body.innerHTML = '<tr><td colspan="6" class="empty">Error loading.</td></tr>'; return; }
  setCount('sApprovals', 'cntApprovals', (data || []).length);
  if (!data || !data.length) { body.innerHTML = '<tr><td colspan="6" class="empty">No accounts awaiting approval.</td></tr>'; return; }
  body.innerHTML = data.map(function (p) {
    var certs = (p.certifications || []).filter(function (c) { return c.status === 'pending'; })
      .map(function (c) { return esc(c.cert_type) + (c.cert_number ? ' (' + esc(c.cert_number) + ')' : ''); }).join(', ') || '—';
    return '<tr>' +
      '<td>' + memberName(p) + '</td>' +
      '<td>' + esc(p.email) + '</td>' +
      '<td>' + esc(p.phone || '—') + '</td>' +
      '<td>' + certs + '</td>' +
      '<td>' + fmtDate(p.account_submitted_at) + '</td>' +
      '<td><div class="row-actions">' +
      '<button class="btn btn-sm btn-green" onclick="approveAccount(\'' + p.id + '\')">Approve</button>' +
      '<button class="btn btn-sm btn-red" onclick="rejectAccount(\'' + p.id + '\')">Reject</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

async function approveAccount(id) {
  const { error } = await supabase.from('profiles')
    .update({ account_status: 'approved', account_reviewed_at: new Date().toISOString(), account_review_notes: null })
    .eq('id', id);
  if (error) { toast('Approve failed: ' + error.message, 'error'); return; }
  // Activate the member's self-reported certifications.
  await supabase.from('certifications').update({ status: 'active' }).eq('member_id', id).eq('status', 'pending');
  await audit('account_approved', 'profiles', id, null);
  notifyMember(id, 'Your ABCAC account is approved', 'Welcome! Your member portal account has been approved. You can now sign in and access the full portal.');
  toast('Account approved.', 'success');
  loadAccountApprovals();
}

function rejectAccount(id) {
  promptNotes('Account', 'rejected', async function (notes) {
    const { error } = await supabase.from('profiles')
      .update({ account_status: 'rejected', account_reviewed_at: new Date().toISOString(), account_review_notes: notes || null })
      .eq('id', id);
    if (error) { toast('Reject failed: ' + error.message, 'error'); return; }
    await audit('account_rejected', 'profiles', id, { notes: notes });
    notifyMember(id, 'Your ABCAC account needs changes', 'Your account registration needs updates before approval.' + (notes ? ' Note: ' + notes : '') + ' Please sign in to update and resubmit.');
    toast('Account marked for changes.', 'success');
    loadAccountApprovals();
  });
}

function setCount(elId, navId, n) {
  const el = document.getElementById(elId);
  if (el) el.textContent = n;
  const nc = document.getElementById(navId);
  if (nc) { nc.textContent = n; nc.classList.toggle('zero', !n); }
}

// ═══ DOCUMENTS ═══
async function loadDocuments() {
  const body = document.getElementById('docsBody');
  const { data, error } = await supabase
    .from('documents')
    .select('*, profiles(first_name,last_name,email)')
    .order('uploaded_at', { ascending: false });
  if (error) { body.innerHTML = '<tr><td colspan="6" class="empty">Error loading.</td></tr>'; return; }
  const pending = (data || []).filter(function (d) { return d.status === 'pending'; }).length;
  setCount('sDocs', 'cntDocs', pending);
  if (!data || !data.length) { body.innerHTML = '<tr><td colspan="6" class="empty">No documents.</td></tr>'; return; }
  body.innerHTML = data.map(function (d) {
    return '<tr>' +
      '<td>' + memberName(d.profiles) + '</td>' +
      '<td>' + esc(title(d.document_type)) + '</td>' +
      '<td><a href="#" onclick="viewFile(\'member-documents\',\'' + esc(d.file_path) + '\');return false;">' + esc(d.file_name) + '</a></td>' +
      '<td>' + fmtDate(d.uploaded_at) + '</td>' +
      '<td>' + badge(d.status) + '</td>' +
      '<td><div class="row-actions">' + reviewButtons('reviewDoc', d.id, d.status) + '</div></td>' +
      '</tr>';
  }).join('');
}

function reviewButtons(fn, id, status) {
  if (status === 'pending') {
    return '<button class="btn btn-sm btn-green" onclick="' + fn + '(\'' + id + '\',\'approved\')">Approve</button>' +
           '<button class="btn btn-sm btn-red" onclick="' + fn + '(\'' + id + '\',\'rejected\')">Reject</button>';
  }
  return '<button class="btn btn-sm btn-outline" onclick="' + fn + '(\'' + id + '\',\'pending\')">Reopen</button>';
}

async function reviewDoc(id, status) {
  promptNotes('Document', status, async function (notes) {
    const { data, error } = await supabase.from('documents')
      .update({ status: status, admin_notes: notes || null, reviewed_at: new Date().toISOString() })
      .eq('id', id).select('member_id, document_type').single();
    if (error) { toast('Update failed: ' + error.message, 'error'); return; }
    await audit('document_' + status, 'documents', id, { notes: notes });
    notifyMember(data.member_id, 'Document ' + title(status), 'Your ' + title(data.document_type) + ' document has been ' + status + '.' + (notes ? ' Note: ' + notes : ''));
    toast('Document ' + status + '.', 'success');
    loadDocuments();
  });
}

// ═══ CEUs ═══
async function loadCEUs() {
  const body = document.getElementById('ceusBody');
  const { data, error } = await supabase
    .from('ceu_records')
    .select('*, profiles(first_name,last_name,email)')
    .order('submitted_at', { ascending: false });
  if (error) { body.innerHTML = '<tr><td colspan="9" class="empty">Error loading.</td></tr>'; return; }
  const pending = (data || []).filter(function (r) { return r.status === 'pending'; }).length;
  setCount('sCeus', 'cntCeus', pending);
  if (!data || !data.length) { body.innerHTML = '<tr><td colspan="9" class="empty">No CEU submissions.</td></tr>'; return; }
  body.innerHTML = data.map(function (r) {
    return '<tr>' +
      '<td>' + memberName(r.profiles) + '</td>' +
      '<td>' + esc(r.course_name) + '</td>' +
      '<td>' + esc(r.provider) + '</td>' +
      '<td>' + esc(r.hours) + '</td>' +
      '<td>' + esc(r.category) + '</td>' +
      '<td>' + fmtDate(r.completion_date) + '</td>' +
      '<td>' + (r.certificate_url ? '<a href="#" onclick="viewFile(\'ceu-certificates\',\'' + esc(r.certificate_url) + '\');return false;">View</a>' : '—') + '</td>' +
      '<td>' + badge(r.status) + '</td>' +
      '<td><div class="row-actions">' + reviewButtons('reviewCEU', r.id, r.status) + '</div></td>' +
      '</tr>';
  }).join('');
}

async function reviewCEU(id, status) {
  promptNotes('CEU', status, async function (notes) {
    const { data, error } = await supabase.from('ceu_records')
      .update({ status: status, admin_notes: notes || null, reviewed_at: new Date().toISOString() })
      .eq('id', id).select('member_id, course_name, hours').single();
    if (error) { toast('Update failed: ' + error.message, 'error'); return; }
    await audit('ceu_' + status, 'ceu_records', id, { notes: notes });
    notifyMember(data.member_id, 'CEU ' + title(status), 'Your CEU submission "' + data.course_name + '" (' + data.hours + ' hrs) has been ' + status + '.' + (notes ? ' Note: ' + notes : ''));
    toast('CEU ' + status + '.', 'success');
    loadCEUs();
  });
}

// ═══ APPLICATIONS ═══
async function loadApplications() {
  const body = document.getElementById('appsBody');
  const { data, error } = await supabase
    .from('applications')
    .select('*, profiles(first_name,last_name,email)')
    .order('submitted_at', { ascending: false });
  if (error) { body.innerHTML = '<tr><td colspan="6" class="empty">Error loading.</td></tr>'; return; }
  const open = (data || []).filter(function (a) { return a.status !== 'approved' && a.status !== 'rejected'; }).length;
  setCount('sApps', 'cntApps', open);
  if (!data || !data.length) { body.innerHTML = '<tr><td colspan="6" class="empty">No applications.</td></tr>'; return; }
  body.innerHTML = data.map(function (a) {
    return '<tr>' +
      '<td>' + memberName(a.profiles) + '</td>' +
      '<td>' + esc(title(a.app_type)) + '</td>' +
      '<td>' + esc(a.cert_type || '—') + '</td>' +
      '<td>' + fmtDate(a.submitted_at) + '</td>' +
      '<td>' + badge(a.status) + '</td>' +
      '<td><button class="btn btn-sm btn-outline" onclick="editApplication(\'' + a.id + '\')">Update</button></td>' +
      '</tr>';
  }).join('');
  window._apps = data;
}

function editApplication(id) {
  const a = (window._apps || []).find(function (x) { return x.id === id; });
  if (!a) return;
  const statuses = ['submitted', 'under_review', 'approved', 'rejected'];
  const opts = statuses.map(function (s) { return '<option value="' + s + '"' + (a.status === s ? ' selected' : '') + '>' + title(s) + '</option>'; }).join('');
  openModal('Update Application', '#page-applications',
    '<div class="kv"><b>Member</b><span>' + memberName(a.profiles) + '</span></div>' +
    '<div class="kv"><b>Type</b><span>' + esc(title(a.app_type)) + '</span></div>' +
    '<div class="fld" style="margin-top:14px;"><label>Status</label><select class="select" id="appStatus">' + opts + '</select></div>' +
    '<div class="fld" style="margin-top:12px;"><label>Est. Completion</label><input class="input" type="date" id="appEst" value="' + (a.est_completion || '') + '"></div>' +
    '<div class="fld" style="margin-top:12px;"><label>Notes to member</label><textarea class="textarea" id="appNotes">' + esc(a.admin_notes || '') + '</textarea></div>',
    'Save', async function () {
      const status = document.getElementById('appStatus').value;
      const est = document.getElementById('appEst').value || null;
      const notes = document.getElementById('appNotes').value || null;
      const { error } = await supabase.from('applications')
        .update({ status: status, est_completion: est, admin_notes: notes, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { toast('Update failed: ' + error.message, 'error'); return false; }
      await audit('application_update', 'applications', id, { status: status });
      notifyMember(a.member_id, 'Application Update', 'Your ' + title(a.app_type) + ' application status is now: ' + title(status) + '.' + (notes ? ' ' + notes : ''));
      toast('Application updated.', 'success');
      loadApplications();
      return true;
    });
}

// ═══ REQUESTS (name change / verification / reciprocity) ═══
async function loadRequests() {
  let pending = 0;
  // Name change
  const nc = await supabase.from('name_change_requests').select('*, profiles(first_name,last_name,email)').order('submitted_at', { ascending: false });
  const ncBody = document.getElementById('ncBody');
  pending += (nc.data || []).filter(function (r) { return r.status === 'pending'; }).length;
  ncBody.innerHTML = (nc.data && nc.data.length) ? nc.data.map(function (r) {
    return '<tr><td>' + memberName(r.profiles) + '</td><td>' + esc(r.current_name) + '</td><td>' + esc(r.new_name) + '</td><td>' + esc(r.reason) + '</td>' +
      '<td>' + (r.doc_path ? '<a href="#" onclick="viewFile(\'name-change-docs\',\'' + esc(r.doc_path) + '\');return false;">View</a>' : '—') + '</td>' +
      '<td>' + badge(r.status) + '</td><td><div class="row-actions">' +
      reqButtons('reviewReq', 'name_change_requests', r.id, r.status, r.member_id, 'Name change') + '</div></td></tr>';
  }).join('') : '<tr><td colspan="7" class="empty">No name change requests.</td></tr>';
  // Verification
  const ver = await supabase.from('verification_requests').select('*, profiles(first_name,last_name,email)').order('submitted_at', { ascending: false });
  const verBody = document.getElementById('verBody');
  pending += (ver.data || []).filter(function (r) { return r.status === 'pending'; }).length;
  verBody.innerHTML = (ver.data && ver.data.length) ? ver.data.map(function (r) {
    return '<tr><td>' + memberName(r.profiles) + '</td><td>' + esc(r.purpose) + '</td><td>' + esc(r.recipient_name) + '</td><td>' + esc(r.recipient_email || '—') + '</td>' +
      '<td>' + badge(r.status) + '</td><td><div class="row-actions">' +
      reqButtons('reviewReq', 'verification_requests', r.id, r.status, r.member_id, 'Verification', 'completed') + '</div></td></tr>';
  }).join('') : '<tr><td colspan="6" class="empty">No verification requests.</td></tr>';
  // Reciprocity
  const rec = await supabase.from('reciprocity_requests').select('*, profiles(first_name,last_name,email)').order('submitted_at', { ascending: false });
  const recBody = document.getElementById('recBody');
  pending += (rec.data || []).filter(function (r) { return r.status === 'pending'; }).length;
  recBody.innerHTML = (rec.data && rec.data.length) ? rec.data.map(function (r) {
    return '<tr><td>' + memberName(r.profiles) + '</td><td>' + esc(title(r.direction)) + '</td><td>' + esc(r.credential || '—') + '</td><td>' + esc(r.destination || '—') + '</td>' +
      '<td>' + badge(r.status) + '</td><td><div class="row-actions">' +
      reqButtons('reviewReq', 'reciprocity_requests', r.id, r.status, r.member_id, 'Reciprocity', 'completed') + '</div></td></tr>';
  }).join('') : '<tr><td colspan="6" class="empty">No reciprocity requests.</td></tr>';

  setCount('sReqs', 'cntReqs', pending);
}

function reqButtons(fn, table, id, status, memberId, label, doneStatus) {
  doneStatus = doneStatus || 'approved';
  if (status === 'pending') {
    return '<button class="btn btn-sm btn-green" onclick="' + fn + '(\'' + table + '\',\'' + id + '\',\'' + doneStatus + '\',\'' + memberId + '\',\'' + label + '\')">Complete</button>' +
           '<button class="btn btn-sm btn-red" onclick="' + fn + '(\'' + table + '\',\'' + id + '\',\'rejected\',\'' + memberId + '\',\'' + label + '\')">Reject</button>';
  }
  return '<button class="btn btn-sm btn-outline" onclick="' + fn + '(\'' + table + '\',\'' + id + '\',\'pending\',\'' + memberId + '\',\'' + label + '\')">Reopen</button>';
}

async function reviewReq(table, id, status, memberId, label) {
  const update = { status: status };
  if (table === 'verification_requests' && status === 'completed') update.completed_at = new Date().toISOString();
  else update.reviewed_at = new Date().toISOString();
  const { error } = await supabase.from(table).update(update).eq('id', id);
  if (error) { toast('Update failed: ' + error.message, 'error'); return; }
  await audit(table + '_' + status, table, id, null);
  notifyMember(memberId, label + ' Request ' + title(status), 'Your ' + label.toLowerCase() + ' request has been ' + status + '.');
  toast(label + ' request ' + status + '.', 'success');
  loadRequests();
}

// ═══ MEMBERS ═══
async function loadMembers() {
  const body = document.getElementById('membersBody');
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) { body.innerHTML = '<tr><td colspan="6" class="empty">Error loading.</td></tr>'; return; }
  membersCache = data || [];
  setCount('sMembers', null, membersCache.length);
  renderMembers(membersCache);
  populateMemberSelects();
}

function renderMembers(list) {
  const body = document.getElementById('membersBody');
  if (!list.length) { body.innerHTML = '<tr><td colspan="6" class="empty">No members found.</td></tr>'; return; }
  body.innerHTML = list.map(function (p) {
    return '<tr>' +
      '<td>' + memberName(p) + '</td>' +
      '<td>' + esc(p.email) + '</td>' +
      '<td>' + badge(p.cert_status) + '</td>' +
      '<td>' + esc(title(p.portal_role)) + '</td>' +
      '<td>' + fmtDate(p.created_at) + '</td>' +
      '<td><button class="btn btn-sm btn-outline" onclick="memberDetail(\'' + p.id + '\')">Manage</button></td>' +
      '</tr>';
  }).join('');
}

function filterMembers() {
  const q = document.getElementById('memberSearch').value.toLowerCase().trim();
  if (!q) { renderMembers(membersCache); return; }
  renderMembers(membersCache.filter(function (p) {
    return ((p.first_name || '') + ' ' + (p.last_name || '') + ' ' + (p.email || '')).toLowerCase().indexOf(q) !== -1;
  }));
}

async function memberDetail(id) {
  const p = membersCache.find(function (m) { return m.id === id; });
  if (!p) return;
  const { data: certs } = await supabase.from('certifications').select('*').eq('member_id', id).order('issued_date', { ascending: false });
  const certRows = (certs && certs.length)
    ? certs.map(function (c) { return '<div class="kv"><b>' + esc(c.cert_type) + (c.cert_number ? ' (' + esc(c.cert_number) + ')' : '') + '</b><span>' + badge(c.status) + '</span></div>'; }).join('')
    : '<div style="color:var(--gray-400);padding:6px 0;">No certifications issued.</div>';
  const certStatuses = ['applying', 'active_holder', 'reciprocity_transfer', 'active', 'expired', 'suspended'];
  const roleOpts = ['member', 'admin'].map(function (r) { return '<option value="' + r + '"' + (p.portal_role === r ? ' selected' : '') + '>' + title(r) + '</option>'; }).join('');
  const csOpts = certStatuses.map(function (s) { return '<option value="' + s + '"' + (p.cert_status === s ? ' selected' : '') + '>' + title(s) + '</option>'; }).join('');

  openModal('Manage Member', '#page-members',
    '<div class="kv"><b>Name</b><span>' + memberName(p) + '</span></div>' +
    '<div class="kv"><b>Email</b><span>' + esc(p.email) + '</span></div>' +
    '<div class="kv"><b>Phone</b><span>' + esc(p.phone || '—') + '</span></div>' +
    '<div class="fld" style="margin-top:14px;"><label>Certification Status</label><select class="select" id="mdCertStatus">' + csOpts + '</select></div>' +
    '<div class="fld" style="margin-top:12px;"><label>Portal Role</label><select class="select" id="mdRole">' + roleOpts + '</select></div>' +
    '<h4 style="margin:18px 0 8px;">Certifications</h4>' + certRows +
    '<button class="btn btn-sm btn-gold" style="margin-top:12px;" onclick="issueCertForm(\'' + id + '\')">+ Issue Certification</button>',
    'Save Member', async function () {
      const { error } = await supabase.from('profiles')
        .update({ cert_status: document.getElementById('mdCertStatus').value, portal_role: document.getElementById('mdRole').value })
        .eq('id', id);
      if (error) { toast('Save failed: ' + error.message, 'error'); return false; }
      await audit('member_update', 'profiles', id, null);
      toast('Member updated.', 'success');
      loadMembers();
      return true;
    });
}

function issueCertForm(memberId) {
  openModal('Issue Certification', '#page-members',
    '<div class="fld"><label>Certification Type</label><input class="input" id="icType" placeholder="e.g. LSAT, LISAC, CCS"></div>' +
    '<div class="fld" style="margin-top:12px;"><label>Certificate Number</label><input class="input" id="icNumber" placeholder="Optional"></div>' +
    '<div class="fld" style="margin-top:12px;"><label>IC&RC Level</label><input class="input" id="icLevel" placeholder="Optional"></div>' +
    '<div class="form-grid" style="padding:0;margin-top:12px;">' +
    '<div class="fld"><label>Issued</label><input class="input" type="date" id="icIssued"></div>' +
    '<div class="fld"><label>Expires</label><input class="input" type="date" id="icExpires"></div></div>',
    'Issue', async function () {
      const type = document.getElementById('icType').value.trim();
      if (!type) { toast('Certification type is required.', 'warning'); return false; }
      const { error } = await supabase.from('certifications').insert({
        member_id: memberId, cert_type: type,
        cert_number: document.getElementById('icNumber').value.trim() || null,
        ic_rc_level: document.getElementById('icLevel').value.trim() || null,
        issued_date: document.getElementById('icIssued').value || null,
        expiration_date: document.getElementById('icExpires').value || null,
        status: 'active'
      });
      if (error) { toast('Failed: ' + error.message, 'error'); return false; }
      await audit('certification_issued', 'certifications', memberId, { cert_type: type });
      notifyMember(memberId, 'Certification Issued', 'Your ' + type + ' certification has been issued and is now visible in your portal.');
      toast('Certification issued.', 'success');
      return true;
    });
}

// ═══ MEMBER SELECTS (messaging / invoices) ═══
function populateMemberSelects() {
  const opts = '<option value="">— Select member —</option>' + membersCache.map(function (p) {
    return '<option value="' + p.id + '">' + memberName(p) + ' (' + esc(p.email) + ')</option>';
  }).join('');
  ['msgMember', 'invMember'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

// ═══ SEND MESSAGE ═══
async function sendMessage() {
  const memberId = document.getElementById('msgMember').value;
  const subject = document.getElementById('msgSubject').value.trim();
  const body = document.getElementById('msgBody').value.trim();
  if (!memberId || !subject) { toast('Select a member and enter a subject.', 'warning'); return; }
  const { data, error } = await supabase.from('messages').insert({
    member_id: memberId, from_name: 'ABCAC Admin', subject: subject, body: body, is_read: false
  }).select('id').single();
  if (error) { toast('Send failed: ' + error.message, 'error'); return; }
  await audit('message_sent', 'messages', data.id, null);
  notifyMember(memberId, subject, body);
  document.getElementById('msgSubject').value = '';
  document.getElementById('msgBody').value = '';
  toast('Message sent.', 'success');
}

// ═══ CREATE INVOICE ═══
async function createInvoice() {
  const memberId = document.getElementById('invMember').value;
  const desc = document.getElementById('invDesc').value.trim();
  const amount = parseFloat(document.getElementById('invAmount').value);
  if (!memberId || !desc || !(amount > 0)) { toast('Select a member, description, and amount.', 'warning'); return; }
  const invoiceNumber = 'INV-' + Date.now().toString(36).toUpperCase();
  const { data, error } = await supabase.from('invoices').insert({
    member_id: memberId, invoice_number: invoiceNumber, description: desc,
    amount_cents: Math.round(amount * 100), status: 'unpaid'
  }).select('id').single();
  if (error) { toast('Failed: ' + error.message, 'error'); return; }
  await audit('invoice_created', 'invoices', data.id, { amount_cents: Math.round(amount * 100) });
  notifyMember(memberId, 'New Invoice: ' + desc, 'A new invoice (' + invoiceNumber + ') for ' + money(Math.round(amount * 100)) + ' is available in your portal.');
  document.getElementById('invDesc').value = '';
  document.getElementById('invAmount').value = '';
  toast('Invoice ' + invoiceNumber + ' created.', 'success');
}

// ═══ FILE VIEWER (signed URL) ═══
async function viewFile(bucket, path) {
  if (!path) return;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) { toast('Could not open file.', 'error'); return; }
  window.open(data.signedUrl, '_blank');
}

// ═══ MODAL + NOTES PROMPT ═══
function openModal(title, _anchor, bodyHtml, confirmLabel, onConfirm) {
  closeModal();
  const root = document.getElementById('modalRoot');
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.id = 'activeModal';
  wrap.innerHTML =
    '<div class="modal-box">' +
    '<div class="modal-h"><span>' + esc(title) + '</span><span class="x" onclick="closeModal()">&times;</span></div>' +
    '<div class="modal-b">' + bodyHtml + '</div>' +
    '<div class="modal-f"><button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" id="modalConfirm">' + esc(confirmLabel || 'Confirm') + '</button></div>' +
    '</div>';
  root.appendChild(wrap);
  document.getElementById('modalConfirm').onclick = async function () {
    const btn = this;
    setBtn(btn, true);
    const ok = await onConfirm();
    setBtn(btn, false);
    if (ok !== false) closeModal();
  };
}
function closeModal() {
  const m = document.getElementById('activeModal');
  if (m) m.remove();
}

// Approve/reject notes prompt (optional note)
function promptNotes(label, status, onConfirm) {
  openModal(label + ' — ' + title(status), null,
    '<div class="fld"><label>Note to member (optional)</label><textarea class="textarea" id="reviewNotes" placeholder="' +
    (status === 'rejected' ? 'Reason for rejection…' : 'Optional note…') + '"></textarea></div>',
    title(status), async function () {
      const notes = document.getElementById('reviewNotes').value.trim();
      await onConfirm(notes);
      return true;
    });
}

document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
