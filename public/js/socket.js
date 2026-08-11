// Socket.io 实时同步
const Socket = {
  io: null,
  connected: false,
  listeners: {},

  // 连接Socket.io
  connect() {
    const token = localStorage.getItem('token');
    const baseUrl = API.getBaseUrl();
    
    // 转换URL用于socket连接
    const socketUrl = baseUrl.replace(/^http/, 'http').replace(/^https/, 'https');
    
    try {
      this.io = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000
      });

      this.io.on('connect', () => {
        console.log('Socket.io 已连接');
        this.connected = true;
      });

      this.io.on('disconnect', () => {
        console.log('Socket.io 已断开');
        this.connected = false;
      });

      this.io.on('connect_error', (err) => {
        console.warn('Socket.io 连接错误:', err.message);
        this.connected = false;
      });

      // 监听任务变更事件
      this.io.on('task_updated', (data) => {
        this.emit('task_updated', data);
      });

    } catch (err) {
      console.warn('Socket.io 初始化失败:', err);
    }
  },

  // 断开连接
  disconnect() {
    if (this.io) {
      this.io.disconnect();
      this.io = null;
      this.connected = false;
    }
  },

  // 注册事件监听
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  },

  // 移除事件监听
  off(event, callback) {
    if (this.listeners[event]) {
      if (callback) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      } else {
        delete this.listeners[event];
      }
    }
  },

  // 触发事件
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('事件处理错误:', err);
        }
      });
    }
  },

  // 检查连接状态
  isConnected() {
    return this.connected;
  }
};