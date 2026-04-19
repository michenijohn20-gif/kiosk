const supabaseUrl = "https://sgysjdrbsdniaxztbury.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneXNqZHJic2RuaWF4enRidXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzYxMzMsImV4cCI6MjA5MjAxMjEzM30.7RygricljOX-i9AkgOGpAqSBZNjuPjhGx5NpXJXh9Qo";

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let cart = [];
let allProducts = [];
let allCategories = [];
let lastSale = null; // Store for receipt
let salesChart = null;
// ================= FETCH PRODUCTS =================
async function fetchData() {
  const loading = document.getElementById("loading-state");
  
  try {
    // Fetch products and categories separately to avoid relationship errors
    const [prodRes, catRes] = await Promise.all([
      _supabase.from("products").select("*"),
      _supabase.from("categories").select("*").order("name") // Added order for consistency
    ]);

    if (prodRes.error) throw prodRes.error;
    if (catRes.error) throw catRes.error;

    allCategories = catRes.data || [];
    localStorage.setItem('allCategories', JSON.stringify(allCategories)); // Save to localStorage

    // Manually join the data in JavaScript
    allProducts = (prodRes.data || []).map(p => ({
      ...p,
      categories: allCategories.find(c => String(c.id) === String(p.category_id))
    }));
    localStorage.setItem('allProducts', JSON.stringify(allProducts)); // Save to localStorage

    renderCategoryPills();
    renderCards(allProducts);
  } catch (err) {
    console.error("Supabase Fetch Error:", err);
    if (loading) {
      let helpText = "Ensure the 'products' table has a 'category_id' column.";
      if (err.message && err.message.includes("schema cache")) {
        helpText = "Database schema mismatch. Try 'Reload PostgREST' in Supabase API settings.";
      }
      
      // Attempt to load from localStorage if fetch fails
      const cachedProducts = localStorage.getItem('allProducts');
      const cachedCategories = localStorage.getItem('allCategories');

      if (cachedProducts && cachedCategories) {
        allProducts = JSON.parse(cachedProducts);
        allCategories = JSON.parse(cachedCategories);
        showNotification("Offline: Loaded products from cache.", "info");
        renderCategoryPills();
        renderCards(allProducts);
      } else {
        // If no cached data, show original error
        loading.innerHTML = `
          <div class="alert alert-danger mx-auto" style="max-width: 400px;">
            <strong>Load Failed:</strong> ${err.message}<br>
            <small>${helpText}</small>
          </div>`;
      }
    }
  }
}

// ================= CATEGORY PILLS =================
function renderCategoryPills() {
  const container = document.getElementById("category-pills");
  if (!container) return;

  container.innerHTML = `<button class="btn btn-sm btn-outline-primary active" onclick="filterByCategory('all', this)">All</button>` + 
    allCategories.map(c => ` 
      <button class="btn btn-sm btn-outline-primary" data-category="${c.name}" onclick="filterByCategory(this.dataset.category, this)">${c.name}</button>
    `).join("");
}

function filterByCategory(category, btn) {
  const buttons = document.querySelectorAll("#category-pills button");
  buttons.forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (category === "all") {
    renderCards(allProducts);
  } else {
    const filtered = allProducts.filter(p => p.categories?.name === category);
    renderCards(filtered);
  }
}

// ================= SEARCH =================
let searchTimeout;

function handleSearch() {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const q = (document.getElementById("searchInput").value || "").toLowerCase().trim();

    const filtered = allProducts.filter((p) =>
      p.name.toLowerCase().includes(q),
    );

    renderCards(filtered);
  }, 150);
}

function startVoiceSearch() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'en-US';
  showNotification("Listening...", "info");
  
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    document.getElementById('searchInput').value = text;
    handleSearch();
    showNotification(`Searching for: ${text}`, "success");
  };

  recognition.onerror = () => showNotification("Voice search failed", "danger");
  recognition.start();
}

// ================= RENDER PRODUCTS =================
function renderCards(products) {
  const grid = document.getElementById("inventory-grid");
  const loading = document.getElementById("loading-state");
  if (loading) loading.remove();

  const grouped = {};

  products.forEach((p) => { // Ensure products are sorted by name before grouping
    // Access nested category name from the join
    const category = p.categories?.name || "Uncategorized";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(p);
  });

  grid.innerHTML = Object.keys(grouped)
    .sort() // Sort categories alphabetically
    .map( 
      (cat) => `
    <div class="col-12 mt-2" id="section-${cat.replace(/\s+/g, '')}">
      <h5 class="text-primary">${cat}</h5>
    </div>

    ${grouped[cat].map((product) => `
      <div class="col-6">
        <div class="card shadow-sm border-0">
          <div class="card-body text-center p-2">
            <h6 class="mb-1 text-truncate" title="${product.name}">${product.name}</h6>
            <div class="mb-1">
              ${product.stock <= 0 
                ? '<span class="badge bg-danger">Out of stock</span>' 
                : product.stock < 5 
                ? '<span class="badge bg-warning text-dark">Few in stock</span>' 
                : '<span class="badge bg-success">In stock</span>'}
            </div>
            <p class="fw-bold text-primary mb-2">${product.price} KES</p>
            <div class="d-flex justify-content-center align-items-center gap-2 mb-2">
              <button data-action="qty-minus" class="btn btn-sm btn-outline-secondary">-</button>
              <span class="fw-bold qty-display">1</span>
              <button data-action="qty-plus" class="btn btn-sm btn-outline-secondary">+</button>
            </div>
            <button class="btn btn-primary btn-sm w-100"
              data-action="add-to-cart" data-id="${product.id}">
              Add
            </button>
          </div>
        </div>
      </div>
    `).join("")}`).join("");

  document.getElementById("total-items-count").innerText =
    `${products.length} Products`;
}
// ================= QTY ================= 
function changeQty(btn, val) {
  const qtyDisplay = btn.parentElement.querySelector(".qty-display");
  if (!qtyDisplay) return;
  let currentQty = parseInt(qtyDisplay.innerText);
  currentQty += val;
  if (currentQty < 1) currentQty = 1;
  qtyDisplay.innerText = currentQty;
}

// ================= NOTIFICATIONS =================
function showNotification(message, type = "info") {
  const existing = document.querySelector(".custom-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `custom-toast alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3 shadow-lg`;
  toast.style.zIndex = "1060";
  toast.style.minWidth = "250px";
  toast.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ================= ADD TO CART =================
function addToCart(btn, productId) { // Changed to accept productId directly
  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;

  const qtySpan = btn.closest(".card-body")?.querySelector(".qty-display");
  if (!qtySpan) return;
  const qty = parseInt(qtySpan.innerText); // Get quantity from the specific card

  if (product.stock <= 0) {
    showNotification("This item is currently out of stock!");
    return;
  }

  if (qty > product.stock) {
    showNotification(`Only ${product.stock} items left in stock!`);
    return;
  }

  const id = String(product.id);
  const existing = cart.find((i) => String(i.id) === id);

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ ...product, id, qty: qty });
  }

  qtySpan.innerText = "1"; // Reset quantity display after adding
  updateCartUI();
  showNotification(`${product.name} added to cart!`, "success");
}

// ================= REMOVE =================
function removeFromCart(id) {
  id = String(id);

  const item = cart.find((p) => String(p.id) === id);
  if (!item) return;

  item.qty--;

  if (item.qty <= 0) {
    cart = cart.filter((p) => String(p.id) !== id);
  }

  updateCartUI();
}

// ================= CART UI =================
function updateCartUI() {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  document.getElementById("cart-total-price").innerText =
    total.toLocaleString();

  document.getElementById("cart-summary").innerText = `${count} items`;
  document.getElementById("cart-badge").innerText = count;

  // Update Quick Bottom Bar
  const quickBarTotal = document.getElementById("quick-total-price");
  if (quickBarTotal) quickBarTotal.innerText = total.toLocaleString();

  const quickBar = document.getElementById("quick-checkout-bar"); // This bar is now permanent
  if (quickBar) { 
    document.body.style.paddingBottom = "80px"; // Ensure padding is always there
  }

  renderCartItems();
}


// ================= CART RENDER =================
function renderCartItems() {
  const list = document.getElementById("cart-list");

  if (cart.length === 0) {
    list.innerHTML = `<li class="list-group-item text-muted">Cart empty</li>`;
    return;
  }

  list.innerHTML = cart
    .map(
      (item) => `
    <li class="list-group-item d-flex justify-content-between align-items-center">

      <div>
        <b>${item.name}</b><br>
        <small>${item.price} x ${item.qty}</small>
      </div>

      <div>
        <b>${item.price * item.qty} KES</b>
        <button class="btn btn-sm btn-danger ms-2"
          onclick="removeFromCart('${item.id}')">−</button>
      </div>

    </li>
  `,
    )
    .join("");
}

// ================= CLEAR =================
function clearCart() {
  cart = [];
  updateCartUI();
}

// ================= CHECKOUT =================
async function checkout() {
  if (cart.length === 0) return;

  // Check which payment selector to use (Offcanvas or Quick Bar)
  const isOffcanvasOpen = document.getElementById('cartOffcanvas').classList.contains('show');
  const selector = isOffcanvasOpen ? 'input[name="payment"]:checked' : 'input[name="payment-quick"]:checked';
  
  const payment = document.querySelector(selector).value;

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  if (!confirm(`Sell ${totalItems} items via ${payment}?`)) return;

  for (const item of cart) {
    await _supabase
      .from("products")
      .update({ stock: item.stock - item.qty })
      .eq("id", item.id);

    await _supabase.from("sales").insert([
      {
        product_id: item.id,
        amount_paid: item.price * item.qty,
        payment_method: payment,
      },
    ]);
  }

  // Store data for the receipt before clearing
  lastSale = {
    items: [...cart],
    total: cart.reduce((s, i) => s + i.price * i.qty, 0),
    payment: payment
  };

  // Close the offcanvas on success
  const cartPanel = document.getElementById('cartOffcanvas');
  const bsOffcanvas = bootstrap.Offcanvas.getInstance(cartPanel);
  if (bsOffcanvas) bsOffcanvas.hide();

  showReceiptPopup();
  clearCart();
  fetchData();
}

function showReceiptPopup() {
  document.getElementById("receipt-details").innerText = 
    `${lastSale.total.toLocaleString()} KES paid via ${lastSale.payment}`;
  
  const modal = new bootstrap.Modal(document.getElementById('receiptModal'));
  modal.show();
}

function shareToWhatsApp() {
  if (!lastSale) return;

  let message = `*--- RECEIPT ---*%0A`;
  lastSale.items.forEach(item => {
    message += `${item.name} x${item.qty} = ${item.price * item.qty} KES%0A`;
  });
  message += `--------------------%0A`;
  message += `*TOTAL: ${lastSale.total.toLocaleString()} KES*%0A`;
  message += `Payment: ${lastSale.payment}%0A`;
  message += `_Thank you for shopping with us!_`;

  const url = `https://wa.me/?text=${message}`;
  window.open(url, '_blank');
}

// ================= RANKING =================
async function getTopSellingItems() {
  const { data: sales, error } = await _supabase
    .from("sales")
    .select("product_id");

  if (error) {
    console.error("Error fetching sales ranking:", error);
    return [];
  }

  const counts = (sales || []).reduce((acc, sale) => {
    acc[sale.product_id] = (acc[sale.product_id] || 0) + 1;
    return acc;
  }, {});

  // Map through ALL products to include items with 0 sales
  return allProducts.map(p => ({
    name: p.name,
    count: counts[p.id] || 0
  })).sort((a, b) => b.count - a.count);
}

// ================= SUMMARY (NEW & IMPROVED) =================
async function showSummary() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const localISO = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString();

    const { data: sales, error } = await _supabase
      .from("sales")
      .select("*")
      .gte("created_at", localISO);

    if (error) throw error;

    const safeSales = sales || [];

    let cash = 0;
    let mpesa = 0;
    let total = 0;

    safeSales.forEach((s) => {
      const amt = Number(s.amount_paid || 0);
      total += amt;

      if (s.payment_method === "Cash") cash += amt;
      if (s.payment_method === "M-Pesa") mpesa += amt;
    });

    document.getElementById("stat-cash").innerText = cash.toLocaleString();
    document.getElementById("stat-mpesa").innerText = mpesa.toLocaleString();
    document.getElementById("stat-total").innerText = total.toLocaleString();
    document.getElementById("stat-count").innerText =
      `${safeSales.length} sales`;

    const { data: lowStock } = await _supabase
      .from("products")
      .select("*")
      .lt("stock", 5);

    const list = document.getElementById("low-stock-list");

    list.innerHTML = (lowStock || []).length
      ? lowStock
          .map(
            (p) => `
          <li class="list-group-item d-flex justify-content-between">
            ${p.name}
            <span class="badge bg-danger">${p.stock}</span>
          </li>
        `,
          )
          .join("")
      : `<li class="list-group-item">All stock OK</li>`;

    // SHOW MODAL
    const inventoryModal = bootstrap.Modal.getInstance(document.getElementById("inventoryModal"));
    if (inventoryModal) inventoryModal.hide();

    const modalEl = document.getElementById("summaryModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } catch (err) {
    console.error("SUMMARY ERROR DETAILS:", err);
    alert("Failed to load summary: " + (err.message || JSON.stringify(err)));
  }
}

// ================= DEEP ANALYSIS =================
async function showDetailedSummary() {
  try {
    // Get last 30 days of data for better statistics
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const { data: sales, error } = await _supabase
      .from("sales")
      .select("*")
      .gte("created_at", monthAgo.toISOString());

    if (error) throw error;

    const safeSales = sales || [];

    // 1. Calculate Average Transaction Value (ATV)
    const totalRevenue = safeSales.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
    const avgSale = safeSales.length ? (totalRevenue / safeSales.length) : 0;
    document.getElementById("det-avg-sale").innerText = Math.round(avgSale).toLocaleString() + " KES";

    // 2. Calculate Peak Hour
    const hourCounts = (safeSales || []).reduce((acc, s) => {
      const hr = new Date(s.created_at).getHours();
      acc[hr] = (acc[hr] || 0) + 1;
      return acc;
    }, {});
    let peakHour = 0, maxCount = -1;
    for (const hr in hourCounts) {
      if (hourCounts[hr] > maxCount) { peakHour = hr; maxCount = hourCounts[hr]; }
    }
    document.getElementById("det-peak-hour").innerText = `${peakHour}:00`;

    // 3. Total Items Sold (Volume)
    document.getElementById("det-total-qty").innerText = safeSales.length;

    // Hide the basic summary modal first
    const summaryModal = bootstrap.Modal.getInstance(document.getElementById("summaryModal"));
    if (summaryModal) summaryModal.hide();

    // 4. Rankings (Best & Worst)
    const rankings = await getTopSellingItems();
    
    const topList = document.getElementById("top-sellers-list");
    if (topList) {
      const topItems = rankings.filter(i => i.count > 0).slice(0, 5);
      topList.innerHTML = topItems.length
        ? topItems.map(item => `
          <li class="list-group-item d-flex justify-content-between py-1 px-2 border-0">
            <small>${item.name}</small>
            <span class="badge bg-success rounded-pill">${item.count}</span>
          </li>
        `).join("")
        : `<li class="list-group-item text-muted border-0">No data</li>`;
    }

    const worstList = document.getElementById("worst-sellers-list");
    if (worstList) {
      const slowItems = [...rankings].reverse().slice(0, 5);
      worstList.innerHTML = slowItems.map(item => `
        <li class="list-group-item d-flex justify-content-between py-1 px-2 border-0">
          <small>${item.name}</small>
          <span class="badge bg-light text-dark border rounded-pill">${item.count}</span>
        </li>
      `).join("");
    }

    // 4. Trend Chart (Last 7 Days)
    renderTrendChart(safeSales);

    // Show Modal
    const detailModalEl = document.getElementById("detailedSummaryModal");
    const detailModal = bootstrap.Modal.getOrCreateInstance(detailModalEl);
    detailModal.show();
  } catch (err) {
    console.error("DEEP SUMMARY ERROR:", err);
    showNotification("Failed to load detailed report", "danger");
  }
}

function renderTrendChart(salesData) {
  const ctx = document.getElementById('salesTrendChart').getContext('2d');
  
  // Group sales by day
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const dailyTotals = last7Days.map(date => {
    return salesData
      .filter(s => new Date(s.created_at).toLocaleDateString('en-CA') === date)
      .reduce((sum, s) => sum + Number(s.amount_paid), 0);
  });

  if (salesChart) salesChart.destroy();

  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last7Days.map(d => d.split('-').slice(1).join('/')), // MM/DD format
      datasets: [{
        label: 'Daily Revenue (KES)',
        data: dailyTotals,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13, 110, 253, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

// ================= INVENTORY MANAGEMENT =================
async function openInventoryManager() {
  renderFullInventoryList();
  renderInventoryList();
  renderPriceList();
  renderSalesLog();
  // Suggestions Mapping
  window.categoryPresets = {
    "sodas": ["Coca-Cola", "Fanta", "Sprite", "Pepsi", "Krest", "Stoney"],
    "soda": ["Coca-Cola", "Fanta", "Sprite", "Pepsi", "Krest", "Stoney"],
    "juices": ["Minute Maid", "Del Monte", "Pick N Peel", "Ceres", "Afia"],
    "juice": ["Minute Maid", "Del Monte", "Pick N Peel", "Ceres", "Afia"],
    "water": ["Dasani", "Keringet", "Aquafina", "Quench"]
  };

  // Close summary if open
  const summaryModal = bootstrap.Modal.getInstance(document.getElementById("summaryModal"));
  if (summaryModal) summaryModal.hide(); // Close summary if open
  
  const select = document.getElementById("new-p-cat-select");
  if (select) {
    // If categories are empty, try to fetch them again to ensure we aren't stuck
    if (allCategories.length === 0) {
      select.innerHTML = `<option value="" disabled selected>Fetching categories...</option>`;
      const { data, error } = await _supabase.from("categories").select("id, name");
      
      if (error) {
        console.error("Manual Category Fetch Error:", error);
        select.innerHTML = `<option value="" disabled selected>Error: ${error.message}</option>`;
        return;
      }

      if (data && data.length > 0) {
        allCategories = data;
      }
    }

    // Update dropdown content based on current data
    if (allCategories.length === 0) {
      select.innerHTML = `<option value="" disabled selected>No categories found (Check RLS Policies)</option>`;
    } else {
      select.innerHTML = `
        <option value="" disabled selected>Choose a category...</option>
        ${allCategories.map(c => 
          `<option value="${c.id}">${c.name}</option>`
        ).join("")}
      `;
    }
    updateQuickSuggestions();
  }

  const modalEl = document.getElementById("inventoryModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function renderSalesLog() {
  const list = document.getElementById("sales-log-list");
  if (!list) return;

  list.innerHTML = `<tr><td colspan="4" class="text-center py-3">Fetching records...</td></tr>`;

  const { data: sales, error } = await _supabase
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    list.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Error loading logs</td></tr>`;
    return;
  }

  list.innerHTML = (sales || []).map(sale => {
    const product = allProducts.find(p => String(p.id) === String(sale.product_id));
    const date = new Date(sale.created_at);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

    return `
      <tr>
        <td><small>${dateStr}, ${timeStr}</small></td>
        <td><small class="fw-bold">${product ? product.name : 'Unknown Item'}</small></td>
        <td class="text-end"><small>${Number(sale.amount_paid).toLocaleString()} KES</small></td>
        <td><small class="badge bg-light text-dark border">${sale.payment_method}</small></td>
      </tr>
    `;
  }).join("");
}

function updateQuickSuggestions() {
  const select = document.getElementById("new-p-cat-select");
  const container = document.getElementById("quick-suggestions");
  const selectedText = select.options[select.selectedIndex]?.text?.toLowerCase().trim();
  
  const presets = window.categoryPresets[selectedText] || [];
  
  container.innerHTML = presets.map(brand => ` 
    <button type="button" class="btn btn-xs btn-outline-secondary" style="font-size: 0.7rem; padding: 2px 8px;" 
      data-brand="${brand}">${brand}</button>
  `).join("");
}

function applySuggestion(brand) {
  const nameInput = document.getElementById("new-p-name");
  nameInput.value = brand + " ";
  nameInput.focus();
}

function renderFullInventoryList() {
  const q = (document.getElementById("viewSearchInput")?.value || "").toLowerCase().trim();
  const list = document.getElementById("inventory-view-list");
  
  const filtered = allProducts.filter(p => p.name.toLowerCase().includes(q));

  list.innerHTML = filtered.map(p => {
    const stockClass = p.stock <= 0 ? 'text-danger fw-bold' : p.stock < 5 ? 'text-warning fw-bold' : '';
    return `
      <tr>
        <td><small class="fw-bold">${p.name}</small></td>
        <td><small class="text-muted">${p.categories?.name || 'N/A'}</small></td>
        <td class="text-end"><small>${p.price.toLocaleString()}</small></td>
        <td class="text-center ${stockClass}"><small>${p.stock}</small></td>
      </tr>
    `;
  }).join("");
}

function renderInventoryList() {
  const q = (document.getElementById("inventorySearchInput")?.value || "").toLowerCase().trim();
  const list = document.getElementById("inventory-management-list");
  
  const filtered = allProducts.filter(p => p.name.toLowerCase().includes(q));

  list.innerHTML = filtered.map(p => `
    <div class="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
      <div style="flex: 1;">
        <h6 class="mb-0 text-truncate" style="max-width: 150px;">${p.name}</h6>
        <small class="text-muted">Current Stock: <b>${p.stock}</b></small>
      </div>
      <div class="text-end">
        <div class="btn-group btn-group-sm mb-1">
          <button class="btn btn-outline-success" data-action="quick-stock" data-id="${p.id}" data-amount="1">+1</button>
          <button class="btn btn-outline-success" data-action="quick-stock" data-id="${p.id}" data-amount="6">+6</button>
          <button class="btn btn-outline-success" data-action="quick-stock" data-id="${p.id}" data-amount="12">+12</button>
        </div>
        <div class="d-flex gap-1">
          <input type="number" class="form-control form-control-sm" id="stock-input-${p.id}" value="0" onfocus="this.select()">
          <button class="btn btn-sm btn-success" onclick="saveStockUpdate('${p.id}', 'stock-input-${p.id}')">Add</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function quickStock(id, amount) {
  const product = allProducts.find(p => String(p.id) === String(id));
  if (!product) return;
  
  const newStock = product.stock + amount;
  const { error } = await _supabase.from("products").update({ stock: newStock }).eq("id", id);
  
  if (!error) {
    showNotification(`Added ${amount} to ${product.name}`, "success");
    await fetchData();
    renderInventoryList();
    renderFullInventoryList();
  }
}

async function saveStockUpdate(id, inputId) {
  const input = document.getElementById(inputId);
  const addAmount = parseInt(input.value);

  if (isNaN(addAmount) || addAmount === 0) {
    showNotification("Please enter a quantity to add or subtract", "warning");
    return;
  }

  const product = allProducts.find(p => String(p.id) === String(id));
  if (!product) return;

  const newStock = product.stock + addAmount;

  const { error } = await _supabase.from("products").update({ stock: newStock }).eq("id", id);

  if (error) {
    showNotification("Error updating database", "danger");
  } else {
    showNotification("Stock updated successfully!", "success");
    await fetchData(); // Refresh global products and main UI
    renderInventoryList(); // Refresh the list in the modal
  }
}

function renderPriceList() {
  const q = (document.getElementById("priceSearchInput")?.value || "").toLowerCase().trim();
  const list = document.getElementById("price-management-list");
  
  const filtered = allProducts.filter(p => p.name.toLowerCase().includes(q));

  list.innerHTML = filtered.map(p => `
    <div class="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
      <div style="flex: 1;">
        <h6 class="mb-0">${p.name}</h6>
        <small class="text-muted">Current Price: <b>${p.price} KES</b></small>
      </div>
      <div class="d-flex gap-2" style="width: 180px;"> 
        <input type="number" class="form-control form-control-sm" id="price-input-${p.id}" value="${p.price}">
        <button class="btn btn-sm btn-primary" onclick="savePriceUpdate('${p.id}', 'price-input-${p.id}')">Update</button>
      </div>
    </div>
  `).join("");
}

async function savePriceUpdate(id, inputId) {
  const input = document.getElementById(inputId);
  const newPrice = parseFloat(input.value);

  if (isNaN(newPrice) || newPrice < 0) {
    showNotification("Please enter a valid price", "warning");
    return;
  }

  const { error } = await _supabase.from("products").update({ price: newPrice }).eq("id", id);

  if (error) {
    showNotification("Error updating price", "danger");
  } else {
    showNotification("Price updated successfully!", "success");
    await fetchData(); // Refresh global products and main UI
    renderPriceList(); // Refresh the list in the modal
    renderInventoryList(); // Keep both lists in sync
  }
}

async function addNewProduct() {
  const name = document.getElementById("new-p-name").value.trim();
  const category_id = document.getElementById("new-p-cat-select").value;
  const price = parseFloat(document.getElementById("new-p-price").value);
  const stock = parseInt(document.getElementById("new-p-stock").value);

  if (!name || !category_id || isNaN(price) || isNaN(stock)) {
    showNotification("Please fill in all fields correctly", "warning");
    return;
  }

  const { error } = await _supabase.from("products").insert([
    { name, category_id, price, stock }
  ]).select();

  if (error) {
    console.error("Supabase Insert Error:", error);
    showNotification(`Error: ${error.message}`, "danger");
  } else {
    showNotification(`${name} added successfully!`, "success");
    
    // Speed optimization: Only clear the Name and focus back
    document.getElementById("new-p-name").value = "";
    document.getElementById("new-p-name").focus();
    
    const manageTabTrigger = document.querySelector('#manage-tab');
    bootstrap.Tab.getOrCreateInstance(manageTabTrigger).show();
    
    // Refresh main data and modal list
    await fetchData();
    renderInventoryList();
  }
}
function notifyIfNoInternet() {
  if (!navigator.onLine) {
    showNotification("You are currently offline. Some features may not work.", "warning");
  }
  return;
}

window.addEventListener('load', notifyIfNoInternet);
window.addEventListener('offline', () => showNotification("You lost internet connection!", "danger"));
window.addEventListener('online', () => showNotification("Back online! Data will sync now.", "success"));


// ================= THEME TOGGLE =================
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute("data-bs-theme") || "light";
  const newTheme = currentTheme === "light" ? "dark" : "light";
  
  html.setAttribute("data-bs-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("themeToggle");
  if (btn) btn.innerText = theme === "dark" ? "☀️" : "🌙";
}

// ================= INIT =================
fetchData();
updateCartUI();

// Initialize Theme
const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-bs-theme", savedTheme);
updateThemeIcon(savedTheme);
// Register the Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered!', reg))
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}