(function () {
  const db = window.yeonjoDb;
  const config = window.YEONJO_CONFIG;
  const labels = { payment_pending:'결제 대기', paid:'결제 완료', preparing:'상품 준비 중', ready_to_ship:'배송 준비', shipping:'배송 중', delivered:'배송 완료', cancelled:'취소', return_requested:'반품 요청', returned:'반품 완료' };

  function track() {
    if (config.googleAnalyticsId) {
      const ga = document.createElement('script'); ga.async = true; ga.src = `https://www.googletagmanager.com/gtag/js?id=${config.googleAnalyticsId}`; document.head.appendChild(ga);
      window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); }; gtag('js', new Date()); gtag('config', config.googleAnalyticsId);
    }
    if (config.clarityProjectId) {
      (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,'clarity','script',config.clarityProjectId);
    }
  }

  const layer = document.createElement('div'); layer.className = 'member-layer'; layer.innerHTML = '<section class="member-card" id="memberCard"></section>'; document.body.appendChild(layer);
  function closeMember() { layer.classList.remove('open'); }
  function openMember() { layer.classList.add('open'); }
  layer.addEventListener('click', event => { if (event.target === layer) closeMember(); });

  function authView(mode = 'signin', message = '') {
    const signup = mode === 'signup';
    document.getElementById('memberCard').innerHTML = `<button class="icon-btn member-close" aria-label="닫기">×</button><h2>${signup ? '회원가입' : '로그인'}</h2><p>${signup ? '주문 내역과 배송 상태를 한곳에서 확인하세요.' : '회원 정보와 주문 내역을 안전하게 확인하세요.'}</p><div class="member-tabs"><button class="member-tab ${!signup ? 'active' : ''}" data-mode="signin">로그인</button><button class="member-tab ${signup ? 'active' : ''}" data-mode="signup">회원가입</button></div><form class="member-form" id="authForm">${signup ? '<label>이름<input name="fullName" required autocomplete="name"></label>' : ''}<label>이메일<input name="email" type="email" required autocomplete="email"></label><label>비밀번호<input name="password" type="password" minlength="8" required autocomplete="current-password"></label><div class="form-message">${message}</div><button class="cta add" type="submit">${signup ? '가입하기' : '로그인'}</button></form>`;
    document.querySelector('.member-close').onclick = closeMember;
    document.querySelectorAll('[data-mode]').forEach(btn => btn.onclick = () => authView(btn.dataset.mode));
    document.getElementById('authForm').onsubmit = async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      try {
        if (signup) { const result = await db.signUp(data.get('email'), data.get('password'), data.get('fullName')); if (!result.access_token) return authView('signin', '확인 이메일을 발송했습니다. 인증 후 로그인해 주세요.'); }
        else await db.signIn(data.get('email'), data.get('password'));
        await accountView();
      } catch (error) { authView(mode, error.message); }
    };
    openMember();
  }

  async function accountView() {
    const current = db.session(); if (!current?.user) return authView(); let orders = [];
    try { orders = await db.request('orders', { query:`user_id=eq.${current.user.id}&select=*&order=created_at.desc` }); } catch {}
    document.getElementById('memberCard').innerHTML = `<button class="icon-btn member-close" aria-label="닫기">×</button><span class="eyebrow">My account</span><h2>나의 YEONJO</h2><p>${current.user.email}</p><div class="my-orders">${orders.length ? orders.map(order => `<article class="my-order"><header><b>${order.order_number}</b><span>${labels[order.status]}</span></header><small>${new Date(order.created_at).toLocaleDateString('ko-KR')} · ${order.total.toLocaleString('ko-KR')}원</small></article>`).join('') : '<p>아직 주문 내역이 없습니다.</p>'}</div><div class="member-actions"><button class="secondary-btn" id="logout">로그아웃</button><a class="secondary-btn" href="admin.html">관리자 페이지</a></div>`;
    document.querySelector('.member-close').onclick = closeMember; document.getElementById('logout').onclick = () => { db.signOut(); closeMember(); }; openMember();
  }

  function checkoutView() {
    const current = db.session(); if (!current?.user) return authView('signin', '주문하려면 먼저 로그인해 주세요.'); if (!state.cart.length) return;
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0); const baseFee = subtotal >= config.shipping.freeThreshold ? 0 : config.shipping.baseFee;
    document.getElementById('memberCard').innerHTML = `<button class="icon-btn member-close" aria-label="닫기">×</button><span class="eyebrow">Checkout</span><h2>배송 정보</h2><p>무통장 입금 주문으로 접수됩니다.</p><form class="member-form" id="checkoutForm"><div class="form-grid"><label>받는 분<input name="name" required></label><label>연락처<input name="phone" required inputmode="tel"></label></div><div class="form-grid"><label>우편번호<input name="postal" required></label><label>지역 구분<select name="remote"><option value="0">일반 지역</option><option value="1">제주·도서산간</option></select></label></div><label>주소<input name="address1" required></label><label>상세 주소<input name="address2"></label><label>배송 메모<textarea name="memo"></textarea></label><div class="member-summary"><div><span>상품 금액</span><b>${subtotal.toLocaleString('ko-KR')}원</b></div><div><span>기본 배송비</span><b>${baseFee.toLocaleString('ko-KR')}원</b></div><div class="grand"><span>결제 예정 금액</span><b id="checkoutTotal">${(subtotal + baseFee).toLocaleString('ko-KR')}원</b></div></div><div class="form-message" id="checkoutMessage"></div><button class="cta add" type="submit">주문 접수하기</button></form>`;
    document.querySelector('.member-close').onclick = closeMember; const remote = document.querySelector('[name=remote]'); remote.onchange = () => { document.getElementById('checkoutTotal').textContent = `${(subtotal + baseFee + (remote.value === '1' ? config.shipping.remoteAreaFee : 0)).toLocaleString('ko-KR')}원`; };
    document.getElementById('checkoutForm').onsubmit = async event => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const shippingFee = baseFee + (form.get('remote') === '1' ? config.shipping.remoteAreaFee : 0);
      try {
        const [order] = await db.request('orders', { method:'POST', body:{ user_id:current.user.id, subtotal, shipping_fee:shippingFee, total:subtotal + shippingFee, recipient_name:form.get('name'), recipient_phone:form.get('phone'), postal_code:form.get('postal'), address_line1:form.get('address1'), address_line2:form.get('address2'), delivery_memo:form.get('memo') } });
        await db.request('order_items', { method:'POST', body:state.cart.map(item => ({ order_id:order.id, product_id:item.product_id || 0, product_name:item.name, option_name:item.option, quantity:item.qty, unit_price:item.price })) });
        state.cart = []; saveCart(); document.getElementById('memberCard').innerHTML = `<button class="icon-btn member-close" aria-label="닫기">×</button><span class="eyebrow">Order received</span><h2>주문이 접수되었습니다.</h2><p>주문번호 <b>${order.order_number}</b><br>입금 확인 후 상품 준비를 시작합니다.</p><button class="cta add" id="orderDone">확인</button>`; document.querySelector('.member-close').onclick = closeMember; document.getElementById('orderDone').onclick = closeMember;
      } catch (error) { document.getElementById('checkoutMessage').textContent = error.message; }
    };
    closePanels(); openMember();
  }

  document.getElementById('accountOpen').addEventListener('click', accountView); document.getElementById('checkout').addEventListener('click', checkoutView); track();
})();
