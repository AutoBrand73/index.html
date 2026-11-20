var currentUser = null;
var currentProfile = null;
var isRegisterMode = false;
var cart = new Array();

function sbHeaders(token) {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + (token || SUPABASE_KEY),
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
}

function openAuthModal() {
    var m = document.getElementById('auth-modal');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function closeAuthModal() {
    var m = document.getElementById('auth-modal');
    m.classList.add('hidden');
    m.classList.remove('flex');
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').textContent = isRegisterMode ? 'Регистрация покупателя' : 'Вход в личный кабинет';
    document.getElementById('auth-submit-btn').textContent = isRegisterMode ? 'Зарегистрироваться' : 'Войти';
    document.getElementById('auth-switch-btn').textContent = isRegisterMode ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
    document.getElementById('reg-fields').className = isRegisterMode ? 'space-y-3' : 'hidden';
}

function handleAuth(e) {
    e.preventDefault();
    var emailVal = document.getElementById('auth-email').value.trim();
    var passVal = document.getElementById('auth-pass').value;
    var endpoint = isRegisterMode ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';

    fetch(SUPABASE_URL + endpoint, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({ email: emailVal, password: passVal })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.error || data.error_description || data.msg) {
            alert('Ошибка: ' + (data.error_description || data.msg || data.error));
            return;
        }
        var u = data.user || (data.session && data.session.user);
        var tok = data.access_token || (data.session && data.session.access_token);
        if (!u) {
            alert('Проверьте почту для подтверждения!');
            return;
        }
        currentUser = { uid: u.id, mail: u.email, token: tok };
        localStorage.setItem('ad_user', JSON.stringify(currentUser));

        if (isRegisterMode) {
            var nameVal = document.getElementById('auth-name').value || emailVal;
            var phoneVal = document.getElementById('auth-phone').value || '';
            var vinVal = document.getElementById('auth-vin').value.toUpperCase() || '';
            fetch(SUPABASE_URL + '/rest/v1/profiles', {
                method: 'POST',
                headers: sbHeaders(tok),
                body: JSON.stringify({ id: u.id, email: emailVal, full_name: nameVal, phone: phoneVal, vin: vinVal, role: 'user' })
            }).then(function() {
                loadProfile();
                closeAuthModal();
            });
        } else {
            loadProfile();
            closeAuthModal();
        }
    });
}

function loadProfile() {
    if (!currentUser) return;
    fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + currentUser.uid + '&select=*', {
        headers: sbHeaders(currentUser.token)
    })
    .then(function(r) { return r.json(); })
    .then(function(rows) {
        currentProfile = (rows && rows.length > 0) ? rows : { email: currentUser.mail, role: 'user' };
        updateNavUI();
    });
}

function updateNavUI() {
    var loggedIn = Boolean(currentUser);
    document.getElementById('nav-auth').classList.toggle('hidden', loggedIn);
    document.getElementById('nav-logout').classList.toggle('hidden', !loggedIn);
    document.getElementById('nav-cabinet').classList.toggle('hidden', !loggedIn);
    var isAdmin = currentProfile && currentProfile.role === 'admin';
    document.getElementById('nav-admin').classList.toggle('hidden', !isAdmin);

    if (currentProfile) {
        if (currentProfile.full_name) document.getElementById('ord-name').value = currentProfile.full_name;
        if (currentProfile.phone) document.getElementById('ord-phone').value = currentProfile.phone;
        if (currentProfile.vin) document.getElementById('ord-vin').value = currentProfile.vin;
    }
}

function logoutUser() {
    currentUser = null;
    currentProfile = null;
    localStorage.removeItem('ad_user');
    updateNavUI();
    showPage('shop');
}

function showPage(page) {
    document.getElementById('page-shop').classList.toggle('hidden', page !== 'shop');
    document.getElementById('page-cabinet').classList.toggle('hidden', page !== 'cabinet');
    document.getElementById('page-admin').classList.toggle('hidden', page !== 'admin');
    if (page === 'cabinet') loadUserOrders();
    if (page === 'admin') switchAdminTab('orders');
}
function handleSearch(e) {
    e.preventDefault();
    var q = document.getElementById('search-input').value.trim();
    if (!q) return;
    var box = document.getElementById('offers-list');
    var loader = document.getElementById('loader');
    box.innerHTML = '';
    loader.classList.remove('hidden');

    fetch('/api/search?q=' + encodeURIComponent(q))
    .then(function(r) { return r.json(); })
    .then(function(data) {
        loader.classList.add('hidden');
        if (!data.ok) {
            box.innerHTML = '<div class="bg-red-50 text-red-700 p-4 rounded-xl">' + (data.error || 'Ошибка поиска') + '</div>';
            return;
        }
        if (!data.items || data.items.length === 0) {
            box.innerHTML = '<div class="bg-white p-6 rounded-xl border text-center">По артикулу <b>' + q + '</b> ничего не найдено.</div>';
            return;
        }
        for (var i = 0; i < data.items.length; i++) {
            var p = data.items[i];
            var div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-xl border flex flex-wrap justify-between items-center gap-4';
            div.innerHTML = '<div><div class="font-bold">' + p.brand + ' <span class="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">' + p.art + '</span></div>' +
                '<div class="text-sm text-slate-700">' + p.name + '</div>' +
                '<div class="text-xs text-slate-500 mt-1">Срок: <b>' + p.days + '</b> • Остаток: <b>' + p.stock + ' шт.</b></div></div>' +
                '<div class="flex items-center gap-4"><div class="text-xl font-bold">' + p.price + ' ₽</div>' +
                '<button type="button" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">В корзину</button></div>';
            (function(item) {
                div.querySelector('button').onclick = function() { addToCart(item); };
            })(p);
            box.appendChild(div);
        }
    })
    .catch(function(err) {
        loader.classList.add('hidden');
        box.innerHTML = '<div class="text-red-600">Ошибка сети: ' + err.message + '</div>';
    });
}

function addToCart(item) {
    var found = cart.find(function(c) { return c.art === item.art && c.price === item.price; });
    if (found) found.qty += 1;
    else cart.push({ brand: item.brand, art: item.art, name: item.name, price: item.price, qty: 1 });
    updateCartUI();
    alert('Добавлено в корзину: ' + item.brand + ' ' + item.art);
}

function updateCartUI() {
    var qty = 0, sum = 0;
    var box = document.getElementById('cart-items');
    box.innerHTML = '';
    for (var i = 0; i < cart.length; i++) {
        qty += cart[i].qty;
        sum += cart[i].price * cart[i].qty;
        var row = document.createElement('div');
        row.className = 'border rounded-lg p-3 flex justify-between items-center text-sm';
        row.innerHTML = '<div><b>' + cart[i].brand + ' ' + cart[i].art + '</b><br>' + cart[i].qty + ' шт. × ' + cart[i].price + ' ₽</div>' +
            '<button type="button" class="text-red-500 font-bold px-2">✕</button>';
        (function(idx) {
            row.querySelector('button').onclick = function() { cart.splice(idx, 1); updateCartUI(); };
        })(i);
        box.appendChild(row);
    }
    document.getElementById('cart-badge').textContent = qty;
    document.getElementById('cart-total').textContent = sum + ' ₽';
    document.getElementById('checkout-form').classList.toggle('hidden', cart.length === 0);
}

function toggleCart() {
    var d = document.getElementById('cart-drawer');
    d.classList.toggle('hidden');
    d.classList.toggle('flex');
}

function submitCartOrder(e) {
    e.preventDefault();
    var sum = 0, lines = new Array();
    for (var i = 0; i < cart.length; i++) {
        sum += cart[i].price * cart[i].qty;
        lines.push(cart[i].brand + ' ' + cart[i].art + ' (' + cart[i].qty + ' шт. × ' + cart[i].price + ' ₽)');
    }
    var payload = {
        user_id: currentUser ? currentUser.uid : null,
        customer_name: document.getElementById('ord-name').value,
        customer_phone: document.getElementById('ord-phone').value,
        vin: document.getElementById('ord-vin').value.toUpperCase(),
        items: lines.join('; '),
        total_price: sum,
        status: 'Новый'
    };
    fetch(SUPABASE_URL + '/rest/v1/orders', {
        method: 'POST',
        headers: sbHeaders(currentUser && currentUser.token),
        body: JSON.stringify(payload)
    }).then(function(r) {
        if (r.ok) {
            cart = new Array();
            updateCartUI();
            toggleCart();
            alert('Заказ оформлен!');
        }
    });
}

function openVinModal() { var m = document.getElementById('vin-modal'); m.classList.remove('hidden'); m.classList.add('flex'); }
function closeVinModal() { var m = document.getElementById('vin-modal'); m.classList.add('hidden'); m.classList.remove('flex'); }

function submitVinOrder(e) {
    e.preventDefault();
    var payload = {
        user_id: currentUser ? currentUser.uid : null,
        customer_name: document.getElementById('vin-name').value,
        customer_phone: document.getElementById('vin-phone').value,
        vin: document.getElementById('vin-code').value.toUpperCase(),
        items: 'ПОДБОР ПО VIN: ' + document.getElementById('vin-parts').value,
        total_price: 0,
        status: 'Запрос по VIN'
    };
    fetch(SUPABASE_URL + '/rest/v1/orders', {
        method: 'POST',
        headers: sbHeaders(currentUser && currentUser.token),
        body: JSON.stringify(payload)
    }).then(function(r) {
        if (r.ok) {
            closeVinModal();
            e.target.reset();
            alert('Запрос по VIN отправлен!');
        }
    });
}

function loadUserOrders() {
    if (!currentUser) return;
    document.getElementById('cabinet-user-info').textContent = 'Аккаунт: ' + currentUser.mail;
    var box = document.getElementById('user-orders-list');
    box.innerHTML = 'Загрузка...';
    fetch(SUPABASE_URL + '/rest/v1/orders?user_id=eq.' + currentUser.uid + '&order=id.desc', {
        headers: sbHeaders(currentUser.token)
    })
    .then(function(r) { return r.json(); })
    .then(function(orders) {
        if (!orders || orders.length === 0) { box.innerHTML = '<p class="text-slate-500">У вас пока нет заказов.</p>'; return; }
        box.innerHTML = '';
        for (var i = 0; i < orders.length; i++) {
            var o = orders[i];
            var div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-xl border';
            div.innerHTML = '<div class="flex justify-between font-bold mb-1"><span>Заказ №' + o['id'] + '</span><span class="text-blue-600">' + o['status'] + '</span></div>' +
                '<div class="text-sm text-slate-700">' + o['items'] + '</div>' +
                '<div class="text-sm font-bold mt-2">Сумма: ' + o['total_price'] + ' ₽</div>';
            box.appendChild(div);
        }
    });
}

function switchAdminTab(tab) {
    var tabs = new Array('orders', 'suppliers', 'markups');
    for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        document.getElementById('admin-tab-' + t).classList.toggle('hidden', t !== tab);
        document.getElementById('tab-btn-' + t).className = (t === tab)
            ? 'px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white'
            : 'px-4 py-2 rounded-lg text-sm font-bold bg-white border';
    }
    if (tab === 'orders') loadAdminOrders();
    if (tab === 'suppliers') loadAdminSuppliers();
    if (tab === 'markups') loadAdminMarkups();
}

function loadAdminOrders() {
    var box = document.getElementById('admin-tab-orders');
    box.innerHTML = 'Загрузка заказов...';
    fetch(SUPABASE_URL + '/rest/v1/orders?order=id.desc', { headers: sbHeaders(currentUser.token) })
    .then(function(r) { return r.json(); })
    .then(function(orders) {
        box.innerHTML = '';
        for (var i = 0; i < orders.length; i++) {
            var o = orders[i];
            var div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-xl border flex flex-wrap justify-between items-center gap-4';
            div.innerHTML = '<div><div class="font-bold">Заказ №' + o['id'] + ' • ' + o['customer_name'] + ' (' + o['customer_phone'] + ')</div>' +
                '<div class="text-xs text-slate-500">VIN: ' + (o['vin'] || 'не указан') + '</div>' +
                '<div class="text-sm mt-1">' + o['items'] + '</div>' +
                '<div class="font-bold text-blue-700 mt-1">Итого: ' + o['total_price'] + ' ₽</div></div>' +
                '<select class="border rounded-lg px-3 py-2 text-sm font-semibold">' +
                '<option ' + (o['status'] === 'Новый' ? 'selected' : '') + '>Новый</option>' +
                '<option ' + (o['status'] === 'Запрос по VIN' ? 'selected' : '') + '>Запрос по VIN</option>' +
                '<option ' + (o['status'] === 'Заказано у поставщика' ? 'selected' : '') + '>Заказано у поставщика</option>' +
                '<option ' + (o['status'] === 'Готов к выдаче' ? 'selected' : '') + '>Готов к выдаче</option>' +
                '<option ' + (o['status'] === 'Выдан' ? 'selected' : '') + '>Выдан</option></select>';
            (function(orderId) {
                div.querySelector('select').onchange = function(ev) {
                    fetch(SUPABASE_URL + '/rest/v1/orders?id=eq.' + orderId, {
                        method: 'PATCH',
                        headers: sbHeaders(currentUser.token),
                        body: JSON.stringify({ status: ev.target.value })
                    });
                };
            })(o['id']);
            box.appendChild(div);
        }
    });
}

function loadAdminSuppliers() {
    var box = document.getElementById('admin-suppliers-list');
    fetch(SUPABASE_URL + '/rest/v1/suppliers?order=id.asc', { headers: sbHeaders(currentUser.token) })
    .then(function(r) { return r.json(); })
    .then(function(list) {
