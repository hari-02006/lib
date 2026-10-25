const state = {
  books: [],
  stats: { totalTitles: 0, availableTitles: 0, unavailableTitles: 0, categoryCount: 0, totalCopies: 0 },
  categories: [],
  page: 'dashboard',
  selectedBook: null,
  search: '',
  categoryFilter: '',
  statusFilter: 'all',
  pageNumber: 1,
  pageSize: 8,
  loading: false,
};

const pageContent = document.querySelector('#page-content');
const globalSearch = document.querySelector('#global-search');
const toastRegion = document.querySelector('#toast-region');
const modalLayer = document.querySelector('#modal-layer');
const pageTitles = {
  dashboard: 'Dashboard',
  books: 'All books',
  add: 'Add a book',
  edit: 'Edit book',
  detail: 'Book details',
  categories: 'Categories',
  profile: 'Library profile',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function notify(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' error' : ''}`;
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

async function loadData() {
  state.loading = true;
  try {
    const [books, stats, categories] = await Promise.all([
      api('/books'),
      api('/books/stats'),
      api('/books/categories'),
    ]);
    state.books = books;
    state.stats = stats;
    state.categories = categories;
    setConnection(true);
    if (state.selectedBook) {
      const refreshed = state.books.find((book) => book._id === state.selectedBook._id);
      if (refreshed) state.selectedBook = refreshed;
    }
    renderPage();
  } catch (error) {
    setConnection(false);
    pageContent.innerHTML = `<div class="error-state"><p>${escapeHtml(error.message)}. Check that the API and MongoDB are available.</p><button class="button button-secondary" data-action="refresh">Try again</button></div>`;
  } finally {
    state.loading = false;
  }
}

function setConnection(isOnline) {
  const dot = document.querySelector('.connection-dot');
  const label = document.querySelector('#connection-label');
  dot.classList.toggle('online', isOnline);
  label.textContent = isOnline ? 'Database connected' : 'Database unavailable';
}

function setPage(page) {
  state.page = page;
  state.pageNumber = 1;
  if (page !== 'detail' && page !== 'edit') state.selectedBook = null;
  document.querySelector('#topbar-title').textContent = pageTitles[page] || 'Library';
  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.classList.toggle('active', button.dataset.nav === page || (page === 'edit' && button.dataset.nav === 'add'));
  });
  document.querySelector('#sidebar').classList.remove('open');
  renderPage();
  pageContent.focus({ preventScroll: true });
}

function heading(title, subtitle, action = '') {
  return `<div class="page-heading"><div><p class="eyebrow">Library workspace</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;
}

function statusPill(available) {
  return `<span class="status-pill${available ? '' : ' unavailable'}">${available ? 'Available' : 'Unavailable'}</span>`;
}

function bookCoverUrl(book) {
  return book.coverImage || `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(book.isbn)}-L.jpg`;
}

function coverImage(book, className = '') {
  return `<img class="${className}" src="${escapeHtml(bookCoverUrl(book))}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy" onerror="this.onerror=null;this.src='/book-placeholder.svg'">`;
}

function bookCards(books) {
  return `<div class="book-card-grid">${books.map((book) => `
    <button class="book-card" data-action="view" data-id="${escapeHtml(book._id)}">
      ${coverImage(book, 'book-card-cover')}
      <span class="book-card-info"><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author)}</small><span>${escapeHtml(book.category)}</span></span>
    </button>`).join('')}</div>`;
}

function bookRows(books) {
  if (!books.length) {
    return `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">▤</div><h3>No books found</h3><p>Try changing your search or add a new title to the collection.</p><button class="button button-primary button-small" data-nav="add">Add a book</button></div></td></tr>`;
  }
  return books.map((book, index) => `
    <tr>
      <td>${(state.pageNumber - 1) * state.pageSize + index + 1}</td>
      <td><span class="book-title-cell">${coverImage(book, 'book-thumb')}<span class="book-title">${escapeHtml(book.title)}</span></span></td>
      <td>${escapeHtml(book.author)}</td>
      <td>${escapeHtml(book.category)}</td>
      <td>${escapeHtml(book.isbn)}</td>
      <td>${book.quantity}</td>
      <td>${statusPill(book.available)}</td>
      <td><div class="row-actions">
        <button class="table-action" data-action="view" data-id="${escapeHtml(book._id)}" title="View details" aria-label="View ${escapeHtml(book.title)}">◉</button>
        <button class="table-action" data-action="edit" data-id="${escapeHtml(book._id)}" title="Edit book" aria-label="Edit ${escapeHtml(book.title)}">✎</button>
        <button class="table-action delete" data-action="delete" data-id="${escapeHtml(book._id)}" title="Delete book" aria-label="Delete ${escapeHtml(book.title)}">⌫</button>
      </div></td>
    </tr>`).join('');
}

function table(books, includeFilters = false) {
  const categories = state.categories.map((category) =>
    `<option value="${escapeHtml(category)}"${category === state.categoryFilter ? ' selected' : ''}>${escapeHtml(category)}</option>`,
  ).join('');
  const filters = includeFilters ? `
    <div class="filters">
      <input class="filter-input" id="book-filter" type="search" placeholder="Search title, author, or ISBN…" value="${escapeHtml(state.search)}">
      <select class="filter-select" id="category-filter"><option value="">All categories</option>${categories}</select>
      <select class="filter-select" id="status-filter">
        <option value="all"${state.statusFilter === 'all' ? ' selected' : ''}>All statuses</option>
        <option value="available"${state.statusFilter === 'available' ? ' selected' : ''}>Available</option>
        <option value="unavailable"${state.statusFilter === 'unavailable' ? ' selected' : ''}>Unavailable</option>
      </select>
    </div>` : '';

  const normalized = state.search.trim().toLocaleLowerCase();
  const filtered = books.filter((book) => {
    const matchesSearch = !normalized || [book.title, book.author, book.isbn, book.category]
      .some((value) => String(value || '').toLocaleLowerCase().includes(normalized));
    const matchesCategory = !state.categoryFilter || book.category === state.categoryFilter;
    const matchesStatus = state.statusFilter === 'all' ||
      (state.statusFilter === 'available' ? book.available : !book.available);
    return matchesSearch && matchesCategory && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.pageNumber = Math.min(state.pageNumber, totalPages);
  const first = (state.pageNumber - 1) * state.pageSize;
  const shown = filtered.slice(first, first + state.pageSize);
  const pageButtons = Array.from({ length: totalPages }, (_, index) =>
    `<button class="page-button${index + 1 === state.pageNumber ? ' current' : ''}" data-action="page" data-page="${index + 1}">${index + 1}</button>`,
  ).join('');

  return `<section class="panel">${filters}<div class="table-scroll"><table class="data-table">
    <thead><tr><th>#</th><th>Title</th><th>Author</th><th>Category</th><th>ISBN</th><th>Quantity</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${bookRows(shown)}</tbody></table></div>
    <div class="table-footer"><span>Showing ${filtered.length ? first + 1 : 0}–${Math.min(first + state.pageSize, filtered.length)} of ${filtered.length} book${filtered.length === 1 ? '' : 's'}</span>
      <div class="pagination"><button class="page-button" data-action="page" data-page="${Math.max(1, state.pageNumber - 1)}" aria-label="Previous page">‹</button>${pageButtons}<button class="page-button" data-action="page" data-page="${Math.min(totalPages, state.pageNumber + 1)}" aria-label="Next page">›</button></div>
    </div></section>`;
}

function renderDashboard() {
  const stats = state.stats;
  const cards = [
    ['▤', 'Total titles', stats.totalTitles, `${stats.totalCopies} copies in your collection`],
    ['▣', 'Available titles', stats.availableTitles, 'Titles marked available'],
    ['◷', 'Unavailable titles', stats.unavailableTitles, 'Titles marked unavailable'],
    ['◈', 'Categories', stats.categoryCount, 'Unique book categories'],
  ];
  const recent = [...state.books].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  return `${heading('Dashboard', 'A quick overview of your library collection.', '<button class="button button-primary" data-nav="add"><span>＋</span> Add a book</button>')}
    <div class="stats-grid">${cards.map(([icon, label, value, note]) => `<article class="stat-card"><div class="stat-icon">${icon}</div><div><p>${label}</p><strong>${value}</strong><small>${note}</small></div></article>`).join('')}</div>
    ${state.books.length ? `<section class="featured-books"><div class="panel-header"><div><h2>Explore your collection</h2><p>Find your next favorite read.</p></div><button class="text-button" data-nav="books">Browse all →</button></div>${bookCards(recent)}</section>` : ''}
    <section class="panel"><div class="panel-header"><h2>Recently added books</h2><button class="text-button" data-nav="books">View all books →</button></div>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Title</th><th>Author</th><th>Category</th><th>Quantity</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${recent.length ? recent.map((book, index) => `<tr><td>${index + 1}</td><td><span class="book-title">${escapeHtml(book.title)}</span></td><td>${escapeHtml(book.author)}</td><td>${escapeHtml(book.category)}</td><td>${book.quantity}</td><td>${statusPill(book.available)}</td><td><button class="button button-primary button-small" data-action="view" data-id="${escapeHtml(book._id)}">View</button></td></tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">▤</div><h3>Your collection is ready</h3><p>Add your first book to see it appear here.</p><button class="button button-primary button-small" data-nav="add">Add a book</button></div></td></tr>'}</tbody>
      </table></div></section>`;
}

function renderBooks() {
  return `${heading('All books', 'Search and manage every title in your collection.', '<button class="button button-primary" data-nav="add"><span>＋</span> Add a book</button>')}${table(state.books, true)}`;
}

function renderCategories() {
  const counts = state.categories.map((category) => [category, state.books.filter((book) => book.category === category).length]);
  return `${heading('Categories', 'Browse your collection by subject.')}
    ${counts.length ? `<div class="category-grid">${counts.map(([category, count]) => `<button class="category-card" data-action="category" data-category="${escapeHtml(category)}"><span class="category-icon">◈</span><span><strong>${escapeHtml(category)}</strong><small>${count} title${count === 1 ? '' : 's'} in this category</small></span></button>`).join('')}</div>` : '<section class="panel"><div class="empty-state"><div class="empty-icon">◈</div><h3>No categories yet</h3><p>Categories appear here when you add books.</p><button class="button button-primary button-small" data-nav="add">Add a book</button></div></section>'}`;
}

function renderForm(book = {}) {
  const isEdit = Boolean(book._id);
  const categoryOptions = state.categories.map((category) =>
    `<option value="${escapeHtml(category)}"${book.category === category ? ' selected' : ''}>${escapeHtml(category)}</option>`,
  ).join('');
  return `${heading(isEdit ? 'Edit book' : 'Add a new book', isEdit ? 'Update the information for this title.' : 'Add a new title to your library collection.')}
    <section class="panel form-panel"><form id="book-form" data-id="${escapeHtml(book._id || '')}">
      <div class="form-grid">
        <div class="form-field"><label for="title">Title <span class="required-mark">*</span></label><input class="form-control" id="title" name="title" required maxlength="160" placeholder="Enter book title" value="${escapeHtml(book.title || '')}"></div>
        <div class="form-field"><label for="author">Author <span class="required-mark">*</span></label><input class="form-control" id="author" name="author" required maxlength="120" placeholder="Enter author name" value="${escapeHtml(book.author || '')}"></div>
        <div class="form-field"><label for="isbn">ISBN <span class="required-mark">*</span></label><input class="form-control" id="isbn" name="isbn" required maxlength="32" placeholder="Enter ISBN number" value="${escapeHtml(book.isbn || '')}"><small class="form-help">ISBN must be unique within the collection.</small></div>
        <div class="form-field"><label for="category">Category <span class="required-mark">*</span></label><input class="form-control" id="category" name="category" required maxlength="80" list="category-options" placeholder="e.g. Computer Science" value="${escapeHtml(book.category || '')}"><datalist id="category-options">${categoryOptions}</datalist></div>
        <div class="form-field"><label for="quantity">Quantity <span class="required-mark">*</span></label><input class="form-control" id="quantity" name="quantity" type="number" required min="0" step="1" placeholder="Enter quantity" value="${book.quantity ?? ''}"></div>
        <div class="form-field"><span class="form-label">Availability</span><div class="radio-row"><label><input type="radio" name="available" value="true"${book.available !== false ? ' checked' : ''}> Available</label><label><input type="radio" name="available" value="false"${book.available === false ? ' checked' : ''}> Unavailable</label></div></div>
        <div class="form-field full-width"><label for="coverImage">Book cover image URL <span style="color:#929eac;font-weight:400">(optional)</span></label><input class="form-control" id="coverImage" name="coverImage" type="url" maxlength="2048" placeholder="https://example.com/book-cover.jpg" value="${escapeHtml(book.coverImage || '')}"><small class="form-help">Paste an image URL, or leave blank to find a cover using the ISBN.</small></div>
        <div class="form-field full-width"><label for="description">Description <span style="color:#929eac;font-weight:400">(optional)</span></label><textarea class="form-control" id="description" name="description" maxlength="500" placeholder="Add a short description about this book…">${escapeHtml(book.description || '')}</textarea><small class="form-help">Up to 500 characters.</small></div>
      </div>
      <div class="form-actions"><button class="button button-secondary" type="button" data-action="cancel-form">Cancel</button><button class="button button-primary" type="submit">${isEdit ? 'Save changes' : 'Add book'}</button></div>
    </form></section>`;
}

function renderDetail(book) {
  if (!book) return `${heading('Book details', 'This title could not be found.')}${emptyPanel('Book not found', 'It may have been removed from your collection.')}`;
  return `${heading('Book details', 'Full details for this collection title.', '<button class="button button-secondary" data-nav="books">← Back to books</button>')}
    <div class="detail-grid"><div class="book-cover">${coverImage(book, 'detail-cover-image')}</div>
      <section class="panel detail-card"><div class="detail-top"><div><h2>${escapeHtml(book.title)}</h2><p>by ${escapeHtml(book.author)}</p></div><div class="detail-buttons"><button class="button button-primary button-small" data-action="edit" data-id="${escapeHtml(book._id)}">✎ Edit</button><button class="button button-danger button-small" data-action="delete" data-id="${escapeHtml(book._id)}">Delete</button></div></div>
        <div class="detail-list"><div class="detail-item"><span>Availability</span>${statusPill(book.available)}</div><div class="detail-item"><span>Quantity</span><strong>${book.quantity} ${book.quantity === 1 ? 'copy' : 'copies'}</strong></div><div class="detail-item"><span>ISBN</span><strong>${escapeHtml(book.isbn)}</strong></div><div class="detail-item"><span>Category</span><strong>${escapeHtml(book.category)}</strong></div><div class="detail-item"><span>Added</span><strong>${formatDate(book.createdAt)}</strong></div><div class="detail-item"><span>Last updated</span><strong>${formatDate(book.updatedAt)}</strong></div></div>
        <div class="detail-item"><span>Description</span><p class="description-text">${escapeHtml(book.description || 'No description has been added for this title.')}</p></div>
      </section></div>`;
}

function emptyPanel(title, description) {
  return `<section class="panel"><div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><button class="button button-secondary button-small" data-nav="books">Back to books</button></div></section>`;
}

function renderProfile() {
  return `${heading('Library profile', 'Basic information about this library workspace.')}
    <section class="panel profile-panel"><div class="profile-hero"><div class="profile-avatar">L</div><div><h2>Library Management System</h2><p>College library collection workspace</p></div></div>
      <div class="profile-info"><div><span>Workspace</span><strong>Library collection</strong></div><div><span>Role</span><strong>Collection manager</strong></div><div><span>Books tracked</span><strong>${state.stats.totalTitles} titles</strong></div><div><span>Database</span><strong>${document.querySelector('#connection-label').textContent}</strong></div></div></section>`;
}

function renderPage() {
  document.querySelector('#topbar-title').textContent = pageTitles[state.page] || 'Library';
  const renderers = {
    dashboard: renderDashboard,
    books: renderBooks,
    add: () => renderForm(),
    edit: () => renderForm(state.selectedBook || {}),
    detail: () => renderDetail(state.selectedBook),
    categories: renderCategories,
    profile: renderProfile,
  };
  pageContent.innerHTML = renderers[state.page]();
  pageContent.scrollTop = 0;
  syncGlobalSearch();
}

function syncGlobalSearch() {
  if (document.activeElement !== globalSearch) globalSearch.value = state.search;
}

function refreshTable() {
  if (state.page === 'books') renderPage();
}

async function openBook(id, destination) {
  try {
    const book = await api(`/books/${encodeURIComponent(id)}`);
    state.selectedBook = book;
    setPage(destination);
  } catch (error) {
    notify(error.message, true);
    if (error.message === 'Book not found') await loadData();
  }
}

function showDeleteConfirmation(book) {
  modalLayer.innerHTML = `<section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div class="confirm-icon">⌫</div><h2 id="delete-title">Delete this book?</h2><p>Are you sure you want to delete <strong>${escapeHtml(book.title)}</strong>? This action cannot be undone.</p><div class="modal-actions"><button class="button button-secondary" data-action="close-modal">Cancel</button><button class="button button-danger" data-action="confirm-delete" data-id="${escapeHtml(book._id)}">Delete book</button></div></section>`;
  modalLayer.hidden = false;
  modalLayer.querySelector('[data-action="close-modal"]').focus();
}

async function deleteBook(id) {
  try {
    await api(`/books/${encodeURIComponent(id)}`, { method: 'DELETE' });
    modalLayer.hidden = true;
    modalLayer.innerHTML = '';
    notify('Book deleted successfully.');
    if (state.page === 'detail') setPage('books');
    await loadData();
  } catch (error) {
    modalLayer.hidden = true;
    notify(error.message, true);
  }
}

async function saveBook(form) {
  const formData = new FormData(form);
  const id = form.dataset.id;
  const payload = {
    title: String(formData.get('title') || '').trim(),
    author: String(formData.get('author') || '').trim(),
    isbn: String(formData.get('isbn') || '').trim(),
    category: String(formData.get('category') || '').trim(),
    quantity: Number(formData.get('quantity')),
    available: formData.get('available') === 'true',
    description: String(formData.get('description') || '').trim(),
    coverImage: String(formData.get('coverImage') || '').trim(),
  };
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = id ? 'Saving…' : 'Adding…';
  try {
    const book = await api(id ? `/books/${encodeURIComponent(id)}` : '/books', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    notify(id ? 'Book updated successfully.' : 'Book added successfully.');
    await loadData();
    state.selectedBook = book;
    setPage('detail');
  } catch (error) {
    notify(error.message, true);
    submitButton.disabled = false;
    submitButton.textContent = id ? 'Save changes' : 'Add book';
  }
}

document.addEventListener('click', async (event) => {
  const nav = event.target.closest('[data-nav]');
  if (nav) {
    event.preventDefault();
    const target = nav.dataset.nav;
    if (target === 'add' && state.page !== 'edit') state.selectedBook = null;
    setPage(target);
    return;
  }

  const action = event.target.closest('[data-action]');
  if (!action) return;
  const { action: type, id } = action.dataset;
  if (type === 'refresh') {
    await loadData();
    notify('Collection refreshed.');
  } else if (type === 'view') {
    await openBook(id, 'detail');
  } else if (type === 'edit') {
    await openBook(id, 'edit');
  } else if (type === 'delete') {
    const book = state.books.find((item) => item._id === id);
    if (book) showDeleteConfirmation(book);
  } else if (type === 'confirm-delete') {
    await deleteBook(id);
  } else if (type === 'close-modal') {
    modalLayer.hidden = true;
    modalLayer.innerHTML = '';
  } else if (type === 'cancel-form') {
    setPage(state.selectedBook ? 'detail' : 'books');
  } else if (type === 'page') {
    state.pageNumber = Number(action.dataset.page);
    renderPage();
  } else if (type === 'category') {
    state.categoryFilter = action.dataset.category;
    state.statusFilter = 'all';
    setPage('books');
  }
});

document.addEventListener('submit', async (event) => {
  if (event.target.id === 'book-form') {
    event.preventDefault();
    if (!event.target.reportValidity()) return;
    await saveBook(event.target);
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'book-filter') {
    state.search = event.target.value;
    state.pageNumber = 1;
    const position = event.target.selectionStart;
    refreshTable();
    const replacement = document.querySelector('#book-filter');
    replacement.focus();
    replacement.setSelectionRange(position, position);
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'category-filter') {
    state.categoryFilter = event.target.value;
    state.pageNumber = 1;
    refreshTable();
  } else if (event.target.id === 'status-filter') {
    state.statusFilter = event.target.value;
    state.pageNumber = 1;
    refreshTable();
  }
});

globalSearch.addEventListener('input', () => {
  state.search = globalSearch.value;
  state.pageNumber = 1;
  if (state.page === 'books') refreshTable();
});
globalSearch.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') setPage('books');
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    globalSearch.focus();
  }
  if (event.key === 'Escape' && !modalLayer.hidden) {
    modalLayer.hidden = true;
    modalLayer.innerHTML = '';
  }
});
document.querySelector('#mobile-menu').addEventListener('click', () => {
  document.querySelector('#sidebar').classList.toggle('open');
});
document.querySelector('#refresh-button').addEventListener('click', async () => {
  await loadData();
  notify('Collection refreshed.');
});

renderPage();
loadData();
