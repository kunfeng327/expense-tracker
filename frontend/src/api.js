const BASE = ''

async function req(path, options = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...options,
  })
  if (res.status === 401 && !path.startsWith('/api/auth')) {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    location.reload() // 触发重新进入登录页
    throw new Error('登录已过期')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `请求失败 (${res.status})`)
  }
  return res.json()
}

export const api = {
  auth: (mode, body) => req(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
    method: 'POST', body: JSON.stringify(body),
  }),
  me: () => req('/api/auth/me'),
  getProfile: () => req('/api/profile'),
  setProfile: body => req('/api/profile', { method: 'POST', body: JSON.stringify(body) }),
  deleteAccount: body => req('/api/profile', { method: 'DELETE', body: JSON.stringify(body) }),
  listRecords: month => req(`/api/records?month=${month}`),
  addRecord: body => req('/api/records', { method: 'POST', body: JSON.stringify(body) }),
  updateRecord: (id, body) => req(`/api/records/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRecord: id => req(`/api/records/${id}`, { method: 'DELETE' }),
  listCategories: () => req('/api/categories'),
  addCategory: body => req('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
  deleteCategory: id => req(`/api/categories/${id}`, { method: 'DELETE' }),
  getBudget: month => req(`/api/budget/${month}`),
  setBudget: (month, body) => req(`/api/budget/${month}`, { method: 'POST', body: JSON.stringify(body) }),
  getStats: month => req(`/api/stats/${month}`),
  listPractice: () => req('/api/practice'),
  addPractice: body => req('/api/practice', { method: 'POST', body: JSON.stringify(body) }),
  deletePractice: id => req(`/api/practice/${id}`, { method: 'DELETE' }),
  listNotes: () => req('/api/notes'),
  addNote: body => req('/api/notes', { method: 'POST', body: JSON.stringify(body) }),
  deleteNote: id => req(`/api/notes/${id}`, { method: 'DELETE' }),
  getBibleProgress: () => req('/api/bible/progress'),
  bibleDone: () => req('/api/bible/done', { method: 'POST' }),
  listTodo: date => req(`/api/todo${date ? `?date=${date}` : ''}`),
  listTodoMonth: month => req(`/api/todo?month=${month}`),
  addTodo: body => req('/api/todo', { method: 'POST', body: JSON.stringify(body) }),
  updateTodo: (id, body) => req(`/api/todo/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTodo: id => req(`/api/todo/${id}`, { method: 'DELETE' }),
}

export const fmt = n => '¥' + Number(n || 0).toFixed(2)

export function monthShift(month, d) {
  const [y, m] = month.split('-').map(Number)
  const dt = new Date(y, m - 1 + d, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}
