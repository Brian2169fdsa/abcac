// ═══════════════════════════════════════════════════════════
// ABCAC MEMBER PORTAL — Supabase Integration (portal.js)
// ═══════════════════════════════════════════════════════════

// Current user reference
let currentUser = null;
let currentProfile = null;

// ═══ TOAST NOTIFICATION SYSTEM ═══
function showNotification(message, type) {
  type = type || 'info';
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;

  const icons = {
    success: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
    error: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    info: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>'
  };

  toast.innerHTML =
    '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
    '<span class="toast-message">' + message + '</span>' +
    '<button class="toast-close" onclick="this.parentElement.remove()">&times;</button>';

  container.appendChild(toast);
  requestAnimationFrame(function() { toast.classList.add('toast-visible'); });
  setTimeout(function() {
    toast.classList.remove('toast-visible');
    setTimeout(function() { toast.remove(); }, 300);
  }, 4000);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// ═══ UTILITY FUNCTIONS ═══
function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function getStatusBadge(status) {
  const colors = {
    active: { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)' },
    approved: { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)' },
    paid: { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)' },
    completed: { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)' },
    sent: { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)' },
    pending: { bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-border)' },
    under_review: { bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-border)' },
    submitted: { bg: 'var(--blue-bg)', color: 'var(--blue)', border: 'var(--blue-border)' },
    draft: { bg: 'var(--gray-100)', color: 'var(--gray-500)', border: 'var(--gray-200)' },
    expired: { bg: 'var(--red-bg)', color: 'var(--red)', border: 'var(--red-border)' },
    rejected: { bg: 'var(--red-bg)', color: 'var(--red)', border: 'var(--red-border)' },
    suspended: { bg: 'var(--red-bg)', color: 'var(--red)', border: 'var(--red-border)' },
    unpaid: { bg: 'var(--red-bg)', color: 'var(--red)', border: 'var(--red-border)' }
  };
  const c = colors[status] || colors.pending;
  const label = (status || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
  return '<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;background:' + c.bg + ';color:' + c.color + ';border:1px solid ' + c.border + ';">' + label + '</span>';
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Please wait...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Submit';
  }
}

// ═══ AUTH: SIGN IN ═══
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showNotification('Please enter your email and password.', 'warning');
    return;
  }

  const btn = document.querySelector('#formLogin .auth-btn');
  setButtonLoading(btn, true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showNotification('Login failed: ' + error.message, 'error');
      return;
    }

    currentUser = data.user;
    await loadPortal(data.user);

    const gw = document.getElementById('authGateway');
    gw.classList.add('hidden');
    setTimeout(function() { gw.style.display = 'none'; }, 400);

    showNotification('Welcome back!', 'success');
  } catch (err) {
    showNotification('An unexpected error occurred. Please try again.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ═══ AUTH: SIGN UP ═══
async function doSignup() {
  const form = document.getElementById('formSignup');

  const first = form.querySelector('input[placeholder="First name"]').value.trim();
  const last = form.querySelector('input[placeholder="Last name"]').value.trim();
  const email = form.querySelector('input[placeholder="you@example.com"]').value.trim();
  const phone = form.querySelector('input[placeholder="(480) 555-0123"]').value.trim();
  const password = form.querySelector('input[placeholder="Min. 8 characters"]').value;
  const confirmPassword = form.querySelector('input[placeholder="Confirm password"]').value;
  const certStatusSelect = form.querySelector('select');
  const certStatus = certStatusSelect ? certStatusSelect.value : '';
  const termsChecked = form.querySelector('input[type="checkbox"]').checked;

  // Validation
  if (!first || !last || !email || !password) {
    showNotification('Please fill in all required fields.', 'warning');
    return;
  }
  if (password.length < 8) {
    showNotification('Password must be at least 8 characters.', 'warning');
    return;
  }
  if (password !== confirmPassword) {
    showNotification('Passwords do not match.', 'warning');
    return;
  }
  if (!termsChecked) {
    showNotification('Please agree to the Code of Ethics and Terms of Use.', 'warning');
    return;
  }

  const btn = form.querySelector('.auth-btn');
  setButtonLoading(btn, true);

  const certStatusMap = {
    'Active ABCAC certification holder': 'active_holder',
    'Applying for initial certification': 'applying',
    'Transferring via IC&RC reciprocity': 'reciprocity_transfer'
  };

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: first,
          last_name: last,
          phone: phone,
          cert_status: certStatusMap[certStatus] || 'applying'
        }
      }
    });

    if (error) {
      showNotification('Sign up failed: ' + error.message, 'error');
      return;
    }

    // Update profile with additional fields
    if (data.user) {
      await supabase.from('profiles').update({
        first_name: first,
        last_name: last,
        phone: phone,
        cert_status: certStatusMap[certStatus] || 'applying'
      }).eq('id', data.user.id);
    }

    showNotification('Account created! Check your email to confirm your address.', 'success');
    if (typeof switchAuthTab === 'function') switchAuthTab('login');
  } catch (err) {
    showNotification('An unexpected error occurred. Please try again.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ═══ AUTH: FORGOT PASSWORD ═══
async function doForgotPassword() {
  const form = document.getElementById('formForgot');
  const email = form.querySelector('input[type="email"]').value.trim();

  if (!email) {
    showNotification('Please enter your email address.', 'warning');
    return;
  }

  const btn = form.querySelector('.auth-btn');
  setButtonLoading(btn, true);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password'
    });

    if (error) {
      showNotification('Error: ' + error.message, 'error');
      return;
    }

    showNotification('Password reset link sent! Check your email.', 'success');
  } catch (err) {
    showNotification('An unexpected error occurred.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ═══ AUTH: SIGN OUT ═══
async function doLogout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    // Sign out locally regardless
  }

  currentUser = null;
  currentProfile = null;

  const gw = document.getElementById('authGateway');
  gw.style.display = 'flex';
  gw.classList.remove('hidden');
  if (typeof switchAuthTab === 'function') switchAuthTab('login');

  document.querySelectorAll('.auth-input').forEach(function(i) {
    if (i.type !== 'checkbox') i.value = '';
  });

  showNotification('You have been signed out.', 'info');
}

// ═══ SESSION CHECK ON PAGE LOAD ═══
window.addEventListener('DOMContentLoaded', async function() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      await loadPortal(session.user);
      document.getElementById('authGateway').style.display = 'none';
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }

  // Listen for auth state changes (email confirmation redirect, etc.)
  supabase.auth.onAuthStateChange(async function(event, session) {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      await loadPortal(session.user);
      document.getElementById('authGateway').style.display = 'none';
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
    }
  });
});

// ═══ LOAD PORTAL DATA ═══
async function loadPortal(user) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      currentProfile = profile;

      // Update welcome name
      document.querySelectorAll('.welcome-banner h2 span, .welcome-name').forEach(function(el) {
        el.textContent = profile.first_name || 'Member';
      });

      // Update topbar avatar initials
      const avatarEl = document.querySelector('.topbar-avatar');
      if (avatarEl && profile.first_name) {
        avatarEl.textContent = (profile.first_name[0] + (profile.last_name ? profile.last_name[0] : '')).toUpperCase();
      }

      // Update topbar username display
      const userNameEl = document.querySelector('.topbar-user-name');
      if (userNameEl) {
        userNameEl.textContent = (profile.first_name || '') + ' ' + (profile.last_name || '');
      }

      populatePersonalInfo(profile);
    }

    // Load all data sections in parallel
    await Promise.all([
      loadCertifications(user.id),
      loadCEURecords(user.id),
      loadDocuments(user.id),
      loadMessageCount(user.id),
      loadInvoices(user.id),
      loadEmploymentRecords(user.id),
      loadOtherCertifications(user.id),
      loadApplications(user.id)
    ]);
  } catch (err) {
    console.error('Error loading portal:', err);
    showNotification('Error loading portal data. Please refresh.', 'error');
  }
}

// ═══ POPULATE PERSONAL INFO ═══
function populatePersonalInfo(profile) {
  const fieldMap = {
    'profileFirstName': profile.first_name,
    'profileMiddleName': profile.middle_name,
    'profileLastName': profile.last_name,
    'profileEmail': profile.email,
    'profilePhone': profile.phone,
    'profileDOB': profile.date_of_birth,
    'profileSSN4': profile.ssn_last4,
    'profileAddress': profile.address_line1,
    'profileCity': profile.city,
    'profileState': profile.state,
    'profileZip': profile.zip_code
  };

  Object.keys(fieldMap).forEach(function(id) {
    const el = document.getElementById(id);
    if (el && fieldMap[id]) el.value = fieldMap[id];
  });
}

// ═══ SAVE PERSONAL INFO ═══
async function savePersonalInfo() {
  if (!currentUser) return;

  const getValue = function(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : null;
  };

  const updates = {
    first_name: getValue('profileFirstName'),
    middle_name: getValue('profileMiddleName'),
    last_name: getValue('profileLastName'),
    phone: getValue('profilePhone'),
    date_of_birth: getValue('profileDOB') || null,
    ssn_last4: getValue('profileSSN4'),
    address_line1: getValue('profileAddress'),
    city: getValue('profileCity'),
    state: getValue('profileState'),
    zip_code: getValue('profileZip')
  };

  try {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', currentUser.id);

    if (error) throw error;

    currentProfile = Object.assign({}, currentProfile, updates);

    // Update display name
    const avatarEl = document.querySelector('.topbar-avatar');
    if (avatarEl && updates.first_name) {
      avatarEl.textContent = (updates.first_name[0] + (updates.last_name ? updates.last_name[0] : '')).toUpperCase();
    }
    document.querySelectorAll('.welcome-banner h2 span, .welcome-name').forEach(function(el) {
      el.textContent = updates.first_name || 'Member';
    });

    showNotification('Personal information saved successfully.', 'success');
  } catch (err) {
    showNotification('Failed to save: ' + (err.message || 'Unknown error'), 'error');
  }
}

// ═══ GENERIC TABLE LOADER ═══
async function loadTableData(tableName, memberId, tbodyId, rowRenderer, orderCol) {
  orderCol = orderCol || 'created_at';
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return [];

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('member_id', memberId)
      .order(orderCol, { ascending: false });

    if (error || !data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--gray-400);padding:24px;">No records found.</td></tr>';
      return data || [];
    }

    tbody.innerHTML = data.map(rowRenderer).join('');
    return data;
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--red);padding:24px;">Error loading data.</td></tr>';
    return [];
  }
}

// ═══ LOAD CERTIFICATIONS ═══
async function loadCertifications(memberId) {
  return loadTableData('certifications', memberId, 'certsTableBody', function(cert) {
    return '<tr>' +
      '<td>' + (cert.cert_type || '\u2014') + '</td>' +
      '<td>' + (cert.cert_number || '\u2014') + '</td>' +
      '<td>' + (cert.ic_rc_level || '\u2014') + '</td>' +
      '<td>' + formatDate(cert.issued_date) + '</td>' +
      '<td>' + formatDate(cert.expiration_date) + '</td>' +
      '<td>' + getStatusBadge(cert.status) + '</td>' +
      '</tr>';
  });
}

// ═══ LOAD CEU RECORDS ═══
async function loadCEURecords(memberId) {
  try {
    const { data, error } = await supabase
      .from('ceu_records')
      .select('*')
      .eq('member_id', memberId)
      .order('submitted_at', { ascending: false });

    const records = data || [];

    // Calculate CEU stats
    const approved = records.filter(function(r) { return r.status === 'approved'; });
    const totalHours = approved.reduce(function(sum, r) { return sum + parseFloat(r.hours || 0); }, 0);
    const requiredHours = 40;
    const percentage = Math.min(Math.round((totalHours / requiredHours) * 100), 100);

    // Update stat displays
    const totalEl = document.getElementById('ceuTotalHours');
    if (totalEl) totalEl.textContent = totalHours.toFixed(1);

    const remainEl = document.getElementById('ceuRemainingHours');
    if (remainEl) remainEl.textContent = Math.max(0, requiredHours - totalHours).toFixed(1);

    const progressEl = document.getElementById('ceuProgressBar');
    if (progressEl) progressEl.style.width = percentage + '%';

    const percentEl = document.getElementById('ceuPercentage');
    if (percentEl) percentEl.textContent = percentage + '%';

    // By category
    const categories = { 'General': 0, 'Ethics': 0, 'Cultural Diversity': 0, 'HIV/AIDS': 0 };
    approved.forEach(function(r) {
      if (categories.hasOwnProperty(r.category)) {
        categories[r.category] += parseFloat(r.hours || 0);
      }
    });

    Object.keys(categories).forEach(function(cat) {
      const el = document.getElementById('ceu' + cat.replace(/[^a-zA-Z]/g, ''));
      if (el) el.textContent = categories[cat].toFixed(1);
    });

    // Render table
    const tbody = document.getElementById('ceuTableBody');
    if (tbody) {
      if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray-400);padding:24px;">No CEU records found.</td></tr>';
      } else {
        tbody.innerHTML = records.map(function(r) {
          return '<tr>' +
            '<td>' + (r.course_name || '\u2014') + '</td>' +
            '<td>' + (r.provider || '\u2014') + '</td>' +
            '<td>' + (r.hours || '\u2014') + '</td>' +
            '<td>' + (r.category || '\u2014') + '</td>' +
            '<td>' + formatDate(r.completion_date) + '</td>' +
            '<td>' + (r.certificate_url ? '<a href="#" onclick="viewCEUCert(\'' + r.certificate_url + '\')">View</a>' : '\u2014') + '</td>' +
            '<td>' + getStatusBadge(r.status) + '</td>' +
            '</tr>';
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error loading CEU records:', err);
  }
}

// ═══ LOAD DOCUMENTS ═══
async function loadDocuments(memberId) {
  return loadTableData('documents', memberId, 'docsTableBody', function(doc) {
    return '<tr>' +
      '<td>' + (doc.document_type || '\u2014') + '</td>' +
      '<td>' + (doc.related_cert || '\u2014') + '</td>' +
      '<td>' + (doc.file_name || '\u2014') + '</td>' +
      '<td>' + (doc.file_size_kb ? doc.file_size_kb + ' KB' : '\u2014') + '</td>' +
      '<td>' + formatDate(doc.uploaded_at) + '</td>' +
      '<td>' + getStatusBadge(doc.status) + '</td>' +
      '</tr>';
  }, 'uploaded_at');
}

// ═══ LOAD MESSAGES ═══
async function loadMessageCount(memberId) {
  try {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('is_read', false);

    const badge = document.getElementById('msgBadge');
    if (badge) {
      badge.textContent = count || 0;
      badge.style.display = (count > 0) ? 'inline-flex' : 'none';
    }

    const sidebarBadge = document.getElementById('sidebarMsgBadge');
    if (sidebarBadge) {
      sidebarBadge.textContent = count || 0;
      sidebarBadge.style.display = (count > 0) ? 'inline-flex' : 'none';
    }
  } catch (err) {
    console.error('Error loading message count:', err);
  }
}

async function loadMessages(memberId) {
  return loadTableData('messages', memberId, 'messagesTableBody', function(msg) {
    return '<tr style="' + (!msg.is_read ? 'font-weight:600;' : '') + '">' +
      '<td>' + (msg.from_name || 'ABCAC Admin') + '</td>' +
      '<td><a href="#" onclick="viewMessage(\'' + msg.id + '\')">' + (msg.subject || '\u2014') + '</a></td>' +
      '<td>' + formatDate(msg.created_at) + '</td>' +
      '<td>' + (msg.is_read ? 'Read' : getStatusBadge('pending')) + '</td>' +
      '</tr>';
  });
}

// ═══ LOAD INVOICES ═══
async function loadInvoices(memberId) {
  return loadTableData('invoices', memberId, 'invoicesTableBody', function(inv) {
    return '<tr>' +
      '<td>' + (inv.invoice_number || '\u2014') + '</td>' +
      '<td>' + (inv.description || '\u2014') + '</td>' +
      '<td>' + formatCurrency(inv.amount_cents) + '</td>' +
      '<td>' + getStatusBadge(inv.status) + '</td>' +
      '<td>' + (inv.paid_at ? formatDate(inv.paid_at) : '\u2014') + '</td>' +
      '</tr>';
  });
}

// ═══ LOAD EMPLOYMENT RECORDS ═══
async function loadEmploymentRecords(memberId) {
  return loadTableData('employment_records', memberId, 'employmentTableBody', function(emp) {
    return '<tr>' +
      '<td>' + (emp.employer_name || '\u2014') + '</td>' +
      '<td>' + (emp.position_title || '\u2014') + '</td>' +
      '<td>' + formatDate(emp.start_date) + '</td>' +
      '<td>' + (emp.is_current ? 'Present' : formatDate(emp.end_date)) + '</td>' +
      '<td>' + (emp.is_current ? getStatusBadge('active') : '\u2014') + '</td>' +
      '</tr>';
  });
}

// ═══ LOAD OTHER CERTIFICATIONS ═══
async function loadOtherCertifications(memberId) {
  return loadTableData('other_certifications', memberId, 'otherCertsTableBody', function(cert) {
    return '<tr>' +
      '<td>' + (cert.credential_title || '\u2014') + '</td>' +
      '<td>' + (cert.credential_number || '\u2014') + '</td>' +
      '<td>' + (cert.issuing_board || '\u2014') + '</td>' +
      '<td>' + formatDate(cert.issued_date) + '</td>' +
      '<td>' + formatDate(cert.expiration_date) + '</td>' +
      '</tr>';
  });
}

// ═══ LOAD APPLICATIONS ═══
async function loadApplications(memberId) {
  return loadTableData('applications', memberId, 'applicationsTableBody', function(app) {
    return '<tr>' +
      '<td>' + ((app.app_type || '').replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); })) + '</td>' +
      '<td>' + (app.cert_type || '\u2014') + '</td>' +
      '<td>' + formatDate(app.submitted_at) + '</td>' +
      '<td>' + (app.est_completion ? formatDate(app.est_completion) : '\u2014') + '</td>' +
      '<td>' + getStatusBadge(app.status) + '</td>' +
      '</tr>';
  });
}

// ═══ CEU SUBMISSION ═══
async function submitCEU() {
  if (!currentUser) return;

  const courseName = (document.getElementById('ceuCourseName') || {}).value;
  const provider = (document.getElementById('ceuProvider') || {}).value;
  const hours = (document.getElementById('ceuHours') || {}).value;
  const category = (document.getElementById('ceuCategory') || {}).value;
  const completionDate = (document.getElementById('ceuCompletionDate') || {}).value;
  const fileInput = document.getElementById('ceuFileInput');
  const file = fileInput && fileInput.files && fileInput.files[0];

  if (!courseName || !provider || !hours || !category || !completionDate) {
    showNotification('Please fill in all required CEU fields.', 'warning');
    return;
  }

  try {
    let certificateUrl = null;
    if (file) {
      const filePath = currentUser.id + '/' + Date.now() + '_' + file.name;
      const { data: upload, error: uploadErr } = await supabase.storage
        .from('ceu-certificates')
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;
      certificateUrl = upload.path;
    }

    const { error } = await supabase.from('ceu_records').insert({
      member_id: currentUser.id,
      course_name: courseName,
      provider: provider,
      hours: parseFloat(hours),
      category: category,
      completion_date: completionDate,
      certificate_url: certificateUrl,
      status: 'pending'
    });

    if (error) throw error;

    const modal = document.getElementById('ceuModal');
    if (modal) modal.style.display = 'none';
    await loadCEURecords(currentUser.id);
    showNotification('CEU submission received! ABCAC will review within 5-7 business days.', 'success');
  } catch (err) {
    showNotification('CEU submission failed: ' + (err.message || 'Unknown error'), 'error');
  }
}

// ═══ DOCUMENT UPLOAD ═══
async function uploadDocument() {
  if (!currentUser) return;

  const docType = (document.getElementById('docType') || {}).value;
  const relatedCert = (document.getElementById('docRelatedCert') || {}).value;
  const fileInput = document.getElementById('docFileInput');
  const file = fileInput && fileInput.files && fileInput.files[0];

  if (!docType || !file) {
    showNotification('Please select a document type and file.', 'warning');
    return;
  }

  try {
    const filePath = currentUser.id + '/' + Date.now() + '_' + file.name;
    const { data: upload, error: uploadErr } = await supabase.storage
      .from('member-documents')
      .upload(filePath, file);

    if (uploadErr) throw uploadErr;

    const { error } = await supabase.from('documents').insert({
      member_id: currentUser.id,
      document_type: docType,
      related_cert: relatedCert || null,
      file_name: file.name,
      file_path: upload.path,
      file_size_kb: Math.round(file.size / 1024),
      status: 'pending'
    });

    if (error) throw error;

    await loadDocuments(currentUser.id);
    showNotification('Document uploaded successfully. ABCAC will review it shortly.', 'success');

    if (fileInput) fileInput.value = '';
  } catch (err) {
    showNotification('Upload failed: ' + (err.message || 'Unknown error'), 'error');
  }
}

// ═══ NAME CHANGE REQUEST ═══
async function submitNameChange() {
  if (!currentUser || !currentProfile) return;

  const newName = (document.getElementById('ncNewName') || {}).value;
  const reason = (document.getElementById('ncReason') || {}).value;
  const fileInput = document.getElementById('ncFileInput');
  const file = fileInput && fileInput.files && fileInput.files[0];

  if (!newName || !reason) {
    showNotification('Please fill in all required fields.', 'warning');
    return;
  }

  try {
    let docPath = null;
    if (file) {
      const filePath = currentUser.id + '/' + Date.now() + '_' + file.name;
      const { data: upload, error: uploadErr } = await supabase.storage
        .from('name-change-docs')
        .upload(filePath, file);
      if (!uploadErr) docPath = upload.path;
    }

    const currentName = ((currentProfile.first_name || '') + ' ' + (currentProfile.last_name || '')).trim();

    const { error } = await supabase.from('name_change_requests').insert({
      member_id: currentUser.id,
      current_name: currentName,
      new_name: newName,
      reason: reason,
      doc_path: docPath,
      status: 'pending'
    });

    if (error) throw error;
    showNotification('Name change request submitted. Review takes 5-7 business days.', 'success');
  } catch (err) {
    showNotification('Submission failed: ' + (err.message || 'Unknown error'), 'error');
  }
}

// ═══ VERIFICATION REQUEST ═══
async function submitVerification() {
  if (!currentUser) return;

  const purpose = (document.getElementById('verPurpose') || {}).value;
  const recipientName = (document.getElementById('verRecipientName') || {}).value;
  const recipientEmail = (document.getElementById('verRecipientEmail') || {}).value;
  const notes = (document.getElementById('verNotes') || {}).value;

  if (!purpose || !recipientName) {
    showNotification('Please provide the purpose and recipient name.', 'warning');
    return;
  }

  try {
    const { error } = await supabase.from('verification_requests').insert({
      member_id: currentUser.id,
      purpose: purpose,
      recipient_name: recipientName,
      recipient_email: recipientEmail || null,
      notes: notes || null,
      status: 'pending'
    });

    if (error) throw error;
    showNotification('Verification request submitted successfully.', 'success');
  } catch (err) {
    showNotification('Submission failed: ' + (err.message || 'Unknown error'), 'error');
  }
}

// ═══ RECIPROCITY REQUEST ═══
async function submitReciprocity() {
  if (!currentUser) return;

  const direction = (document.getElementById('recDirection') || {}).value;
  const credential = (document.getElementById('recCredential') || {}).value;
  const destination = (document.getElementById('recDestination') || {}).value;
  const reason = (document.getElementById('recReason') || {}).value;

  if (!direction) {
    showNotification('Please select a transfer direction.', 'warning');
    return;
  }

  try {
    const { error } = await supabase.from('reciprocity_requests').insert({
      member_id: currentUser.id,
      direction: direction,
      credential: credential || null,
      destination: destination || null,
      reason: reason || null,
      status: 'pending'
    });

    if (error) throw error;
    showNotification('IC&RC Reciprocity request submitted. ABCAC will contact you within 5 business days.', 'success');
  } catch (err) {
    showNotification('Submission failed: ' + (err.message || 'Unknown error'), 'error');
  }
}

// ═══ VIEW MESSAGE ═══
async function viewMessage(messageId) {
  if (!currentUser) return;

  try {
    // Mark as read
    await supabase.from('messages').update({ is_read: true }).eq('id', messageId);

    const { data: msg } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (msg) {
      const content =
        '<strong>From:</strong> ' + (msg.from_name || 'ABCAC Admin') + '<br>' +
        '<strong>Date:</strong> ' + formatDate(msg.created_at) + '<br>' +
        '<strong>Subject:</strong> ' + msg.subject + '<br><br>' +
        (msg.body || '');

      // Remove existing modal if present
      const existing = document.getElementById('messageModal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'messageModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
      modal.innerHTML = '<div style="background:#fff;border-radius:12px;padding:32px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;">' +
        '<div id="messageContent">' + content + '</div>' +
        '<button onclick="this.closest(\'#messageModal\').remove()" style="margin-top:16px;padding:8px 24px;background:var(--navy);color:#fff;border:none;border-radius:8px;cursor:pointer;">Close</button>' +
        '</div>';
      document.body.appendChild(modal);

      await loadMessageCount(currentUser.id);
    }
  } catch (err) {
    showNotification('Failed to load message.', 'error');
  }
}

// ═══ VIEW CEU CERTIFICATE ═══
async function viewCEUCert(filePath) {
  if (!currentUser) return;

  try {
    const { data } = await supabase.storage
      .from('ceu-certificates')
      .createSignedUrl(filePath, 3600);

    if (data && data.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  } catch (err) {
    showNotification('Failed to load certificate.', 'error');
  }
}

// ═══ SAVE NOTIFICATION PREFERENCES ═══
async function saveNotificationPrefs() {
  if (!currentUser) return;

  try {
    const { error } = await supabase.from('notification_preferences').upsert({
      member_id: currentUser.id,
      renewal_reminders: document.getElementById('prefRenewal') ? document.getElementById('prefRenewal').checked : true,
      ceu_deadline_alerts: document.getElementById('prefCEU') ? document.getElementById('prefCEU').checked : true,
      abcac_announcements: document.getElementById('prefAnnouncements') ? document.getElementById('prefAnnouncements').checked : true,
      icrc_updates: document.getElementById('prefICRC') ? document.getElementById('prefICRC').checked : false
    });

    if (error) throw error;
    showNotification('Notification preferences saved.', 'success');
  } catch (err) {
    showNotification('Failed to save preferences.', 'error');
  }
}

// ═══ ADD EMPLOYMENT RECORD ═══
async function addEmploymentRecord() {
  if (!currentUser) return;

  const employer = (document.getElementById('empEmployer') || {}).value;
  const position = (document.getElementById('empPosition') || {}).value;
  const startDate = (document.getElementById('empStartDate') || {}).value;
  const endDate = (document.getElementById('empEndDate') || {}).value;
  const isCurrent = document.getElementById('empCurrent') ? document.getElementById('empCurrent').checked : false;

  if (!employer || !position) {
    showNotification('Please provide employer name and position.', 'warning');
    return;
  }

  try {
    const { error } = await supabase.from('employment_records').insert({
      member_id: currentUser.id,
      employer_name: employer,
      position_title: position,
      start_date: startDate || null,
      end_date: isCurrent ? null : (endDate || null),
      is_current: isCurrent
    });

    if (error) throw error;
    await loadEmploymentRecords(currentUser.id);
    showNotification('Employment record added.', 'success');
  } catch (err) {
    showNotification('Failed to add employment record.', 'error');
  }
}

// ═══ ADD OTHER CERTIFICATION ═══
async function addOtherCertification() {
  if (!currentUser) return;

  const title = (document.getElementById('otherCertTitle') || {}).value;
  const number = (document.getElementById('otherCertNumber') || {}).value;
  const board = (document.getElementById('otherCertBoard') || {}).value;
  const issued = (document.getElementById('otherCertIssued') || {}).value;
  const expires = (document.getElementById('otherCertExpires') || {}).value;

  if (!title || !board) {
    showNotification('Please provide credential title and issuing board.', 'warning');
    return;
  }

  try {
    const { error } = await supabase.from('other_certifications').insert({
      member_id: currentUser.id,
      credential_title: title,
      credential_number: number || null,
      issuing_board: board,
      issued_date: issued || null,
      expiration_date: expires || null
    });

    if (error) throw error;
    await loadOtherCertifications(currentUser.id);
    showNotification('Certification added.', 'success');
  } catch (err) {
    showNotification('Failed to add certification.', 'error');
  }
}
