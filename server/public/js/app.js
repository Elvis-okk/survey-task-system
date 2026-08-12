/* ============================
   查勘任务管理系统 - 全局JS工具
   ============================ */

// ========== XSS防护 ==========
function escapeHtml(str) {
  if (str == null) return '';
  const map = { '&': '\u0026amp;', '<': '\u0026lt;', '>': '\u0026gt;', '"': '\u0026quot;', "'": '\u0026#039;' };
  return String(str).replace(/[&<>"']/g, c => map[c]);
}

// ========== API请求封装 ==========
const App = {
  // 获取API基础URL
  getBaseUrl() {
    const apiBase = localStorage.getItem('apiBase');
    if (apiBase) {
      return apiBase.replace(/\/$/, '');
    }
    return window.location.origin;
  },

  // 获取Token
  getToken() {
    return localStorage.getItem('token');
  },

  // 获取当前用户
  getUser() {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  // 通用请求方法 - 成功时返回data，失败时抛出异常
  async request(method, url, data = null) {
    const baseUrl = this.getBaseUrl();
    const token = this.getToken();

    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${baseUrl}${url}`, options);
      const result = await response.json();

      // Token过期处理
      if (result.code === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
        throw new Error('登录已过期，请重新登录');
      }

      // 成功时返回data
      if (result.code === 0) {
        return result.data;
      }

      // 其他错误
      throw new Error(result.message || '操作失败');
    } catch (err) {
      if (err.message === '登录已过期，请重新登录') throw err;
      console.error('API请求错误:', err);
      throw err;
    }
  },

  get(url) { return this.request('GET', url); },
  post(url, data) { return this.request('POST', url, data); },
  put(url, data) { return this.request('PUT', url, data); },
  delete(url) { return this.request('DELETE', url); },

  // ========== 认证API ==========
  auth: {
    login(username, password) {
      return App.post('/api/auth/login', { username, password });
    },
    me() {
      return App.get('/api/auth/me');
    },
    changePassword(old_password, new_password) {
      return App.put('/api/auth/password', { old_password, new_password });
    }
  },

  // ========== 用户API ==========
  users: {
    list() { return App.get('/api/users'); },
    surveyors() { return App.get('/api/users/surveyors'); },
    create(data) { return App.post('/api/users', data); },
    update(id, data) { return App.put(`/api/users/${id}`, data); },
    delete(id) { return App.delete(`/api/users/${id}`); },
    hardDelete(id) { return App.delete(`/api/users/${id}?hard=true`); },
    updateRole(id, role) { return App.put(`/api/users/${id}/role`, { role }); }
  },

  // ========== 任务API ==========
  tasks: {
    list(params = {}) {
      const query = new URLSearchParams(params).toString();
      return App.get(`/api/tasks${query ? '?' + query : ''}`);
    },
    get(id) { return App.get(`/api/tasks/${id}`); },
    create(data) { return App.post('/api/tasks', data); },
    update(id, data) { return App.put(`/api/tasks/${id}`, data); },
    updateSurvey(id, data) {
      return App.put(`/api/tasks/${id}/survey`, data);
    },
    updateProcess(id, data) {
      return App.put(`/api/tasks/${id}/process`, data);
    },
    reassign(id, assigned_to) {
      return App.put(`/api/tasks/${id}/reassign`, { assigned_to });
    },
    completed(params = {}) {
      const query = new URLSearchParams(params).toString();
      return App.get(`/api/tasks/completed${query ? '?' + query : ''}`);
    },
    stats(filters = {}) {
      const query = new URLSearchParams(filters).toString();
      return App.get(`/api/tasks/stats${query ? '?' + query : ''}`);
    }
  },

  // ========== 设置API ==========
  settings: {
    tags: {
      list() { return App.get('/api/settings/tags'); },
      create(data) { return App.post('/api/settings/tags', data); },
      update(id, data) { return App.put(`/api/settings/tags/${id}`, data); },
      delete(id) { return App.delete(`/api/settings/tags/${id}`); }
    },
    villages: {
      list() { return App.get('/api/settings/villages'); },
      create(data) { return App.post('/api/settings/villages', data); },
      update(id, data) { return App.put(`/api/settings/villages/${id}`, data); },
      delete(id) { return App.delete(`/api/settings/villages/${id}`); }
    },
    insurances: {
      list() { return App.get('/api/settings/insurances'); },
      create(data) { return App.post('/api/settings/insurances', data); },
      update(id, data) { return App.put(`/api/settings/insurances/${id}`, data); },
      delete(id) { return App.delete(`/api/settings/insurances/${id}`); }
    }
  },

  // ========== 工具方法 ==========
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  },

  formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${m}-${day} ${h}:${min}`;
  },

  getNowDatetimeLocal() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  },

  surveyStatusBadge(status) {
    const map = {
      'not_surveyed': { text: '未查勘', cls: 'survey-not_surveyed' },
      'surveyed': { text: '已查勘', cls: 'survey-surveyed' }
    };
    const info = map[status] || { text: status || '未知', cls: 'badge-gray' };
    return `<span class="badge ${info.cls}">${info.text}</span>`;
  },

  processStatusBadge(status) {
    if (!status) return '';
    const map = {
      'pending': { text: '待处理', cls: 'process-pending' },
      'resurvey': { text: '需复勘', cls: 'process-resurvey' },
      'missing_docs': { text: '缺少证件', cls: 'process-missing_docs' },
      'submitted': { text: '已提交', cls: 'process-submitted' }
    };
    const info = map[status] || { text: status || '-', cls: 'badge-gray' };
    return `<span class="badge ${info.cls}">${info.text}</span>`;
  },

  roleName(role) {
    const map = { admin: '管理员', surveyor: '查勘人员', publisher: '发布人员' };
    return map[role] || role;
  },

  roleBadgeClass(role) {
    return `badge role-${role}`;
  },

  // 权限检查 - admin始终有权限
  hasPermission(user, permission) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return !!user[permission];
  },

  // 获取用户权限描述
  getPermDesc(user) {
    if (!user) return '';
    const perms = [];
    if (user.role === 'admin' || user.can_publish) perms.push('发布');
    if (user.role === 'admin' || user.can_edit) perms.push('修改');
    if (user.role === 'admin' || user.can_process) perms.push('处理');
    return perms.join('、') || '无权限';
  },

  escapeHtml: escapeHtml,

  // ========== 登录状态检查 ==========
  checkAuth() {
    const token = localStorage.getItem('token');
    const user = this.getUser();
    if (!token || !user) {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  },

  checkAdmin() {
    const user = this.getUser();
    if (!user || user.role !== 'admin') {
      this.showToast('权限不足，仅管理员可访问', 'error');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
      return null;
    }
    return user;
  },

  // ========== 退出登录 ==========
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  },

  // ========== Toast 通知 ==========
  showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = {
      success: '<svg viewBox="0 0 20 20" fill="#10B981"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>',
      error: '<svg viewBox="0 0 20 20" fill="#EF4444"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/></svg>',
      warning: '<svg viewBox="0 0 20 20" fill="#F59E0B"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/></svg>',
      info: '<svg viewBox="0 0 20 20" fill="#3B82F6"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span>${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // ========== 确认对话框（返回Promise） ==========
  showConfirm(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box">
          <h3>${title}</h3>
          <p>${message || ''}</p>
          <div class="confirm-actions">
            <button class="btn btn-ghost" id="confirmCancel">取消</button>
            <button class="btn btn-danger" id="confirmOk">确定</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirmOk').addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });
      overlay.querySelector('#confirmCancel').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
    });
  },

  // ========== 模态框 ==========
  showModal(title, bodyHtml, footerHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'globalModal';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="App.closeModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) App.closeModal();
    });
    return overlay;
  },

  closeModal() {
    const modal = document.getElementById('globalModal');
    if (modal) modal.remove();
  },

  // ========== 顶部导航栏 ==========
  renderTopNav(activePage) {
    const user = this.getUser();
    if (!user) return '';

    const initial = (user.display_name || user.username || '?')[0];

    return `
    <nav class="top-nav">
      <a href="dashboard.html" class="nav-brand" style="text-decoration:none">
        <div class="brand-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
        </div>
        <span class="brand-text">查勘任务系统</span>
      </a>
      <div class="nav-right">
        <div class="nav-user">
          <div class="user-avatar">${initial}</div>
          <span>${user.display_name || user.username}</span>
          <span class="${this.roleBadgeClass(user.role)}">${this.roleName(user.role)}</span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="App.logout()" title="退出登录">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </button>
      </div>
    </nav>`;
  },

  // ========== 底部导航栏 ==========
  renderBottomNav(activePage) {
    const user = this.getUser();
    if (!user) return '';

    const items = [
      { id: 'dashboard', href: 'dashboard.html', label: '首页', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>' },
      { id: 'publish', href: 'publish.html', label: '发布', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>' },
      { id: 'tasks', href: 'tasks.html', label: '任务', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>' },
      { id: 'completed', href: 'completed.html', label: '已完成', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>' }
    ];

    if (user.role === 'admin') {
      items.push({ id: 'admin', href: 'admin.html', label: '管理', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>' });
    }

    return `
    <nav class="bottom-nav">
      <div class="bottom-nav-inner">
        ${items.map(item => `
          <a href="${item.href}" class="bottom-nav-item ${activePage === item.id ? 'active' : ''}">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
            <span>${item.label}</span>
          </a>
        `).join('')}
      </div>
    </nav>`;
  },

  // ========== 页面初始化（通用）- 返回当前用户对象 ==========
  initPage(activePage) {
    const user = this.checkAuth();
    if (!user) return null;

    // 渲染导航
    const navContainer = document.getElementById('topNav');
    if (navContainer) navContainer.innerHTML = this.renderTopNav(activePage);

    const bottomContainer = document.getElementById('bottomNav');
    if (bottomContainer) bottomContainer.innerHTML = this.renderBottomNav(activePage);

    return user;
  },

  // ========== 缓存 ==========
  _cachedTags: null,
  _cachedVillages: null,
  _cachedUsers: null,
  _cachedInsurances: null,
  _cachedSurveyors: null,

  async loadTags() {
    if (this._cachedTags) return this._cachedTags;
    try {
      const data = await this.settings.tags.list();
      this._cachedTags = data;
      return data;
    } catch (e) {
      console.error('加载标签失败:', e);
      return [];
    }
  },

  async loadVillages() {
    if (this._cachedVillages) return this._cachedVillages;
    try {
      const data = await this.settings.villages.list();
      this._cachedVillages = data;
      return data;
    } catch (e) {
      console.error('加载村庄失败:', e);
      return [];
    }
  },

  async loadUsers() {
    if (this._cachedUsers) return this._cachedUsers;
    try {
      const data = await this.users.list();
      this._cachedUsers = data;
      return data;
    } catch (e) {
      console.error('加载用户失败:', e);
      return [];
    }
  },

  async loadInsurances() {
    if (this._cachedInsurances) return this._cachedInsurances;
    try {
      const data = await this.settings.insurances.list();
      this._cachedInsurances = data;
      return data;
    } catch (e) {
      console.error('加载出险情况失败:', e);
      return [];
    }
  },

  async loadSurveyors() {
    if (this._cachedSurveyors) return this._cachedSurveyors;
    try {
      const data = await this.users.surveyors();
      this._cachedSurveyors = data;
      return data;
    } catch (e) {
      console.error('加载查勘员失败:', e);
      return [];
    }
  },

  clearCache() {
    this._cachedTags = null;
    this._cachedVillages = null;
    this._cachedUsers = null;
    this._cachedInsurances = null;
    this._cachedSurveyors = null;
  },

  // ========== 生成下拉选项 ==========
  tagOptions(tags, selectedId) {
    return `<option value="">全部标签</option>` +
      tags.map(t => `<option value="${t.id}" ${String(t.id) === String(selectedId) ? 'selected' : ''}>${t.name}</option>`).join('');
  },

  villageOptions(villages, selectedId) {
    return `<option value="">全部村/社区</option>` +
      villages.map(v => `<option value="${v.id}" ${String(v.id) === String(selectedId) ? 'selected' : ''}>${v.name}</option>`).join('');
  },

  insuranceOptions(insurances, selectedId) {
    return `<option value="">请选择出险情况</option>` +
      insurances.map(i => `<option value="${i.id}" ${String(i.id) === String(selectedId) ? 'selected' : ''}>${i.name}</option>`).join('');
  },

  userOptions(users, selectedId) {
    return `<option value="">请选择</option>` +
      users.map(u => `<option value="${u.id}" ${String(u.id) === String(selectedId) ? 'selected' : ''}>${u.display_name || u.username}</option>`).join('');
  },

  // ========== 标签带颜色 ==========
  tagBadge(tag) {
    if (!tag) return '';
    if (typeof tag === 'string') {
      return `<span class="badge badge-tag">${escapeHtml(tag)}</span>`;
    }
    const color = tag.color || '#6B7280';
    return `<span class="badge" style="background:${color}20;color:${color}">${escapeHtml(tag.name)}</span>`;
  },

  // 任务标签徽章（使用task对象的tag_name和tag_color）
  taskTagBadge(task) {
    const name = task.tag_name || task.tag;
    if (!name) return '';
    const color = task.tag_color || '#6B7280';
    return `<span class="badge" style="background:${color}20;color:${color}">${escapeHtml(name)}</span>`;
  },

  tagBadgeById(tagId, tags) {
    const tag = (tags || []).find(t => String(t.id) === String(tagId));
    return tag ? this.tagBadge(tag) : `<span class="badge badge-gray">${tagId || '未知'}</span>`;
  },

  // ========== 获取村名 ==========
  getVillageName(villageId, villages) {
    const v = (villages || []).find(item => String(item.id) === String(villageId));
    return v ? v.name : '-';
  },

  // ========== 获取用户名 ==========
  getUserName(userId, users) {
    if (!users) {
      users = this._cachedUsers || [];
    }
    const u = users.find(item => String(item.id) === String(userId));
    return u ? (u.display_name || u.username) : '-';
  }
};