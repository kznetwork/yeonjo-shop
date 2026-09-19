(function () {
  const db = window.yeonjoDb;
  const app = document.getElementById('adminApp');
  const statusLabels = { payment_pending:'결제 대기', paid:'결제 완료', preparing:'상품 준비 중', ready_to_ship:'배송 준비', shipping:'배송 중', delivered:'배송 완료', cancelled:'취소', return_requested:'반품 요청', returned:'반품 완료' };
  const roleLabels = { customer:'고객', super_admin:'최고 관리자', order_manager:'주문 담당자', shipping_manager:'배송 담당자' };
  let profile;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const money = value => `${Number(value || 0).toLocaleString('ko-KR')}원`;

  async function currentProfile() {
    const current = db.session();
    if (!current?.user) return null;
    const rows = await db.request('profiles', { query:`id=eq.${current.user.id}&select=*` });
    return rows[0] || null;
  }

  async function authenticate(email, password) {
    await db.signIn(email, password);
    profile = await currentProfile();
    if (!profile || profile.role === 'customer' || !profile.active) {
      db.signOut();
      throw new Error('관리자 권한이 없는 계정입니다.');
    }
    shell();
    dashboard();
  }

  function shell() {
    app.innerHTML = `<div class="admin-shell"><aside class="sidebar"><p class="kicker">OPERATIONS</p><h1>YEONJO</h1><nav><button class="active" data-view="dashboard">대시보드</button><button data-view="products">상품관리</button><button data-view="orders">주문·배송</button><button data-view="members">회원관리</button><button data-view="settings">운영설정</button></nav><a href="index.html">쇼핑몰 보기 ↗</a><button id="adminLogout">로그아웃</button></aside><section class="content" id="content"></section></div>`;
    document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => {
      document.querySelectorAll('[data-view]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      ({ dashboard, products, orders, members, settings }[button.dataset.view])();
    });
    document.getElementById('adminLogout').onclick = () => { db.signOut(); location.reload(); };
  }

  async function dashboard() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="topline"><div><p class="kicker">OVERVIEW</p><h2>운영 현황</h2></div></div><p>데이터를 불러오는 중입니다.</p>';
    try {
      const [ordersData, membersData] = await Promise.all([
        db.request('orders', { query:'select=id,status,total,created_at&order=created_at.desc' }),
        db.request('profiles', { query:'select=id,created_at' })
      ]);
      const revenue = ordersData.filter(order => !['cancelled','returned'].includes(order.status)).reduce((sum, order) => sum + order.total, 0);
      const pending = ordersData.filter(order => ['payment_pending','paid','preparing','ready_to_ship'].includes(order.status)).length;
      const shipping = ordersData.filter(order => order.status === 'shipping').length;
      content.innerHTML = `<div class="topline"><div><p class="kicker">OVERVIEW</p><h2>운영 현황</h2></div><span>${escapeHtml(profile.email)} · ${roleLabels[profile.role]}</span></div><div class="stats"><div class="stat">전체 주문<b>${ordersData.length}</b></div><div class="stat">처리 대기<b>${pending}</b></div><div class="stat">배송 중<b>${shipping}</b></div><div class="stat">주문 합계<b>${money(revenue)}</b></div></div><div class="panel"><h3>회원 현황</h3><p>현재 등록 회원은 <b>${membersData.length}명</b>입니다.</p></div>`;
    } catch (error) { content.innerHTML += `<p class="message">${escapeHtml(error.message)}</p>`; }
  }

  async function orders() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="topline"><div><p class="kicker">ORDERS</p><h2>주문·배송 관리</h2></div></div><p>불러오는 중입니다.</p>';
    try {
      const rows = await db.request('orders', { query:'select=*,shipments(*)&order=created_at.desc' });
      content.innerHTML = `<div class="topline"><div><p class="kicker">ORDERS</p><h2>주문·배송 관리</h2></div><span>${rows.length}건</span></div><div class="table-wrap"><table><thead><tr><th>주문번호</th><th>주문일</th><th>받는 분</th><th>금액</th><th>상태</th><th>송장</th><th></th></tr></thead><tbody>${rows.map(order => `<tr><td>${escapeHtml(order.order_number)}</td><td>${new Date(order.created_at).toLocaleDateString('ko-KR')}</td><td>${escapeHtml(order.recipient_name)}<br><small>${escapeHtml(order.recipient_phone)}</small></td><td>${money(order.total)}</td><td><span class="status">${statusLabels[order.status]}</span></td><td>${escapeHtml(order.shipments?.[0]?.tracking_number || '-')}</td><td><button data-order="${order.id}">관리</button></td></tr>`).join('')}</tbody></table></div><div id="orderEditor"></div>`;
      document.querySelectorAll('[data-order]').forEach(button => button.onclick = () => editOrder(rows.find(order => order.id === Number(button.dataset.order))));
    } catch (error) { content.innerHTML += `<p class="message">${escapeHtml(error.message)}</p>`; }
  }

  async function products() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="topline"><div><p class="kicker">PRODUCTS</p><h2>상품관리</h2></div></div><p>불러오는 중입니다.</p>';
    try {
      const rows = await db.request('products', { query:'select=*&order=sort_order.asc,created_at.desc' });
      const canManage = profile.active && profile.role !== 'customer';
      content.innerHTML = `<div class="topline"><div><p class="kicker">PRODUCTS</p><h2>상품관리</h2></div><button id="newProduct" ${canManage ? '' : 'disabled'}>상품 추가</button></div><div class="table-wrap"><table><thead><tr><th>상품명</th><th>카테고리</th><th>판매가</th><th>재고</th><th>판매 상태</th><th></th></tr></thead><tbody>${rows.length ? rows.map(item => `<tr><td><b>${escapeHtml(item.name)}</b><br><small>${escapeHtml(item.material || '-')}</small></td><td>${escapeHtml(productCategory(item.category))}</td><td>${money(item.price)}</td><td>${Number(item.inventory || 0)}개</td><td><span class="status">${item.active ? '판매 중' : '판매 중지'}</span></td><td><button data-product="${item.id}" ${canManage ? '' : 'disabled'}>수정</button></td></tr>`).join('') : '<tr><td colspan="6">등록된 상품이 없습니다.</td></tr>'}</tbody></table></div><div id="productEditor"></div>`;
      document.getElementById('newProduct').onclick = () => editProduct();
      document.querySelectorAll('[data-product]').forEach(button => button.onclick = () => editProduct(rows.find(item => item.id === Number(button.dataset.product))));
    } catch (error) { content.innerHTML += `<p class="message">${escapeHtml(error.message)}</p>`; }
  }

  const productCategory = value => ({ necklace:'네크리스', ring:'링', earring:'이어링' }[value] || value);

  function editProduct(item = null) {
    const target = document.getElementById('productEditor');
    target.innerHTML = `<div class="panel" style="margin-top:18px"><h3>${item ? '상품 수정' : '새 상품 등록'}</h3><form class="editor" id="productForm"><label>상품명<input name="name" required value="${escapeHtml(item?.name || '')}"></label><label>카테고리<select name="category">${[['necklace','네크리스'],['ring','링'],['earring','이어링']].map(([value,label]) => `<option value="${value}" ${item?.category === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>판매가<input name="price" type="number" min="0" required value="${item?.price || 0}"></label><label>재고 수량<input name="inventory" type="number" min="0" required value="${item?.inventory || 0}"></label><label>소재<input name="material" value="${escapeHtml(item?.material || '')}"></label><label>뱃지<select name="badge"><option value="">없음</option><option value="NEW" ${item?.badge === 'NEW' ? 'selected' : ''}>NEW</option><option value="BEST" ${item?.badge === 'BEST' ? 'selected' : ''}>BEST</option></select></label><label class="wide">상품 설명<input name="description" value="${escapeHtml(item?.description || '')}"></label><label>정렬 순서<input name="sort_order" type="number" min="0" value="${item?.sort_order || 0}"></label><label>판매 상태<select name="active"><option value="true" ${item?.active !== false ? 'selected' : ''}>판매 중</option><option value="false" ${item?.active === false ? 'selected' : ''}>판매 중지</option></select></label><p class="message wide" id="productMessage"></p><button class="wide" type="submit">${item ? '상품 저장' : '상품 등록'}</button></form></div>`;
    document.getElementById('productForm').onsubmit = async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const body = { name:data.get('name'), category:data.get('category'), price:Number(data.get('price')), inventory:Number(data.get('inventory')), material:data.get('material') || null, badge:data.get('badge') || null, description:data.get('description') || null, sort_order:Number(data.get('sort_order')), active:data.get('active') === 'true', updated_at:new Date().toISOString() };
      try {
        if (item) await db.request('products', { method:'PATCH', query:`id=eq.${item.id}`, body });
        else await db.request('products', { method:'POST', body });
        products();
      } catch (error) { document.getElementById('productMessage').textContent = error.message; }
    };
  }

  async function editOrder(order) {
    const shipment = order.shipments?.[0] || {};
    document.getElementById('orderEditor').innerHTML = `<div class="panel" style="margin-top:18px"><h3>${escapeHtml(order.order_number)} 처리</h3><form class="editor" id="orderForm"><label>주문 상태<select name="status">${Object.entries(statusLabels).map(([value,label]) => `<option value="${value}" ${value === order.status ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>택배사<input name="carrier" value="${escapeHtml(shipment.carrier || 'CJ대한통운')}"></label><label>송장번호<input name="tracking" value="${escapeHtml(shipment.tracking_number || '')}"></label><label>배송지<input value="${escapeHtml(`${order.postal_code} ${order.address_line1} ${order.address_line2 || ''}`)}" disabled></label><p class="message wide" id="orderMessage"></p><button class="wide" type="submit">변경사항 저장</button></form></div>`;
    document.getElementById('orderForm').onsubmit = async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      try {
        await db.request('orders', { method:'PATCH', query:`id=eq.${order.id}`, body:{ status:data.get('status'), updated_at:new Date().toISOString() } });
        await db.request('shipments', { method:'POST', query:'on_conflict=order_id', prefer:'resolution=merge-duplicates,return=representation', body:{ order_id:order.id, carrier:data.get('carrier'), tracking_number:data.get('tracking') || null, shipped_at:data.get('status') === 'shipping' ? new Date().toISOString() : shipment.shipped_at || null, delivered_at:data.get('status') === 'delivered' ? new Date().toISOString() : shipment.delivered_at || null, updated_at:new Date().toISOString() } });
        document.getElementById('orderMessage').textContent = '저장되었습니다.';
      } catch (error) { document.getElementById('orderMessage').textContent = error.message; }
    };
  }

  async function members() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="topline"><div><p class="kicker">MEMBERS</p><h2>회원관리</h2></div></div><p>불러오는 중입니다.</p>';
    try {
      const rows = await db.request('profiles', { query:'select=*&order=created_at.desc' });
      content.innerHTML = `<div class="topline"><div><p class="kicker">MEMBERS</p><h2>회원관리</h2></div><span>${rows.length}명</span></div><div class="table-wrap"><table><thead><tr><th>가입일</th><th>회원</th><th>권한</th><th>상태</th><th></th></tr></thead><tbody>${rows.map(member => `<tr><td>${new Date(member.created_at).toLocaleDateString('ko-KR')}</td><td>${escapeHtml(member.full_name || '-')}<br><small>${escapeHtml(member.email)}</small></td><td><select data-role="${member.id}" ${profile.role !== 'super_admin' ? 'disabled' : ''}>${Object.entries(roleLabels).map(([value,label]) => `<option value="${value}" ${value === member.role ? 'selected' : ''}>${label}</option>`).join('')}</select></td><td>${member.active ? '활성' : '정지'}</td><td><button data-active="${member.id}" data-value="${member.active}" ${profile.role !== 'super_admin' ? 'disabled' : ''}>${member.active ? '정지' : '활성화'}</button></td></tr>`).join('')}</tbody></table></div>`;
      document.querySelectorAll('[data-role]').forEach(select => select.onchange = () => db.request('profiles', { method:'PATCH', query:`id=eq.${select.dataset.role}`, body:{ role:select.value, updated_at:new Date().toISOString() } }));
      document.querySelectorAll('[data-active]').forEach(button => button.onclick = async () => { await db.request('profiles', { method:'PATCH', query:`id=eq.${button.dataset.active}`, body:{ active:button.dataset.value !== 'true', updated_at:new Date().toISOString() } }); members(); });
    } catch (error) { content.innerHTML += `<p class="message">${escapeHtml(error.message)}</p>`; }
  }

  async function settings() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="topline"><div><p class="kicker">SETTINGS</p><h2>운영설정</h2></div></div><p>불러오는 중입니다.</p>';
    try {
      const [setting] = await db.request('app_settings', { query:'id=eq.1&select=*' });
      content.innerHTML = `<div class="topline"><div><p class="kicker">SETTINGS</p><h2>운영설정</h2></div></div><div class="panel"><form class="editor" id="settingsForm"><label>기본 택배사<input name="carrier" value="${escapeHtml(setting.carrier)}"></label><label>주문 알림 이메일<input name="email" type="email" value="${escapeHtml(setting.order_alert_email)}"></label><label>기본 배송비<input name="base" type="number" value="${setting.base_shipping_fee}"></label><label>무료배송 기준<input name="free" type="number" value="${setting.free_shipping_threshold}"></label><label>제주·도서산간 추가비<input name="remote" type="number" value="${setting.remote_area_fee}"></label><p class="message wide" id="settingsMessage"></p><button class="wide" type="submit" ${profile.role !== 'super_admin' ? 'disabled' : ''}>설정 저장</button></form></div>`;
      document.getElementById('settingsForm').onsubmit = async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await db.request('app_settings', { method:'PATCH', query:'id=eq.1', body:{ carrier:data.get('carrier'), order_alert_email:data.get('email'), base_shipping_fee:Number(data.get('base')), free_shipping_threshold:Number(data.get('free')), remote_area_fee:Number(data.get('remote')), updated_at:new Date().toISOString() } }); document.getElementById('settingsMessage').textContent = '저장되었습니다.'; } catch (error) { document.getElementById('settingsMessage').textContent = error.message; } };
    } catch (error) { content.innerHTML += `<p class="message">${escapeHtml(error.message)}</p>`; }
  }

  document.getElementById('adminLogin').onsubmit = async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await authenticate(data.get('email'), data.get('password')); } catch (error) { document.getElementById('loginMessage').textContent = error.message; } };
  currentProfile().then(result => { if (result && result.role !== 'customer' && result.active) { profile = result; shell(); dashboard(); } });
})();

