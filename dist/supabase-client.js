(function () {
  const config = window.YEONJO_CONFIG;
  const sessionKey = 'yeonjo-supabase-session';

  function session() {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || 'null');
    } catch {
      return null;
    }
  }

  function saveSession(value) {
    if (value) localStorage.setItem(sessionKey, JSON.stringify(value));
    else localStorage.removeItem(sessionKey);
  }

  async function authRequest(path, body) {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || data.message || data.error_description || '인증 요청에 실패했습니다.');
    if (data.access_token) saveSession(data);
    return data;
  }

  async function request(table, options = {}) {
    const current = session();
    const headers = {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${current?.access_token || config.supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation'
    };
    const query = options.query ? `?${options.query}` : '';
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}${query}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.details || '데이터 요청에 실패했습니다.');
    return data;
  }

  window.yeonjoDb = {
    session,
    signUp: (email, password, fullName) => authRequest('signup', { email, password, data: { full_name: fullName } }),
    signIn: (email, password) => authRequest('token?grant_type=password', { email, password }),
    signOut: () => saveSession(null),
    request
  };
})();
