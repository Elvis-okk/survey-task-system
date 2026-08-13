// Comprehensive API test
const http = require('http');

function apiCall(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const options = { hostname: 'localhost', port: 22233, path, method, headers: { 'Content-Type': 'application/json' } };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(options, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(body); } });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  let pass = 0, fail = 0;
  function check(name, ok) { if (ok) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}`); } }

  // 1. Login
  console.log('\n=== 1. 登录 ===');
  const login = await apiCall('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  check('管理员登录', login.code === 0);
  check('返回village_ids字段', login.data?.user?.village_ids !== undefined);
  const token = login.data?.token;

  // 2. Surveyors - only surveyor role
  console.log('\n=== 2. 查勘员列表 ===');
  const surveyors = await apiCall('GET', '/api/users/surveyors', null, token);
  check('获取查勘员列表', surveyors.code === 0);
  if (surveyors.data) {
    const hasAdmin = surveyors.data.some(s => s.role === 'admin');
    check('只返回surveyor角色', !hasAdmin);
    check('查勘员有village_ids', surveyors.data.every(s => s.village_ids !== undefined));
    check('查勘员有village_names', surveyors.data.every(s => s.village_names !== undefined));
    surveyors.data.forEach(s => console.log(`    id=${s.id} ${s.display_name} role=${s.role} village_ids="${s.village_ids}" village_names="${s.village_names}"`));
  }

  // 3. Create task + rejected flow
  console.log('\n=== 3. 拒赔流程 ===');
  const newTask = await apiCall('POST', '/api/tasks', {
    title: '测试拒赔', publish_time: '2026-08-13T10:00', tag: '',
    village_id: 8, address: 'test', contact_person: 'test',
    contact_phone: '13800000000', assigned_to: 2
  }, token);
  check('创建任务', newTask.code === 0);
  const taskId = newTask.data?.id || newTask.data;

  if (taskId) {
    const survey = await apiCall('PUT', `/api/tasks/${taskId}/survey`, { survey_status: 'surveyed' }, token);
    check('标记已查勘', survey.code === 0);

    const proc = await apiCall('PUT', `/api/tasks/${taskId}/process`, { process_status: 'rejected', process_remark: '拒赔' }, token);
    check('设置拒赔', proc.code === 0);

    const completed = await apiCall('GET', '/api/tasks?task_category=completed&pageSize=10', null, token);
    const found = completed.data?.tasks?.some(t => t.id === taskId || t.id === Number(taskId));
    check('拒赔任务进入已完成', !!found);

    // Delete test task (any user can delete)
    const del = await apiCall('DELETE', `/api/tasks/${taskId}`, null, token);
    check('删除任务(任意用户)', del.code === 0);
  }

  // 4. Password change
  console.log('\n=== 4. 修改密码 ===');
  const wrongOld = await apiCall('PUT', '/api/auth/password', { old_password: 'wrong', new_password: 'newpass123' }, token);
  check('旧密码错误被拒绝', wrongOld.code !== 0);

  const tooShort = await apiCall('PUT', '/api/auth/password', { old_password: 'admin123', new_password: '123' }, token);
  check('新密码太短被拒绝', tooShort.code !== 0);

  // 5. Settings page accessible
  console.log('\n=== 5. 设置页面 ===');
  const settingsPage = await apiCall('GET', '/settings.html', null, null);
  check('设置页面可访问', typeof settingsPage === 'string' && settingsPage.includes('修改密码'));

  console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
  process.exit(fail > 0 ? 1 : 0);
}

test().catch(e => { console.error('Error:', e.message); process.exit(1); });