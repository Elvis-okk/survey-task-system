// API调用封装
const API = {
  // 获取基础URL
  getBaseUrl() {
    const serverUrl = localStorage.getItem('serverUrl');
    if (serverUrl) {
      return serverUrl.replace(/\/$/, '');
    }
    return window.location.origin;
  },

  // 获取token
  getToken() {
    return localStorage.getItem('token');
  },

  // 通用请求方法
  async request(method, url, data = null) {
    const baseUrl = this.getBaseUrl();
    const token = this.getToken();
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
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

      // token过期处理
      if (result.code === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return { code: 401, data: null, message: '登录已过期，请重新登录' };
      }

      return result;
    } catch (err) {
      console.error('API请求错误:', err);
      return { code: 500, data: null, message: '网络错误，请检查服务器连接' };
    }
  },

  // GET请求
  get(url) {
    return this.request('GET', url);
  },

  // POST请求
  post(url, data) {
    return this.request('POST', url, data);
  },

  // PUT请求
  put(url, data) {
    return this.request('PUT', url, data);
  },

  // DELETE请求
  delete(url) {
    return this.request('DELETE', url);
  },

  // ========== 认证API ==========
  auth: {
    login(username, password) {
      return API.post('/api/auth/login', { username, password });
    },
    logout() {
      return API.post('/api/auth/logout');
    },
    me() {
      return API.get('/api/auth/me');
    },
    changePassword(old_password, new_password) {
      return API.put('/api/auth/password', { old_password, new_password });
    }
  },

  // ========== 用户API ==========
  users: {
    list() {
      return API.get('/api/users');
    },
    create(data) {
      return API.post('/api/users', data);
    },
    update(id, data) {
      return API.put(`/api/users/${id}`, data);
    },
    delete(id) {
      return API.delete(`/api/users/${id}`);
    },
    updateRole(id, role) {
      return API.put(`/api/users/${id}/role`, { role });
    }
  },

  // ========== 任务API ==========
  tasks: {
    list(params = {}) {
      const query = new URLSearchParams(params).toString();
      return API.get(`/api/tasks${query ? '?' + query : ''}`);
    },
    get(id) {
      return API.get(`/api/tasks/${id}`);
    },
    create(data) {
      return API.post('/api/tasks', data);
    },
    update(id, data) {
      return API.put(`/api/tasks/${id}`, data);
    },
    updateSurvey(id, survey_status) {
      return API.put(`/api/tasks/${id}/survey`, { survey_status });
    },
    updateProcess(id, process_status) {
      return API.put(`/api/tasks/${id}/process`, { process_status });
    },
    reassign(id, assigned_to) {
      return API.put(`/api/tasks/${id}/reassign`, { assigned_to });
    },
    completed(params = {}) {
      const query = new URLSearchParams(params).toString();
      return API.get(`/api/tasks/completed${query ? '?' + query : ''}`);
    },
    stats() {
      return API.get('/api/tasks/stats');
    }
  },

  // ========== 设置API ==========
  settings: {
    getAll() {
      return API.get('/api/settings');
    },
    update(key, value) {
      return API.put(`/api/settings/${key}`, { value });
    },
    // 标签
    tags: {
      list() {
        return API.get('/api/settings/tags');
      },
      create(data) {
        return API.post('/api/settings/tags', data);
      },
      update(id, data) {
        return API.put(`/api/settings/tags/${id}`, data);
      },
      delete(id) {
        return API.delete(`/api/settings/tags/${id}`);
      }
    },
    // 村/社区
    villages: {
      list() {
        return API.get('/api/settings/villages');
      },
      create(data) {
        return API.post('/api/settings/villages', data);
      },
      update(id, data) {
        return API.put(`/api/settings/villages/${id}`, data);
      },
      delete(id) {
        return API.delete(`/api/settings/villages/${id}`);
      }
    }
  }
};