import React, { useState, useEffect } from 'react';

const API_URL = '';

export default function Home() {
  const [token, setToken] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeScreen, setActiveScreen] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [consumptionData, setConsumptionData] = useState([]);
  const [ordersData, setOrdersData] = useState([]);
  const [debtsData, setDebtsData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('أزازة');
  const [itemPrice, setItemPrice] = useState('');
  const [itemStock, setItemStock] = useState('');

  const [debtOld, setDebtOld] = useState('');
  const [debtNew, setDebtNew] = useState('');
  const [debtPayment, setDebtPayment] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('labToken');
    if (savedToken) {
      setToken(savedToken);
      loadAllData(savedToken);
    }
  }, []);

  async function apiRequest(method, endpoint, body = null, authToken = token) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_URL}/api${endpoint}`, options);
    if (res.status === 401) { logout(); return null; }
    return res.json();
  }

  async function loadAllData(authToken) {
    setLoading(true);
    const items = await apiRequest('GET', '/items', null, authToken) || [];
    const consumption = await apiRequest('GET', '/consumption', null, authToken) || [];
    const orders = await apiRequest('GET', '/orders', null, authToken) || [];
    const debts = await apiRequest('GET', '/debts', null, authToken) || [];
    setInventory(items);
    setConsumptionData(consumption);
    setOrdersData(orders);
    setDebtsData(debts);
    setLoading(false);
  }

  async function login() {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('labToken', data.token);
      setToken(data.token);
      setError('');
      loadAllData(data.token);
    } else {
      setError('❌ كلمة المرور غير صحيحة');
    }
  }

  function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      localStorage.removeItem('labToken');
      setToken(null);
      setPassword('');
    }
  }

  async function addItem() {
    if (!itemName) { alert('❌ أدخل اسم المستلزم'); return; }
    if (!itemPrice || parseFloat(itemPrice) <= 0) { alert('❌ أدخل سعر صحيح'); return; }
    await apiRequest('POST', '/items', {
      name: itemName,
      unit: itemUnit,
      price: parseFloat(itemPrice),
      stock: parseInt(itemStock) || 0
    });
    setItemName(''); setItemPrice(''); setItemStock('');
    const items = await apiRequest('GET', '/items') || [];
    setInventory(items);
  }

  async function deleteItem(id) {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await apiRequest('DELETE', `/items?id=${id}`);
    const items = await apiRequest('GET', '/items') || [];
    setInventory(items);
  }

  async function updateItemPrice(id, newPrice) {
    const item = inventory.find(i => i._id === id);
    if (item) {
      item.price = parseFloat(newPrice) || 0;
      await apiRequest('PUT', `/items?id=${id}`, item);
    }
  }

  async function updateItemStock(id, newStock) {
    const item = inventory.find(i => i._id === id);
    if (item) {
      item.stock = parseInt(newStock) || 0;
      await apiRequest('PUT', `/items?id=${id}`, item);
    }
  }

  async function updateConsumption(itemId, field, value) {
    let cons = consumptionData.find(c => c.itemId === itemId);
    if (!cons) cons = { itemId, daily: 0, weekly: 0, monthly: 0, need: 0, consumer: '' };

    if (field === 'daily') {
      const daily = parseFloat(value) || 0;
      cons.daily = daily;
      cons.weekly = daily * 7;
      cons.monthly = daily * 30;
      cons.need = Math.ceil(daily * 30 * 1.2);
    } else if (field === 'consumer') {
      cons.consumer = value;
    }

    await apiRequest('POST', '/consumption', cons);
    const consumption = await apiRequest('GET', '/consumption') || [];
    setConsumptionData(consumption);
  }

  async function updateOrderQuantity(itemId, quantity) {
    const item = inventory.find(i => i._id === itemId);
    const cons = getConsumption(itemId);
    if (!item || !cons) return;
    const qty = parseInt(quantity) || 0;
    await apiRequest('POST', '/orders', { itemId, quantity: qty, total: qty * item.price });
    const orders = await apiRequest('GET', '/orders') || [];
    setOrdersData(orders);
  }

  async function updateDebt() {
    const oldDebt = parseFloat(debtOld) || 0;
    const newOrder = parseFloat(debtNew) || 0;
    const payment = parseFloat(debtPayment) || 0;
    if (newOrder === 0 && payment === 0 && oldDebt === 0) { alert('❌ أدخل على الأقل قيمة واحدة'); return; }
    const remaining = oldDebt + newOrder - payment;
    const monthlyRate = remaining > 0 ? remaining / 12 : 0;
    const monthsLeft = monthlyRate > 0 && remaining > 0 ? (remaining / monthlyRate).toFixed(1) : (remaining > 0 ? '∞' : '0');
    await apiRequest('POST', '/debts', { old: oldDebt, newOrder, payment, remaining, monthlyRate, monthsLeft });
    const debts = await apiRequest('GET', '/debts') || [];
    setDebtsData(debts);
    const lastRemaining = debts.length > 0 ? debts[0].remaining : 0;
    setDebtOld(lastRemaining > 0 ? lastRemaining.toFixed(2) : '');
    setDebtNew('');
    setDebtPayment('');
  }

  function getConsumption(itemId) {
    return consumptionData.find(c => c.itemId === itemId) || { daily: 0, weekly: 0, monthly: 0, need: 0, consumer: '' };
  }

  function getRemaining(item) {
    const cons = getConsumption(item._id);
    return Math.max(0, (item.stock || 0) - cons.daily);
  }

  function getDailyCost(item) {
    const cons = getConsumption(item._id);
    return cons.daily * item.price;
  }

  function getOrder(itemId) {
    return ordersData.find(o => o.itemId === itemId);
  }

  function getDebtRemaining() {
    return debtsData.length > 0 ? debtsData[0].remaining : 0;
  }

  function getMonthlyRate() {
    const remaining = getDebtRemaining();
    return remaining > 0 ? remaining / 12 : 0;
  }

  function getMonthsLeft() {
    const remaining = getDebtRemaining();
    const monthlyRate = getMonthlyRate();
    if (monthlyRate > 0 && remaining > 0) return (remaining / monthlyRate).toFixed(1);
    return remaining > 0 ? '∞' : '0';
  }

  function updateConsumptionSummary() {
    let totalDaily = 0, totalMonthly = 0, totalDailyCost = 0;
    inventory.forEach(item => {
      const cons = getConsumption(item._id);
      totalDaily += cons.daily;
      totalMonthly += cons.monthly;
      totalDailyCost += getDailyCost(item);
    });
    return { totalItems: inventory.length, totalDaily, totalMonthly, totalDailyCost };
  }

  function updateOrderSummary() {
    let totalValue = 0, itemsCount = 0;
    ordersData.forEach(order => {
      if (order.quantity > 0) { totalValue += order.total; itemsCount++; }
    });
    return { itemsCount, totalValue };
  }

  function printOrder() {
    const date = new Date().toLocaleDateString('ar-EG');
    let itemsHtml = '';
    let totalOrder = 0;
    inventory.forEach((item, index) => {
      const order = getOrder(item._id);
      const qty = order ? order.quantity : 0;
      const cons = getConsumption(item._id);
      const consumerName = cons && cons.consumer ? cons.consumer : '-';
      if (qty > 0) {
        const total = qty * item.price;
        totalOrder += total;
        itemsHtml += `<tr><td>${index + 1}</td><td>${item.name}</td><td>${item.unit}</td><td>${consumerName}</td><td>${qty}</td><td>${item.price.toFixed(2)}</td><td>${total.toFixed(2)}</td></tr>`;
      }
    });
    if (!itemsHtml) { alert('لا يوجد أصناف في الطلبية للطباعة'); return; }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html dir="rtl"><head><title>طلبية مستلزمات المعمل</title><style>body { font-family: Arial; padding: 40px; } h1 { text-align: center; color: #333; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #333; padding: 10px; text-align: center; } th { background: #667eea; color: white; } .total { font-size: 1.3em; font-weight: bold; margin-top: 20px; text-align: left; } .date { text-align: left; margin-bottom: 20px; }</style></head><body><h1>🧪 طلبية مستلزمات المعمل</h1><div class="date">التاريخ: ${date}</div><table><thead><tr><th>#</th><th>اسم المستلزم</th><th>الوحدة</th><th>المستهلك</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="total">إجمالي الطلبية: ${totalOrder.toFixed(2)} ج.م</div></body></html>`);
    printWindow.document.close();
    printWindow.print();
  }

  function approveOrder() {
    const hasItems = ordersData.some(o => o.quantity > 0);
    if (!hasItems) { alert('❌ لا يوجد أصناف في الطلبية'); return; }
    alert('✅ تم اعتماد الطلبية بنجاح!');
  }

  const consSummary = updateConsumptionSummary();
  const orderSummary = updateOrderSummary();

  if (!token) {
    return (
      <div style={styles.loginScreen}>
        <div style={styles.loginCard}>
          <div style={styles.logo}>🧪</div>
          <h2>معدل استهلاك واحتياج المعمل</h2>
          <p style={styles.subtitle}>نظام إدارة المستلزمات والطلبيات والمديونية</p>
          {error && <div style={styles.alertDanger}>{error}</div>}
          <div style={styles.formGroup}>
            <label>🔒 كلمة المرور</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="أدخل كلمة المرور" style={styles.input} />
          </div>
          <button onClick={login} style={styles.btnPrimary}>🔓 تسجيل الدخول</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <button onClick={logout} style={styles.logoutBtn}>🚪 تسجيل الخروج</button>
      <div style={styles.userBadge}><span>👤</span><span>أدمن</span></div>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1>📋 معدل استهلاك واحتياج المعمل من الفلاش</h1>
          <p>نظام إدارة المستلزمات والطلبيات والمديونية</p>
        </div>
        <div style={styles.navTabs}>
          <button onClick={() => setActiveScreen(0)} style={activeScreen === 0 ? styles.navTabActive : styles.navTab}>📦 المخزون</button>
          <button onClick={() => setActiveScreen(1)} style={activeScreen === 1 ? styles.navTabActive : styles.navTab}>📊 الاستهلاك</button>
          <button onClick={() => setActiveScreen(2)} style={activeScreen === 2 ? styles.navTabActive : styles.navTab}>🛒 الطلبيات</button>
          <button onClick={() => setActiveScreen(3)} style={activeScreen === 3 ? styles.navTabActive : styles.navTab}>💰 المديونية</button>
        </div>

        {activeScreen === 0 && (
          <div style={styles.screen}>
            <h2 style={styles.screenTitle}>📦 شاشة المخزون</h2>
            <div style={styles.alertInfo}>💡 أضف المستلزمات مع نوع الوحدة وسعر الوحدة والكمية المخزنة. يمكنك تعديل سعر الوحدة والكمية مباشرة من الجدول.</div>
            <div style={styles.inputRow}>
              <div style={styles.formGroup}><label>اسم المستلزم</label><input type="text" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="مثال: فلاش USB 32GB" style={styles.input} /></div>
              <div style={styles.formGroup}><label>نوع الوحدة</label><select value={itemUnit} onChange={e => setItemUnit(e.target.value)} style={styles.input}><option value="أزازة">أزازة</option><option value="تيست">تيست</option><option value="كيس">كيس</option><option value="علبة">علبة</option><option value="قطعة">قطعة</option></select></div>
              <div style={styles.formGroup}><label>سعر الوحدة (جنيه)</label><input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="0.00" min="0" step="0.01" style={styles.input} /></div>
              <div style={styles.formGroup}><label>الكمية المخزنة</label><input type="number" value={itemStock} onChange={e => setItemStock(e.target.value)} placeholder="0" min="0" step="1" style={styles.input} /></div>
              <button onClick={addItem} style={styles.btnPrimary}>➕ إضافة</button>
            </div>
            {loading ? <div style={styles.loading}>⏳ جاري التحميل...</div> : (
              inventory.length === 0 ? <div style={styles.emptyState}><div style={{fontSize: '4em', marginBottom: '20px'}}>📭</div><h3>لا يوجد مستلزمات مسجلة</h3><p>أضف المستلزمات أولاً من الأعلى</p></div> : (
                <table style={styles.table}>
                  <thead><tr><th>#</th><th>اسم المستلزم</th><th>الوحدة</th><th>سعر الوحدة</th><th>الكمية المخزنة</th><th>إجراءات</th></tr></thead>
                  <tbody>
                    {inventory.map((item, index) => (
                      <tr key={item._id}>
                        <td>{index + 1}</td>
                        <td><strong>{item.name}</strong></td>
                        <td><span style={styles.badgeUnit}>{item.unit}</span></td>
                        <td><input type="number" defaultValue={item.price.toFixed(2)} min="0" step="0.01" style={styles.priceInput} onChange={e => updateItemPrice(item._id, e.target.value)} /></td>
                        <td><input type="number" defaultValue={item.stock || 0} min="0" step="1" style={styles.quantityInput} onChange={e => updateItemStock(item._id, e.target.value)} /> {item.unit}</td>
                        <td><button onClick={() => deleteItem(item._id)} style={styles.btnDangerSmall}>🗑️ حذف</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        )}

        {activeScreen === 1 && (
          <div style={styles.screen}>
            <h2 style={styles.screenTitle}>📊 شاشة معدل الاستهلاك</h2>
            <div style={styles.alertInfo}>💡 أدخل المستهلك والاستهلاك اليومي لكل صنف. يظهر المخزون والباقي (المخزون - الاستهلاك) تلقائياً.</div>
            <div style={styles.summaryCards}>
              <div style={styles.summaryCard}><h3>إجمالي الأصناف</h3><div style={styles.summaryValue}>{consSummary.totalItems}</div></div>
              <div style={styles.summaryCard}><h3>إجمالي الاستهلاك اليومي</h3><div style={styles.summaryValue}>{consSummary.totalDaily.toFixed(1)}</div></div>
              <div style={styles.summaryCard}><h3>إجمالي الاستهلاك الشهري</h3><div style={styles.summaryValue}>{consSummary.totalMonthly.toFixed(1)}</div></div>
              <div style={{...styles.summaryCard, background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)'}}><h3>💰 إجمالي التكلفة اليومية</h3><div style={styles.summaryValue}>{consSummary.totalDailyCost.toFixed(2)} ج.م</div></div>
            </div>
            {loading ? <div style={styles.loading}>⏳ جاري التحميل...</div> : (
              inventory.length === 0 ? <div style={styles.emptyState}><div style={{fontSize: '4em', marginBottom: '20px'}}>📭</div><h3>لا يوجد بيانات</h3><p>أضف المستلزمات في شاشة المخزون أولاً</p></div> : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead><tr><th>#</th><th>اسم المستلزم</th><th>الوحدة</th><th>المستهلك</th><th>المخزون</th><th>استهلاك يومي</th><th>استهلاك أسبوعي</th><th>استهلاك شهري</th><th>الباقي</th><th>تكلفة يومية</th><th>معدل الاحتياج</th></tr></thead>
                    <tbody>
                      {inventory.map((item, index) => {
                        const cons = getConsumption(item._id);
                        const remaining = getRemaining(item);
                        const dailyCost = getDailyCost(item);
                        let rc = styles.remainingSafe;
                        if (remaining === 0) rc = styles.remainingDanger;
                        else if (remaining < cons.need) rc = styles.remainingWarning;
                        return (
                          <tr key={item._id}>
                            <td>{index + 1}</td>
                            <td><strong>{item.name}</strong></td>
                            <td><span style={styles.badgeUnit}>{item.unit}</span></td>
                            <td><input type="text" defaultValue={cons.consumer || ''} style={styles.consumerInput} onChange={e => updateConsumption(item._id, 'consumer', e.target.value)} placeholder="اسم المستهلك" /></td>
                            <td><strong>{item.stock || 0}</strong> {item.unit}</td>
                            <td><input type="number" defaultValue={cons.daily > 0 ? cons.daily : ''} min="0" step="0.1" style={styles.quantityInput} onChange={e => updateConsumption(item._id, 'daily', e.target.value)} placeholder="0" /></td>
                            <td><strong>{cons.weekly.toFixed(1)}</strong></td>
                            <td><strong>{cons.monthly.toFixed(1)}</strong></td>
                            <td style={rc}>{remaining.toFixed(1)} {item.unit}</td>
                            <td style={styles.dailyCost}>{dailyCost.toFixed(2)} ج.م</td>
                            <td style={{color: '#e74c3c', fontWeight: 'bold'}}>{cons.need} {item.unit}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {activeScreen === 2 && (
          <div style={styles.screen}>
            <h2 style={styles.screenTitle}>🛒 شاشة الطلبيات</h2>
            <div style={styles.alertInfo}>💡 الطلبية تُحسب تلقائياً من معدل الاحتياج الشهري. الإجمالي يُحسب تلقائياً. يمكنك تعديل الكمية المطلوبة يدوياً.</div>
            <div style={styles.summaryCards}>
              <div style={styles.summaryCard}><h3>عدد الأصناف المطلوبة</h3><div style={styles.summaryValue}>{orderSummary.itemsCount}</div></div>
              <div style={styles.summaryCard}><h3>إجمالي قيمة الطلبية</h3><div style={styles.summaryValue}>{orderSummary.totalValue.toFixed(2)} ج.م</div></div>
            </div>
            <div style={{textAlign: 'left', marginBottom: '20px'}}>
              <button onClick={printOrder} style={styles.printBtn}>🖨️ طباعة الطلبية</button>
              <button onClick={approveOrder} style={styles.btnSuccess}>✅ اعتماد الطلبية</button>
            </div>
            {loading ? <div style={styles.loading}>⏳ جاري التحميل...</div> : (
              inventory.length === 0 ? <div style={styles.emptyState}><div style={{fontSize: '4em', marginBottom: '20px'}}>📭</div><h3>لا يوجد بيانات للطلب</h3><p>أكمل بيانات الاستهلاك في الشاشة السابقة أولاً</p></div> : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead><tr><th>#</th><th>اسم المستلزم</th><th>الوحدة</th><th>المستهلك</th><th>الباقي</th><th>معدل الاحتياج</th><th>الكمية المطلوبة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
                    <tbody>
                      {inventory.map((item, index) => {
                        const cons = getConsumption(item._id);
                        const suggestedQty = cons ? cons.need : 0;
                        const existingOrder = getOrder(item._id);
                        const currentQty = existingOrder ? existingOrder.quantity : suggestedQty;
                        const total = currentQty * item.price;
                        const consumerName = cons && cons.consumer ? cons.consumer : '-';
                        const remaining = getRemaining(item);
                        return (
                          <tr key={item._id}>
                            <td>{index + 1}</td>
                            <td><strong>{item.name}</strong></td>
                            <td><span style={styles.badgeUnit}>{item.unit}</span></td>
                            <td>{consumerName}</td>
                            <td style={styles.remainingSafe}>{remaining.toFixed(1)} {item.unit}</td>
                            <td style={{color: '#e74c3c', fontWeight: 'bold'}}>{suggestedQty} {item.unit}</td>
                            <td><input type="number" defaultValue={currentQty > 0 ? currentQty : ''} min="0" step="1" style={styles.quantityInput} onChange={e => updateOrderQuantity(item._id, e.target.value)} /></td>
                            <td>{item.price.toFixed(2)} ج.م</td>
                            <td style={styles.totalPrice}>{total.toFixed(2)} ج.م</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {activeScreen === 3 && (
          <div style={styles.screen}>
            <h2 style={styles.screenTitle}>💰 شاشة المديونية</h2>
            <div style={styles.debtCompanyName}>🏢 شركة بيور</div>
            <div style={styles.alertInfo}>💡 أدخل المديونية القديمة (أول مرة فقط)، والطلبية الواردة، والسداد. المديونية القديمة تُكتب تلقائياً من المبلغ الباقي السابق.</div>
            <div style={styles.summaryCards}>
              <div style={styles.summaryCard}><h3>المديونية القديمة</h3><div style={styles.summaryValue}>{(debtsData.length > 0 ? debtsData[0].old : 0).toFixed(2)} ج.م</div></div>
              <div style={styles.summaryCard}><h3>الطلبية الواردة</h3><div style={styles.summaryValue}>{(debtsData.length > 0 ? debtsData[0].newOrder : 0).toFixed(2)} ج.م</div></div>
              <div style={styles.summaryCard}><h3>السداد</h3><div style={styles.summaryValue}>{(debtsData.length > 0 ? debtsData[0].payment : 0).toFixed(2)} ج.م</div></div>
              <div style={{...styles.summaryCard, background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'}}><h3>💰 المبلغ الباقي</h3><div style={styles.summaryValue}>{getDebtRemaining().toFixed(2)} ج.م</div></div>
              <div style={{...styles.summaryCard, background: 'linear-gradient(135deg, #27ae60 0%, #219a52 100%)'}}><h3>📅 معدل السداد الشهري</h3><div style={styles.summaryValue}>{getMonthlyRate().toFixed(2)} ج.م</div></div>
              <div style={{...styles.summaryCard, background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)'}}><h3>⏳ الأشهر المتبقية</h3><div style={styles.summaryValue}>{getMonthsLeft()} شهر</div></div>
            </div>
            <div style={styles.debtInputRow}>
              <div style={styles.formGroup}><label>المديونية القديمة</label><input type="number" value={debtOld} onChange={e => setDebtOld(e.target.value)} placeholder="0.00" min="0" step="0.01" style={styles.input} /></div>
              <div style={styles.formGroup}><label>الطلبية الواردة</label><input type="number" value={debtNew} onChange={e => setDebtNew(e.target.value)} placeholder="0.00" min="0" step="0.01" style={styles.input} /></div>
              <div style={styles.formGroup}><label>السداد</label><input type="number" value={debtPayment} onChange={e => setDebtPayment(e.target.value)} placeholder="0.00" min="0" step="0.01" style={styles.input} /></div>
              <button onClick={updateDebt} style={styles.btnPrimary}>💾 حفظ</button>
            </div>
            {loading ? <div style={styles.loading}>⏳ جاري التحميل...</div> : (
              debtsData.length === 0 ? <div style={styles.emptyState}><div style={{fontSize: '4em', marginBottom: '20px'}}>📭</div><h3>لا يوجد سجل مديونية</h3><p>أضف بيانات المديونية أولاً من الأعلى</p></div> : (
                <div style={styles.tableWrapper}>
                  <h3 style={{marginBottom: '15px', color: '#333'}}>📜 سجل المديونية</h3>
                  <table style={styles.table}>
                    <thead><tr><th>#</th><th>التاريخ</th><th>المديونية القديمة</th><th>الطلبية الواردة</th><th>السداد</th><th>المبلغ الباقي</th></tr></thead>
                    <tbody>
                      {debtsData.map((record, index) => {
                        const date = new Date(record.date).toLocaleDateString('ar-EG');
                        return (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{date}</td>
                            <td>{record.old.toFixed(2)} ج.م</td>
                            <td>{record.newOrder.toFixed(2)} ج.م</td>
                            <td>{record.payment.toFixed(2)} ج.م</td>
                            <td style={styles.debtRemaining}>{record.remaining.toFixed(2)} ج.م</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  loginScreen: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  loginCard: { background: 'white', borderRadius: '25px', padding: '50px 40px', width: '100%', maxWidth: '450px', boxShadow: '0 25px 80px rgba(0,0,0,0.3)', textAlign: 'center' },
  logo: { fontSize: '4em', marginBottom: '10px' },
  subtitle: { color: '#888', marginBottom: '30px' },
  alertDanger: { padding: '15px', borderRadius: '10px', marginBottom: '20px', background: '#ffebee', color: '#c62828', borderRight: '4px solid #c62828' },
  formGroup: { marginBottom: '20px', textAlign: 'right' },
  input: { width: '100%', padding: '12px 15px', border: '2px solid #e0e0e0', borderRadius: '10px', fontSize: '1em' },
  btnPrimary: { padding: '12px 25px', border: 'none', borderRadius: '10px', fontSize: '1em', fontWeight: 'bold', cursor: 'pointer', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' },
  appContainer: { minHeight: '100vh', padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  logoutBtn: { position: 'fixed', top: '20px', left: '20px', zIndex: 1000, padding: '10px 20px', fontSize: '0.9em', background: 'transparent', border: '2px solid white', color: 'white', borderRadius: '10px', cursor: 'pointer' },
  userBadge: { position: 'fixed', top: '20px', right: '20px', zIndex: 1000, background: 'white', color: '#667eea', padding: '10px 20px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 5px 20px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '8px' },
  container: { maxWidth: '1400px', margin: '0 auto' },
  header: { textAlign: 'center', color: 'white', marginBottom: '30px', padding: '20px' },
  navTabs: { display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' },
  navTab: { padding: '15px 25px', border: 'none', borderRadius: '50px', fontSize: '1em', fontWeight: 'bold', cursor: 'pointer', background: 'rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(10px)' },
  navTabActive: { padding: '15px 25px', border: 'none', borderRadius: '50px', fontSize: '1em', fontWeight: 'bold', cursor: 'pointer', background: 'white', color: '#667eea', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
  screen: { background: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  screenTitle: { fontSize: '1.8em', color: '#333', marginBottom: '25px', textAlign: 'center', paddingBottom: '15px', borderBottom: '3px solid #667eea' },
  alertInfo: { padding: '15px', borderRadius: '10px', marginBottom: '20px', background: '#e3f2fd', color: '#1565c0', borderRight: '4px solid #1565c0' },
  inputRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', marginBottom: '20px', padding: '20px', background: '#f8f9ff', borderRadius: '15px' },
  debtInputRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', marginBottom: '20px', padding: '20px', background: '#f8f9ff', borderRadius: '15px' },
  summaryCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' },
  summaryCard: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', borderRadius: '15px', textAlign: 'center' },
  summaryValue: { fontSize: '1.8em', fontWeight: 'bold' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' },
  badgeUnit: { padding: '5px 12px', borderRadius: '20px', fontSize: '0.85em', fontWeight: 'bold', background: '#e3f2fd', color: '#1976d2' },
  emptyState: { textAlign: 'center', padding: '60px 20px', color: '#999' },
  loading: { textAlign: 'center', padding: '20px', color: '#667eea' },
  tableWrapper: { overflowX: 'auto' },
  btnDangerSmall: { padding: '5px 15px', fontSize: '0.85em', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' },
  printBtn: { padding: '12px 25px', background: '#34495e', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', marginBottom: '20px', marginRight: '10px' },
  btnSuccess: { padding: '12px 25px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', marginBottom: '20px' },
  priceInput: { width: '90px', padding: '8px', border: '2px solid #e0e0e0', borderRadius: '8px', textAlign: 'center' },
  quantityInput: { width: '70px', padding: '8px', border: '2px solid #e0e0e0', borderRadius: '8px', textAlign: 'center' },
  consumerInput: { width: '120px', padding: '8px', border: '2px solid #e0e0e0', borderRadius: '8px', textAlign: 'center' },
  totalPrice: { fontSize: '1.3em', fontWeight: 'bold', color: '#27ae60' },
  dailyCost: { color: '#e67e22', fontWeight: 'bold' },
  remainingSafe: { color: '#27ae60', fontWeight: 'bold', fontSize: '1.1em' },
  remainingWarning: { color: '#f39c12', fontWeight: 'bold', fontSize: '1.1em' },
  remainingDanger: { color: '#e74c3c', fontWeight: 'bold', fontSize: '1.1em' },
  debtRemaining: { color: '#e74c3c', fontWeight: 'bold', fontSize: '1.1em' },
  debtCompanyName: { fontSize: '1.5em', color: '#667eea', textAlign: 'center', marginBottom: '20px', fontWeight: 'bold' }
};
