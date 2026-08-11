// 主应用逻辑
const App = {
  currentUser: null,
  currentPage: 'tasks',
  _currentPage: 1,
  _completedPage: 1,
  cachedData: { tags: [], villages: [], users: [] },
  confirmCallback: null,

  async init() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) { window.location.href = 'login.html'; return; }
    try { this.currentUser = JSON.parse(userStr); } catch (e) {
      localStorage.removeItem('token'); localStorage.removeItem('user');
      window.location.href = 'login.html'; return;
    }
    const res = await API.auth.me();
    if (res.code !== 0) {
      localStorage.removeItem('token'); localStorage.removeItem('user');
      window.location.href = 'login.html'; return;
    }
    this.currentUser = res.data;
    this.updateUserDisplay();
    this.renderMenu();
    Socket.connect();
    Socket.on('task_updated', () => {
      if (this.currentPage === 'tasks' || this.currentPage === 'completed') this.loadCurrentPage();
    });
    await this.loadCacheData();
    this.handleRoute();
    window.addEventListener('hashchange', () => this.handleRoute());
  },

  updateUserDisplay() {
    if (!this.currentUser) return;
    document.getElementById('currentUser').textContent = this.currentUser.display_name;
    const roleBadge = document.getElementById('roleBadge');
    const roleMap = { admin: '管理员', surveyor: '查勘人员', publisher: '发布人员' };
    roleBadge.textContent = roleMap[this.currentUser.role] || this.currentUser.role;
    roleBadge.className = `status-badge text-xs role-${this.currentUser.role}`;
  },

  renderMenu() {
    const role = this.currentUser.role;
    const menuItems = [
      { id: 'tasks', label: '任务列表', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>' },
      { id: 'publish', label: '发布任务', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>' },
      { id: 'completed', label: '已完成', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>' }
    ];
    if (role === 'admin' || role === 'surveyor') {
      menuItems.push({ id: 'settings', label: '系统设置', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>' });
    }
    if (role === 'admin') {
      menuItems.push({ id: 'users', label: '用户管理', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>' });
    }
    const sideMenu = document.getElementById('sideMenu');
    sideMenu.innerHTML = menuItems.map(item => `
      <div class="menu-item ${this.currentPage === item.id ? 'active' : ''}" onclick="App.navigate('${item.id}')">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
        <span>${item.label}</span>
      </div>
    `).join('');
    const bottomItems = menuItems.slice(0, 5);
    const bottomMenu = document.getElementById('bottomMenu');
    bottomMenu.innerHTML = bottomItems.map(item => `
      <div class="bottom-nav-item ${this.currentPage === item.id ? 'active' : ''}" onclick="App.navigate('${item.id}')">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
        <span>${item.label}</span>
      </div>
    `).join('');
  },

  async loadCacheData() {
    try {
      const [tagsRes, villagesRes] = await Promise.all([API.settings.tags.list(), API.settings.villages.list()]);
      if (tagsRes.code === 0) this.cachedData.tags = tagsRes.data;
      if (villagesRes.code === 0) this.cachedData.villages = villagesRes.data;
    } catch (err) { console.error('加载缓存数据错误:', err); }
  },

  handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'tasks';
    this.currentPage = hash;
    this.renderMenu();
    this.loadCurrentPage();
  },

  navigate(page) { window.location.hash = page; },

  async loadCurrentPage() {
    const content = document.getElementById('mainContent');
    content.innerHTML = '<div class="flex justify-center py-20"><div class="loading-spinner"></div></div>';
    switch (this.currentPage) {
      case 'tasks': await this.renderTaskList(); break;
      case 'publish': await this.renderPublishTask(); break;
      case 'completed': await this.renderCompletedTasks(); break;
      case 'settings': await this.renderSettings(); break;
      case 'users': await this.renderUserManagement(); break;
      default: await this.renderTaskList();
    }
  },

  // ========== 辅助方法 ==========
  getProcessStatusText(status) {
    const map = { pending: '待处理', resurvey: '需复勘', missing_docs: '缺证件', submitted: '已提交', archived: '已归档' };
    return map[status] || status || '-';
  },

  formatTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    toast.className = `toast-item ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg text-sm mb-2 transform transition-all duration-300 translate-x-full`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.remove('translate-x-full'); });
    setTimeout(() => {
      toast.classList.add('translate-x-full');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  closeModal() {
    document.getElementById('modalContainer').classList.add('hidden');
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    Socket.disconnect();
    window.location.href = 'login.html';
  },

  // ========== 任务列表页面 ==========
  async renderTaskList() {
    const content = document.getElementById('mainContent');
    const filters = this.getTaskFilters();
    const res = await API.tasks.list(filters);
    if (res.code !== 0) { content.innerHTML = `<div class="empty-state"><p>加载失败: ${res.message}</p></div>`; return; }
    const { tasks, page, totalPages } = res.data;
    const statsRes = await API.tasks.stats();
    const stats = statsRes.code === 0 ? statsRes.data : {};
    content.innerHTML = `
      <div class="page-enter">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div class="stat-card"><div class="text-xs text-gray-500 mb-1">待查勘</div><div class="stat-number text-yellow-600">${stats.not_surveyed||0}</div></div>
          <div class="stat-card"><div class="text-xs text-gray-500 mb-1">已查勘</div><div class="stat-number text-blue-600">${stats.surveyed||0}</div></div>
          <div class="stat-card"><div class="text-xs text-gray-500 mb-1">处理中</div><div class="stat-number text-orange-600">${(stats.pending||0)+(stats.resurvey||0)+(stats.missing_docs||0)}</div></div>
          <div class="stat-card"><div class="text-xs text-gray-500 mb-1">已归档</div><div class="stat-number text-green-600">${stats.archived||0}</div></div>
        </div>
        <div class="card p-4 mb-4">
          <div class="filter-bar">
            <select id="filterTag" onchange="App.onFilterChange()"><option value="">全部标签</option>${this.cachedData.tags.map(t=>`<option value="${t.name}" ${filters.tag===t.name?'selected':''}>${t.name}</option>`).join('')}</select>
            <select id="filterSurvey" onchange="App.onFilterChange()"><option value="">查勘状态</option><option value="not_surveyed" ${filters.survey_status==='not_surveyed'?'selected':''}>未查勘</option><option value="surveyed" ${filters.survey_status==='surveyed'?'selected':''}>已查勘</option></select>
            <select id="filterProcess" onchange="App.onFilterChange()"><option value="">处理状态</option><option value="pending" ${filters.process_status==='pending'?'selected':''}>待处理</option><option value="resurvey" ${filters.process_status==='resurvey'?'selected':''}>需复勘</option><option value="missing_docs" ${filters.process_status==='missing_docs'?'selected':''}>缺证件</option><option value="submitted" ${filters.process_status==='submitted'?'selected':''}>已提交</option></select>
            <select id="filterVillage" onchange="App.onFilterChange()"><option value="">全部村/社区</option>${this.cachedData.villages.map(v=>`<option value="${v.id}" ${filters.village_id===String(v.id)?'selected':''}>${v.name}</option>`).join('')}</select>
          </div>
        </div>
        <div class="card overflow-hidden mb-4 desktop-only">
          <table class="data-table"><thead><tr><th>标签</th><th>地址</th><th>村/社区</th><th>查勘状态</th><th>处理状态</th><th>负责人</th><th>发布时间</th></tr></thead>
          <tbody>${tasks.length===0?'<tr><td colspan="7" class="text-center text-gray-400 py-8">暂无任务</td></tr>':tasks.map(t=>`<tr class="cursor-pointer" onclick="App.showTaskDetail(${t.id})"><td><span class="status-badge" style="background:${t.tag_color||'#3B82F6'}20;color:${t.tag_color||'#3B82F6'}">${t.tag||'-'}</span></td><td class="max-w-[200px] truncate">${t.address||'-'}</td><td>${t.village_name||'-'}</td><td><span class="status-badge survey-${t.survey_status}">${t.survey_status==='not_surveyed'?'未查勘':'已查勘'}</span></td><td><span class="status-badge process-${t.process_status}">${this.getProcessStatusText(t.process_status)}</span></td><td>${t.assignee_name||'-'}</td><td class="text-sm text-gray-500">${this.formatTime(t.publish_time)}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="mobile-cards space-y-3">
          ${tasks.length===0?'<div class="empty-state"><p>暂无任务</p></div>':tasks.map(t=>`<div class="card card-clickable p-4" onclick="App.showTaskDetail(${t.id})"><div class="flex justify-between items-start mb-2"><span class="status-badge" style="background:${t.tag_color||'#3B82F6'}20;color:${t.tag_color||'#3B82F6'}">${t.tag||'-'}</span><span class="text-xs text-gray-400">${this.formatTime(t.publish_time)}</span></div><div class="text-sm font-medium text-gray-800 mb-1">${t.address||'未填写地址'}</div><div class="text-xs text-gray-500 mb-2">${t.village_name||'-'}</div><div class="flex gap-2"><span class="status-badge survey-${t.survey_status}">${t.survey_status==='not_surveyed'?'未查勘':'已查勘'}</span><span class="status-badge process-${t.process_status}">${this.getProcessStatusText(t.process_status)}</span></div></div>`).join('')}
        </div>
        ${totalPages>1?`<div class="flex justify-center items-center gap-2 mt-4"><button class="btn-secondary px-3 py-1.5 rounded-lg text-sm" onclick="App.changePage(${page-1})" ${page<=1?'disabled':''}>上一页</button><span class="text-sm text-gray-600">${page} / ${totalPages}</span><button class="btn-secondary px-3 py-1.5 rounded-lg text-sm" onclick="App.changePage(${page+1})" ${page>=totalPages?'disabled':''}>下一页</button></div>`:''}
      </div>`;
  },

  // ========== 系统设置页面 ==========
  async renderSettings() {
    const content=document.getElementById('mainContent');
    await this.loadCacheData();
    content.innerHTML=`
      <div class="page-enter">
        <h2 class="text-xl font-bold text-gray-800 mb-4">系统设置</h2>
        <div class="card p-6 mb-4">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">标签管理</h3>
          <div class="flex gap-2 mb-3">
            <input type="text" id="newTagName" class="input-field flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="标签名称">
            <input type="color" id="newTagColor" value="#3B82F6" class="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer">
            <button class="btn-primary px-4 py-2 rounded-xl text-sm" onclick="App.addTag()">添加</button>
          </div>
          <div class="flex flex-wrap gap-2">
            ${this.cachedData.tags.map(t=>`<div class="flex items-center gap-1 px-3 py-1.5 rounded-full" style="background:${t.color||'#3B82F6'}20"><span class="text-sm" style="color:${t.color||'#3B82F6'}">${t.name}</span><button class="text-gray-400 hover:text-red-500 text-xs ml-1" onclick="App.deleteTag(${t.id})">&times;</button></div>`).join('')}
          </div>
        </div>
        <div class="card p-6 mb-4">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">村/社区管理</h3>
          <div class="flex gap-2 mb-3">
            <input type="text" id="newVillageName" class="input-field flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="村/社区名称">
            <button class="btn-primary px-4 py-2 rounded-xl text-sm" onclick="App.addVillage()">添加</button>
          </div>
          <div class="space-y-2">
            ${this.cachedData.villages.map(v=>`<div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"><div><span class="text-sm font-medium">${v.name}</span>${v.leader_name?`<span class="text-xs text-gray-500 ml-2">负责人: ${v.leader_name}</span>`:'<span class="text-xs text-gray-400 ml-2">未设置负责人</span>'}</div><div class="flex gap-2"><button class="text-xs text-blue-600 hover:underline" onclick="App.editVillage(${v.id},'${v.name}')">编辑</button><button class="text-xs text-red-600 hover:underline" onclick="App.deleteVillage(${v.id})">删除</button></div></div>`).join('')}
          </div>
        </div>
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">修改密码</h3>
          <form id="changePasswordForm" class="space-y-3 max-w-md">
            <input type="password" id="oldPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="当前密码" required>
            <input type="password" id="newPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="新密码" required>
            <input type="password" id="confirmPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="确认新密码" required>
            <button type="submit" class="btn-primary px-4 py-2 rounded-xl text-sm">修改密码</button>
          </form>
        </div>
      </div>`;
    document.getElementById('changePasswordForm').addEventListener('submit',async(e)=>{
      e.preventDefault();
      const op=document.getElementById('oldPassword').value,np=document.getElementById('newPassword').value,cp=document.getElementById('confirmPassword').value;
      if(np!==cp){this.showToast('两次密码不一致','error');return;}
      const res=await API.auth.changePassword({old_password:op,new_password:np});
      if(res.code===0){this.showToast('密码修改成功','success');document.getElementById('changePasswordForm').reset();}
      else{this.showToast(res.message||'修改失败','error');}
    });
  },

  async addTag(){
    const name=document.getElementById('newTagName').value.trim(),color=document.getElementById('newTagColor').value;
    if(!name){this.showToast('请输入标签名称','error');return;}
    const res=await API.settings.tags.create({name,color});
    if(res.code===0){this.showToast('标签添加成功','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'添加失败','error');}
  },
  async deleteTag(id){
    if(!confirm('确定删除此标签？'))return;
    const res=await API.settings.tags.delete(id);
    if(res.code===0){this.showToast('标签已删除','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'删除失败','error');}
  },
  async addVillage(){
    const name=document.getElementById('newVillageName').value.trim();
    if(!name){this.showToast('请输入村/社区名称','error');return;}
    const res=await API.settings.villages.create({name});
    if(res.code===0){this.showToast('添加成功','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'添加失败','error');}
  },
  async editVillage(id,currentName){
    const newName=prompt('修改村/社区名称:',currentName);
    if(!newName||newName===currentName)return;
    const res=await API.settings.villages.update(id,{name:newName});
    if(res.code===0){this.showToast('修改成功','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'修改失败','error');}
  },
  async deleteVillage(id){
    if(!confirm('确定删除此村/社区？关联任务不受影响。'))return;
    const res=await API.settings.villages.delete(id);
    if(res.code===0){this.showToast('已删除','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'删除失败','error');}
  },

  // ========== 用户管理页面 ==========
  async renderUserManagement() {
    if(this.currentUser.role!=='admin'){document.getElementById('mainContent').innerHTML='<div class="empty-state"><p>无权限访问</p></div>';return;}
    const content=document.getElementById('mainContent');
    const res=await API.users.list();
    if(res.code!==0){content.innerHTML='<div class="empty-state"><p>加载失败</p></div>';return;}
    const users=res.data;
    content.innerHTML=`
      <div class="page-enter">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-800">用户管理</h2>
          <button class="btn-primary px-4 py-2 rounded-xl text-sm" onclick="App.showAddUserForm()">添加用户</button>
        </div>
        <div id="addUserForm" class="card p-6 mb-4 hidden">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">添加用户</h3>
          <form id="newUserForm" class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" id="newUsername" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="用户名" required>
              <input type="text" id="newDisplayName" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="显示名称" required>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="password" id="newUserPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="密码" required>
              <select id="newUserRole" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" required>
                <option value="publisher">发布人员</option><option value="surveyor">查勘人员</option><option value="admin">管理员</option>
              </select>
            </div>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary px-4 py-2 rounded-xl text-sm">确认添加</button>
              <button type="button" class="btn-secondary px-4 py-2 rounded-xl text-sm" onclick="document.getElementById('addUserForm').classList.add('hidden')">取消</button>
            </div>
          </form>
        </div>
        <div class="card overflow-hidden">
          <table class="data-table"><thead><tr><th>用户名</th><th>显示名称</th><th>角色</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${users.map(u=>`<tr><td class="font-mono text-sm">${u.username}</td><td>${u.display_name}</td><td><span class="status-badge role-${u.role}">${{admin:'管理员',surveyor:'查勘人员',publisher:'发布人员'}[u.role]}</span></td><td><span class="status-badge ${u.is_active?'survey-surveyed':'process-resurvey'}">${u.is_active?'启用':'禁用'}</span></td><td><div class="flex gap-2"><button class="text-xs text-blue-600 hover:underline" onclick="App.toggleUserStatus(${u.id},${u.is_active})">${u.is_active?'禁用':'启用'}</button><button class="text-xs text-red-600 hover:underline" onclick="App.resetUserPassword(${u.id})">重置密码</button></div></td></tr>`).join('')}</tbody></table>
        </div>
      </div>`;
    document.getElementById('newUserForm').addEventListener('submit',async(e)=>{e.preventDefault();await this.addUser();});
  },

  showAddUserForm(){document.getElementById('addUserForm').classList.remove('hidden');},

  async addUser(){
    const data={username:document.getElementById('newUsername').value,display_name:document.getElementById('newDisplayName').value,password:document.getElementById('newUserPassword').value,role:document.getElementById('newUserRole').value};
    if(!data.username||!data.display_name||!data.password){this.showToast('请填写所有字段','error');return;}
    const res=await API.users.create(data);
    if(res.code===0){this.showToast('用户添加成功','success');this.renderUserManagement();}
    else{this.showToast(res.message||'添加失败','error');}
  },

  async toggleUserStatus(id,status){
    const res=await API.users.update(id,{is_active:!status});
    if(res.code===0){this.showToast('状态已更新','success');this.renderUserManagement();}
    else{this.showToast(res.message||'更新失败','error');}
  },

  async resetUserPassword(id){
    if(!confirm('确定重置此用户密码为 123456？'))return;
    const res=await API.users.update(id,{password:'123456'});
    if(res.code===0){this.showToast('密码已重置为 123456','success');}
    else{this.showToast(res.message||'重置失败','error');}
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => App.init());

  getTaskFilters() {
    return {
      tag: document.getElementById('filterTag')?.value||'',
      survey_status: document.getElementById('filterSurvey')?.value||'',
      process_status: document.getElementById('filterProcess')?.value||'',
      village_id: document.getElementById('filterVillage')?.value||'',
      page: this._currentPage||1, limit: 20
    };
  },
  onFilterChange() { this._currentPage=1; this.renderTaskList(); },
  changePage(page) { this._currentPage=page; this.renderTaskList(); },

  // ========== 发布任务页面 ==========
  async renderPublishTask() {
    const content = document.getElementById('mainContent');
    await this.loadCacheData();
    content.innerHTML = `
      <div class="page-enter">
        <h2 class="text-xl font-bold text-gray-800 mb-4">发布新任务</h2>
        <div class="card p-6">
          <form id="publishForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label class="block text-sm font-medium text-gray-700 mb-1">任务标签</label>
                <select id="pubTag" class="input-field w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" required><option value="">请选择标签</option>${this.cachedData.tags.map(t=>`<option value="${t.name}">${t.name}</option>`).join('')}</select></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">保险所属村/社区</label>
                <select id="pubVillage" class="input-field w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" onchange="App.onVillageChange()" required><option value="">请选择村/社区</option>${this.cachedData.villages.map(v=>`<option value="${v.id}" data-leader="${v.leader_id||''}">${v.name}</option>`).join('')}</select></div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">查勘地址</label>
              <input type="text" id="pubAddress" class="input-field w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="请输入查勘地址" required></div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label class="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                <input type="text" id="pubPhone" class="input-field w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="请输入联系电话"></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">负责人</label>
                <select id="pubAssignee" class="input-field w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"><option value="">自动分配</option>${this.cachedData.villages.filter(v=>v.leader_id).map(v=>`<option value="${v.leader_id}">${v.leader_name} (${v.name})</option>`).join('')}</select></div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">和谐购买情况</label>
              <textarea id="pubPurchase" class="input-field w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" rows="3" placeholder="请输入和谐购买情况"></textarea></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">发布时间</label>
              <input type="datetime-local" id="pubTime" class="input-field w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" value="${new Date().toISOString().slice(0,16)}" required></div>
            <div class="flex justify-end pt-2"><button type="submit" class="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium">发布任务</button></div>
          </form>
        </div>
      </div>`;
    document.getElementById('publishForm').addEventListener('submit', async(e)=>{e.preventDefault();await this.submitPublishTask();});
  },

  onVillageChange() {
    const sel=document.getElementById('pubVillage');
    const opt=sel.options[sel.selectedIndex];
    if(opt.dataset.leader) document.getElementById('pubAssignee').value=opt.dataset.leader;
  },

  async submitPublishTask() {
    const data={
      title:'', tag:document.getElementById('pubTag').value,
      village_id:parseInt(document.getElementById('pubVillage').value)||null,
      address:document.getElementById('pubAddress').value,
      contact_phone:document.getElementById('pubPhone').value,
      purchase_info:document.getElementById('pubPurchase').value,
      publish_time:new Date(document.getElementById('pubTime').value).toISOString(),
      assigned_to:parseInt(document.getElementById('pubAssignee').value)||null
    };
    if(!data.tag||!data.village_id||!data.address){this.showToast('请填写必填项','error');return;}
    const res=await API.tasks.create(data);
    if(res.code===0){this.showToast('任务发布成功','success');this.navigate('tasks');}
    else{this.showToast(res.message||'发布失败','error');}
  },

  // ========== 任务详情 ==========
  async showTaskDetail(taskId) {
    const res=await API.tasks.get(taskId);
    if(res.code!==0){this.showToast('加载任务详情失败','error');return;}
    const task=res.data;
    const canSurvey=this.currentUser.role==='admin'||this.currentUser.role==='surveyor';
    const canEdit=this.currentUser.role==='admin'||this.currentUser.role==='publisher';
    const modal=document.getElementById('modalContainer');
    modal.classList.remove('hidden');
    document.getElementById('modalTitle').textContent='任务详情';
    document.getElementById('modalBody').innerHTML=`
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-gray-500">标签</label><div><span class="status-badge" style="background:${task.tag_color||'#3B82F6'}20;color:${task.tag_color||'#3B82F6'}">${task.tag||'-'}</span></div></div>
          <div><label class="text-xs text-gray-500">村/社区</label><div class="text-sm">${task.village_name||'-'}</div></div>
          <div class="col-span-2"><label class="text-xs text-gray-500">查勘地址</label><div class="text-sm font-medium">${task.address||'-'}</div></div>
          <div><label class="text-xs text-gray-500">联系电话</label><div class="text-sm">${task.contact_phone||'-'}</div></div>
          <div><label class="text-xs text-gray-500">负责人</label><div class="text-sm">${task.assignee_name||'-'}</div></div>
          <div><label class="text-xs text-gray-500">查勘状态</label><div><span class="status-badge survey-${task.survey_status}">${task.survey_status==='not_surveyed'?'未查勘':'已查勘'}</span></div></div>
          <div><label class="text-xs text-gray-500">处理状态</label><div><span class="status-badge process-${task.process_status}">${this.getProcessStatusText(task.process_status)}</span></div></div>
          <div><label class="text-xs text-gray-500">发布时间</label><div class="text-sm">${this.formatTime(task.publish_time)}</div></div>
          <div><label class="text-xs text-gray-500">发布人</label><div class="text-sm">${task.creator_name||'-'}</div></div>
        </div>
        ${task.purchase_info?`<div><label class="text-xs text-gray-500">和谐购买情况</label><div class="text-sm mt-1 p-2 bg-gray-50 rounded-lg">${task.purchase_info}</div></div>`:''}
        ${task.remark?`<div><label class="text-xs text-gray-500">备注</label><div class="text-sm mt-1 p-2 bg-gray-50 rounded-lg">${task.remark}</div></div>`:''}
        <div class="border-t pt-3 space-y-3">
          ${canSurvey?`<div><label class="text-xs text-gray-500 block mb-1">查勘操作</label><div class="flex gap-2"><button class="btn-secondary px-3 py-1.5 rounded-lg text-xs" onclick="App.updateSurveyStatus(${task.id},'surveyed')">标记已查勘</button><button class="btn-secondary px-3 py-1.5 rounded-lg text-xs" onclick="App.updateSurveyStatus(${task.id},'not_surveyed')">标记未查勘</button></div></div>`:''}
          ${canSurvey?`<div><label class="text-xs text-gray-500 block mb-1">处理进度</label><div class="flex flex-wrap gap-2"><button class="btn-secondary px-3 py-1.5 rounded-lg text-xs" onclick="App.updateProcessStatus(${task.id},'pending')">待处理</button><button class="btn-secondary px-3 py-1.5 rounded-lg text-xs" onclick="App.updateProcessStatus(${task.id},'resurvey')">需复勘</button><button class="btn-secondary px-3 py-1.5 rounded-lg text-xs" onclick="App.updateProcessStatus(${task.id},'missing_docs')">缺证件</button><button class="btn-primary px-3 py-1.5 rounded-lg text-xs" onclick="App.updateProcessStatus(${task.id},'submitted')">已提交</button></div></div>`:''}
          ${canSurvey?`<div><label class="text-xs text-gray-500 block mb-1">改派负责人</label><div class="flex gap-2"><select id="reassignSelect" class="input-field flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs"><option value="">选择负责人</option>${this.cachedData.villages.filter(v=>v.leader_id).map(v=>`<option value="${v.leader_id}">${v.leader_name} (${v.name})</option>`).join('')}</select><button class="btn-secondary px-3 py-1.5 rounded-lg text-xs" onclick="App.reassignTask(${task.id})">改派</button></div></div>`:''}
          ${canEdit?`<div><label class="text-xs text-gray-500 block mb-1">备注</label><div class="flex gap-2"><input type="text" id="taskRemark" class="input-field flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs" placeholder="输入备注" value="${task.remark||''}"><button class="btn-secondary px-3 py-1.5 rounded-lg text-xs" onclick="App.updateTaskRemark(${task.id})">保存</button></div></div>`:''}
        </div>
      </div>`;
  },

  // ========== 系统设置页面 ==========
  async renderSettings() {
    const content=document.getElementById('mainContent');
    await this.loadCacheData();
    content.innerHTML=`
      <div class="page-enter">
        <h2 class="text-xl font-bold text-gray-800 mb-4">系统设置</h2>
        <div class="card p-6 mb-4">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">标签管理</h3>
          <div class="flex gap-2 mb-3">
            <input type="text" id="newTagName" class="input-field flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="标签名称">
            <input type="color" id="newTagColor" value="#3B82F6" class="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer">
            <button class="btn-primary px-4 py-2 rounded-xl text-sm" onclick="App.addTag()">添加</button>
          </div>
          <div class="flex flex-wrap gap-2">
            ${this.cachedData.tags.map(t=>`<div class="flex items-center gap-1 px-3 py-1.5 rounded-full" style="background:${t.color||'#3B82F6'}20"><span class="text-sm" style="color:${t.color||'#3B82F6'}">${t.name}</span><button class="text-gray-400 hover:text-red-500 text-xs ml-1" onclick="App.deleteTag(${t.id})">&times;</button></div>`).join('')}
          </div>
        </div>
        <div class="card p-6 mb-4">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">村/社区管理</h3>
          <div class="flex gap-2 mb-3">
            <input type="text" id="newVillageName" class="input-field flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="村/社区名称">
            <button class="btn-primary px-4 py-2 rounded-xl text-sm" onclick="App.addVillage()">添加</button>
          </div>
          <div class="space-y-2">
            ${this.cachedData.villages.map(v=>`<div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"><div><span class="text-sm font-medium">${v.name}</span>${v.leader_name?`<span class="text-xs text-gray-500 ml-2">负责人: ${v.leader_name}</span>`:'<span class="text-xs text-gray-400 ml-2">未设置负责人</span>'}</div><div class="flex gap-2"><button class="text-xs text-blue-600 hover:underline" onclick="App.editVillage(${v.id},'${v.name}')">编辑</button><button class="text-xs text-red-600 hover:underline" onclick="App.deleteVillage(${v.id})">删除</button></div></div>`).join('')}
          </div>
        </div>
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">修改密码</h3>
          <form id="changePasswordForm" class="space-y-3 max-w-md">
            <input type="password" id="oldPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="当前密码" required>
            <input type="password" id="newPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="新密码" required>
            <input type="password" id="confirmPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="确认新密码" required>
            <button type="submit" class="btn-primary px-4 py-2 rounded-xl text-sm">修改密码</button>
          </form>
        </div>
      </div>`;
    document.getElementById('changePasswordForm').addEventListener('submit',async(e)=>{
      e.preventDefault();
      const op=document.getElementById('oldPassword').value,np=document.getElementById('newPassword').value,cp=document.getElementById('confirmPassword').value;
      if(np!==cp){this.showToast('两次密码不一致','error');return;}
      const res=await API.auth.changePassword({old_password:op,new_password:np});
      if(res.code===0){this.showToast('密码修改成功','success');document.getElementById('changePasswordForm').reset();}
      else{this.showToast(res.message||'修改失败','error');}
    });
  },

  async addTag(){
    const name=document.getElementById('newTagName').value.trim(),color=document.getElementById('newTagColor').value;
    if(!name){this.showToast('请输入标签名称','error');return;}
    const res=await API.settings.tags.create({name,color});
    if(res.code===0){this.showToast('标签添加成功','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'添加失败','error');}
  },
  async deleteTag(id){
    if(!confirm('确定删除此标签？'))return;
    const res=await API.settings.tags.delete(id);
    if(res.code===0){this.showToast('标签已删除','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'删除失败','error');}
  },
  async addVillage(){
    const name=document.getElementById('newVillageName').value.trim();
    if(!name){this.showToast('请输入村/社区名称','error');return;}
    const res=await API.settings.villages.create({name});
    if(res.code===0){this.showToast('添加成功','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'添加失败','error');}
  },
  async editVillage(id,currentName){
    const newName=prompt('修改村/社区名称:',currentName);
    if(!newName||newName===currentName)return;
    const res=await API.settings.villages.update(id,{name:newName});
    if(res.code===0){this.showToast('修改成功','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'修改失败','error');}
  },
  async deleteVillage(id){
    if(!confirm('确定删除此村/社区？关联任务不受影响。'))return;
    const res=await API.settings.villages.delete(id);
    if(res.code===0){this.showToast('已删除','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'删除失败','error');}
  },

  // ========== 用户管理页面 ==========
  async renderUserManagement() {
    if(this.currentUser.role!=='admin'){document.getElementById('mainContent').innerHTML='<div class="empty-state"><p>无权限访问</p></div>';return;}
    const content=document.getElementById('mainContent');
    const res=await API.users.list();
    if(res.code!==0){content.innerHTML='<div class="empty-state"><p>加载失败</p></div>';return;}
    const users=res.data;
    content.innerHTML=`
      <div class="page-enter">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-800">用户管理</h2>
          <button class="btn-primary px-4 py-2 rounded-xl text-sm" onclick="App.showAddUserForm()">添加用户</button>
        </div>
        <div id="addUserForm" class="card p-6 mb-4 hidden">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">添加用户</h3>
          <form id="newUserForm" class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" id="newUsername" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="用户名" required>
              <input type="text" id="newDisplayName" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="显示名称" required>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="password" id="newUserPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="密码" required>
              <select id="newUserRole" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" required>
                <option value="publisher">发布人员</option><option value="surveyor">查勘人员</option><option value="admin">管理员</option>
              </select>
            </div>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary px-4 py-2 rounded-xl text-sm">确认添加</button>
              <button type="button" class="btn-secondary px-4 py-2 rounded-xl text-sm" onclick="document.getElementById('addUserForm').classList.add('hidden')">取消</button>
            </div>
          </form>
        </div>
        <div class="card overflow-hidden">
          <table class="data-table"><thead><tr><th>用户名</th><th>显示名称</th><th>角色</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${users.map(u=>`<tr><td class="font-mono text-sm">${u.username}</td><td>${u.display_name}</td><td><span class="status-badge role-${u.role}">${{admin:'管理员',surveyor:'查勘人员',publisher:'发布人员'}[u.role]}</span></td><td><span class="status-badge ${u.is_active?'survey-surveyed':'process-resurvey'}">${u.is_active?'启用':'禁用'}</span></td><td><div class="flex gap-2"><button class="text-xs text-blue-600 hover:underline" onclick="App.toggleUserStatus(${u.id},${u.is_active})">${u.is_active?'禁用':'启用'}</button><button class="text-xs text-red-600 hover:underline" onclick="App.resetUserPassword(${u.id})">重置密码</button></div></td></tr>`).join('')}</tbody></table>
        </div>
      </div>`;
    document.getElementById('newUserForm').addEventListener('submit',async(e)=>{e.preventDefault();await this.addUser();});
  },

  showAddUserForm(){document.getElementById('addUserForm').classList.remove('hidden');},

  async addUser(){
    const data={username:document.getElementById('newUsername').value,display_name:document.getElementById('newDisplayName').value,password:document.getElementById('newUserPassword').value,role:document.getElementById('newUserRole').value};
    if(!data.username||!data.display_name||!data.password){this.showToast('请填写所有字段','error');return;}
    const res=await API.users.create(data);
    if(res.code===0){this.showToast('用户添加成功','success');this.renderUserManagement();}
    else{this.showToast(res.message||'添加失败','error');}
  },

  async toggleUserStatus(id,status){
    const res=await API.users.update(id,{is_active:!status});
    if(res.code===0){this.showToast('状态已更新','success');this.renderUserManagement();}
    else{this.showToast(res.message||'更新失败','error');}
  },

  async resetUserPassword(id){
    if(!confirm('确定重置此用户密码为 123456？'))return;
    const res=await API.users.update(id,{password:'123456'});
    if(res.code===0){this.showToast('密码已重置为 123456','success');}
    else{this.showToast(res.message||'重置失败','error');}
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => App.init());

  async updateSurveyStatus(id,status){
    const res=await API.tasks.updateSurvey(id,{survey_status:status});
    if(res.code===0){this.showToast('查勘状态已更新','success');this.closeModal();this.loadCurrentPage();}
    else{this.showToast(res.message||'更新失败','error');}
  },
  async updateProcessStatus(id,status){
    const res=await API.tasks.updateProcess(id,{process_status:status});
    if(res.code===0){this.showToast('处理状态已更新','success');this.closeModal();this.loadCurrentPage();}
    else{this.showToast(res.message||'更新失败','error');}
  },
  async reassignTask(id){
    const aid=document.getElementById('reassignSelect')?.value;
    if(!aid){this.showToast('请选择负责人','error');return;}
    const res=await API.tasks.reassign(id,{assigned_to:parseInt(aid)});
    if(res.code===0){this.showToast('改派成功','success');this.closeModal();this.loadCurrentPage();}
    else{this.showToast(res.message||'改派失败','error');}
  },
  async updateTaskRemark(id){
    const remark=document.getElementById('taskRemark')?.value;
    const res=await API.tasks.update(id,{remark});
    if(res.code===0){this.showToast('备注已保存','success');}
    else{this.showToast(res.message||'保存失败','error');}
  },

  // ========== 已完成任务页面 ==========
  async renderCompletedTasks() {
    const content=document.getElementById('mainContent');
    const res=await API.tasks.completed({page:this._completedPage||1,limit:20});
    if(res.code!==0){content.innerHTML='<div class="empty-state"><p>加载失败</p></div>';return;}
    const{tasks,page,totalPages}=res.data;
    content.innerHTML=`
      <div class="page-enter">
        <h2 class="text-xl font-bold text-gray-800 mb-4">已完成任务</h2>
        ${tasks.length===0?'<div class="empty-state"><p>暂无已完成任务</p></div>':`
        <div class="space-y-3">${tasks.map(t=>`<div class="card card-clickable p-4" onclick="App.showTaskDetail(${t.id})"><div class="flex justify-between items-start mb-2"><span class="status-badge" style="background:${t.tag_color||'#3B82F6'}20;color:${t.tag_color||'#3B82F6'}">${t.tag||'-'}</span><span class="text-xs text-gray-400">${this.formatTime(t.publish_time)}</span></div><div class="text-sm font-medium text-gray-800 mb-1">${t.address||'未填写地址'}</div><div class="text-xs text-gray-500 mb-2">${t.village_name||'-'}</div><div class="flex gap-2"><span class="status-badge survey-${t.survey_status}">${t.survey_status==='not_surveyed'?'未查勘':'已查勘'}</span><span class="status-badge process-${t.process_status}">${this.getProcessStatusText(t.process_status)}</span></div></div>`).join('')}</div>
        ${totalPages>1?`<div class="flex justify-center items-center gap-2 mt-4"><button class="btn-secondary px-3 py-1.5 rounded-lg text-sm" onclick="App._completedPage=${page-1};App.renderCompletedTasks()" ${page<=1?'disabled':''}>上一页</button><span class="text-sm text-gray-600">${page}/${totalPages}</span><button class="btn-secondary px-3 py-1.5 rounded-lg text-sm" onclick="App._completedPage=${page+1};App.renderCompletedTasks()" ${page>=totalPages?'disabled':''}>下一页</button></div>`:''}`}
      </div>`;
  },

  // ========== 系统设置页面 ==========
  async renderSettings() {
    const content=document.getElementById('mainContent');
    await this.loadCacheData();
    content.innerHTML=`
      <div class="page-enter">
        <h2 class="text-xl font-bold text-gray-800 mb-4">系统设置</h2>
        <div class="card p-6 mb-4">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">标签管理</h3>
          <div class="flex gap-2 mb-3">
            <input type="text" id="newTagName" class="input-field flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="标签名称">
            <input type="color" id="newTagColor" value="#3B82F6" class="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer">
            <button class="btn-primary px-4 py-2 rounded-xl text-sm" onclick="App.addTag()">添加</button>
          </div>
          <div class="flex flex-wrap gap-2">
            ${this.cachedData.tags.map(t=>`<div class="flex items-center gap-1 px-3 py-1.5 rounded-full" style="background:${t.color||'#3B82F6'}20"><span class="text-sm" style="color:${t.color||'#3B82F6'}">${t.name}</span><button class="text-gray-400 hover:text-red-500 text-xs ml-1" onclick="App.deleteTag(${t.id})">&times;</button></div>`).join('')}
          </div>
        </div>
        <div class="card p-6 mb-4">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">村/社区管理</h3>
          <div class="flex gap-2 mb-3">
            <input type="text" id="newVillageName" class="input-field flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="村/社区名称">
            <button class="btn-primary px-4 py-2 rounded-xl text-sm" onclick="App.addVillage()">添加</button>
          </div>
          <div class="space-y-2">
            ${this.cachedData.villages.map(v=>`<div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"><div><span class="text-sm font-medium">${v.name}</span>${v.leader_name?`<span class="text-xs text-gray-500 ml-2">负责人: ${v.leader_name}</span>`:'<span class="text-xs text-gray-400 ml-2">未设置负责人</span>'}</div><div class="flex gap-2"><button class="text-xs text-blue-600 hover:underline" onclick="App.editVillage(${v.id},'${v.name}')">编辑</button><button class="text-xs text-red-600 hover:underline" onclick="App.deleteVillage(${v.id})">删除</button></div></div>`).join('')}
          </div>
        </div>
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">修改密码</h3>
          <form id="changePasswordForm" class="space-y-3 max-w-md">
            <input type="password" id="oldPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="当前密码" required>
            <input type="password" id="newPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="新密码" required>
            <input type="password" id="confirmPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="确认新密码" required>
            <button type="submit" class="btn-primary px-4 py-2 rounded-xl text-sm">修改密码</button>
          </form>
        </div>
      </div>`;
    document.getElementById('changePasswordForm').addEventListener('submit',async(e)=>{
      e.preventDefault();
      const op=document.getElementById('oldPassword').value,np=document.getElementById('newPassword').value,cp=document.getElementById('confirmPassword').value;
      if(np!==cp){this.showToast('两次密码不一致','error');return;}
      const res=await API.auth.changePassword({old_password:op,new_password:np});
      if(res.code===0){this.showToast('密码修改成功','success');document.getElementById('changePasswordForm').reset();}
      else{this.showToast(res.message||'修改失败','error');}
    });
  },

  async addTag(){
    const name=document.getElementById('newTagName').value.trim(),color=document.getElementById('newTagColor').value;
    if(!name){this.showToast('请输入标签名称','error');return;}
    const res=await API.settings.tags.create({name,color});
    if(res.code===0){this.showToast('标签添加成功','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'添加失败','error');}
  },
  async deleteTag(id){
    if(!confirm('确定删除此标签？'))return;
    const res=await API.settings.tags.delete(id);
    if(res.code===0){this.showToast('标签已删除','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'删除失败','error');}
  },
  async addVillage(){
    const name=document.getElementById('newVillageName').value.trim();
    if(!name){this.showToast('请输入村/社区名称','error');return;}
    const res=await API.settings.villages.create({name});
    if(res.code===0){this.showToast('添加成功','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'添加失败','error');}
  },
  async editVillage(id,currentName){
    const newName=prompt('修改村/社区名称:',currentName);
    if(!newName||newName===currentName)return;
    const res=await API.settings.villages.update(id,{name:newName});
    if(res.code===0){this.showToast('修改成功','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'修改失败','error');}
  },
  async deleteVillage(id){
    if(!confirm('确定删除此村/社区？关联任务不受影响。'))return;
    const res=await API.settings.villages.delete(id);
    if(res.code===0){this.showToast('已删除','success');await this.loadCacheData();this.renderSettings();}
    else{this.showToast(res.message||'删除失败','error');}
  },

  // ========== 用户管理页面 ==========
  async renderUserManagement() {
    if(this.currentUser.role!=='admin'){document.getElementById('mainContent').innerHTML='<div class="empty-state"><p>无权限访问</p></div>';return;}
    const content=document.getElementById('mainContent');
    const res=await API.users.list();
    if(res.code!==0){content.innerHTML='<div class="empty-state"><p>加载失败</p></div>';return;}
    const users=res.data;
    content.innerHTML=`
      <div class="page-enter">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-800">用户管理</h2>
          <button class="btn-primary px-4 py-2 rounded-xl text-sm" onclick="App.showAddUserForm()">添加用户</button>
        </div>
        <div id="addUserForm" class="card p-6 mb-4 hidden">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">添加用户</h3>
          <form id="newUserForm" class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" id="newUsername" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="用户名" required>
              <input type="text" id="newDisplayName" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="显示名称" required>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="password" id="newUserPassword" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="密码" required>
              <select id="newUserRole" class="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" required>
                <option value="publisher">发布人员</option><option value="surveyor">查勘人员</option><option value="admin">管理员</option>
              </select>
            </div>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary px-4 py-2 rounded-xl text-sm">确认添加</button>
              <button type="button" class="btn-secondary px-4 py-2 rounded-xl text-sm" onclick="document.getElementById('addUserForm').classList.add('hidden')">取消</button>
            </div>
          </form>
        </div>
        <div class="card overflow-hidden">
          <table class="data-table"><thead><tr><th>用户名</th><th>显示名称</th><th>角色</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${users.map(u=>`<tr><td class="font-mono text-sm">${u.username}</td><td>${u.display_name}</td><td><span class="status-badge role-${u.role}">${{admin:'管理员',surveyor:'查勘人员',publisher:'发布人员'}[u.role]}</span></td><td><span class="status-badge ${u.is_active?'survey-surveyed':'process-resurvey'}">${u.is_active?'启用':'禁用'}</span></td><td><div class="flex gap-2"><button class="text-xs text-blue-600 hover:underline" onclick="App.toggleUserStatus(${u.id},${u.is_active})">${u.is_active?'禁用':'启用'}</button><button class="text-xs text-red-600 hover:underline" onclick="App.resetUserPassword(${u.id})">重置密码</button></div></td></tr>`).join('')}</tbody></table>
        </div>
      </div>`;
    document.getElementById('newUserForm').addEventListener('submit',async(e)=>{e.preventDefault();await this.addUser();});
  },

  showAddUserForm(){document.getElementById('addUserForm').classList.remove('hidden');},

  async addUser(){
    const data={username:document.getElementById('newUsername').value,display_name:document.getElementById('newDisplayName').value,password:document.getElementById('newUserPassword').value,role:document.getElementById('newUserRole').value};
    if(!data.username||!data.display_name||!data.password){this.showToast('请填写所有字段','error');return;}
    const res=await API.users.create(data);
    if(res.code===0){this.showToast('用户添加成功','success');this.renderUserManagement();}
    else{this.showToast(res.message||'添加失败','error');}
  },

  async toggleUserStatus(id,status){
    const res=await API.users.update(id,{is_active:!status});
    if(res.code===0){this.showToast('状态已更新','success');this.renderUserManagement();}
    else{this.showToast(res.message||'更新失败','error');}
  },

  async resetUserPassword(id){
    if(!confirm('确定重置此用户密码为 123456？'))return;
    const res=await API.users.update(id,{password:'123456'});
    if(res.code===0){this.showToast('密码已重置为 123456','success');}
    else{this.showToast(res.message||'重置失败','error');}
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => App.init());