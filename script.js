const supabaseUrl = "https://sgysjdrbsdniaxztbury.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneXNqZHJic2RuaWF4enRidXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzYxMzMsImV4cCI6MjA5MjAxMjEzM30.7RygricljOX-i9AkgOGpAqSBZNjuPjhGx5NpXJXh9Qo";

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let cart = [];
let allProducts = [];
let allCategories = [];
let lastSale = null;
let salesChart = null;

// ================= FETCH PRODUCTS =================

// Load from cache instantly — app is usable in under 1 second
function loadFromCache() {
  const cachedProducts = localStorage.getItem("allProducts"); //
  const cachedCategories = localStorage.getItem("allCategories"); //
  if (cachedProducts && cachedCategories) {
    allProducts = JSON.parse(cachedProducts); //
    allCategories = JSON.parse(cachedCategories); //
    applyBestSellerSorting(); // Apply sorting to cached products
    renderCategoryPills(); //
    renderCards(allProducts); //
    return true;
  }
  return false;
}

// Race Supabase against a 6 second timeout — don't wait forever
function fetchWithTimeout(promise, ms = 6000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
  return Promise.race([promise, timeout]);
}

async function fetchData() {
  // 1. Show cache IMMEDIATELY — no spinner, no waiting
  const hadCache = loadFromCache();

  // 2. Then sync fresh data from Supabase in the background
  try {
    const [prodRes, catRes] = await fetchWithTimeout(
      Promise.all([
        _supabase.from("products").select("*"),
        _supabase.from("categories").select("*").order("name"),
      ])
    );

    if (prodRes.error) throw prodRes.error;
    if (catRes.error) throw catRes.error;

    allCategories = catRes.data || [];
    localStorage.setItem("allCategories", JSON.stringify(allCategories));

    allProducts = (prodRes.data || []).map((p) => ({
      ...p,
      categories: allCategories.find(
        (c) => String(c.id) === String(p.category_id),
      ),
    }));
    localStorage.setItem("allProducts", JSON.stringify(allProducts));

    // Fetch sales data for best-seller sorting
    const { data: salesData, error: salesError } = await fetchWithTimeout(_supabase.from("sales").select("product_id"));
    if (!salesError) {
      localStorage.setItem("allSales", JSON.stringify(salesData));
    } else {
      console.warn("Could not fetch fresh sales data. Attempting to load from cache.", salesError);
    }

    // Apply best seller sorting using available sales data (fresh or cached)
    applyBestSellerSorting();

    // Update UI with fresh server data
    renderCategoryPills();
    renderCards(allProducts);
    hideSplashScreen();

  } catch (err) {
    if (hadCache) {
      // Cache already showing — quiet notification only
      showNotification("Offline: Showing cached products.", "info");
      hideSplashScreen();
    } else {
      // First ever launch with no internet
      showNotification("Failed to load products. Please check your internet connection.", "danger");
      hideSplashScreen();
    }
  }
}

// ================= CATEGORY PILLS =================
function renderCategoryPills() {
  const container = document.getElementById("category-pills");
  if (!container) return;

  container.innerHTML =
    `<button class="btn btn-sm btn-outline-primary active" onclick="filterByCategory('all', this)">All</button>` +
    allCategories
      .map(
        (c) => `
      <button class="btn btn-sm btn-outline-primary" data-category="${c.name}" onclick="filterByCategory(this.dataset.category, this)">${c.name}</button>
    `,
      )
      .join("");
}

function filterByCategory(category, btn) {
  const buttons = document.querySelectorAll("#category-pills button");
  buttons.forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (category === "all") {
    renderCards(allProducts);
  } else {
    const filtered = allProducts.filter((p) => p.categories?.name === category);
    renderCards(filtered);
  }
}

// ================= SEARCH =================
let searchTimeout;

function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = (document.getElementById("searchInput").value || "")
      .toLowerCase()
      .trim();
    const filtered = allProducts.filter((p) =>
      p.name.toLowerCase().includes(q),
    );
    renderCards(filtered);
  }, 150);
}

function startVoiceSearch() {
  const recognition = new (
    window.SpeechRecognition || window.webkitSpeechRecognition
  )();
  recognition.lang = "en-US";
  showNotification("Listening...", "info");

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    document.getElementById("searchInput").value = text;
    handleSearch();
    showNotification(`Searching for: ${text}`, "success");
  };

  recognition.onerror = () => showNotification("Voice search failed", "danger");
  recognition.start();
}

// ================= RENDER PRODUCTS =================
function renderCards(products) {
  const grid = document.getElementById("inventory-grid");

  const grouped = {};

  products.forEach((p) => {
    const category = p.categories?.name || "Uncategorized";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(p);
  });

  grid.innerHTML = Object.keys(grouped)
    .sort()
    .map(
      (cat) => `
    <div class="col-12 mt-2" id="section-${cat.replace(/\s+/g, "")}">
      <h5 class="text-primary">${cat}</h5>
    </div>
    ${grouped[cat]
      .map(
        (product) => `
      <div class="col-6">
        <div class="card shadow-sm border-0">
          <div class="card-body text-center p-2">
            <h6 class="mb-1 text-truncate" title="${product.name}">${product.name}</h6>
            <div class="mb-1">
              ${
                product.stock <= 0
                  ? '<span class="badge bg-danger">Out of stock</span>'
                  : product.stock < 5
                    ? '<span class="badge bg-warning text-dark">Few in stock</span>'
                    : '<span class="badge bg-success">In stock</span>'
              }
            </div>
            <p class="fw-bold text-primary mb-2">${product.price} KES</p>
            <div class="d-flex justify-content-center align-items-center gap-2 mb-2">
              <button data-action="qty-minus" data-id="${product.id}" class="btn btn-sm btn-outline-secondary">-</button>
              <span class="fw-bold qty-display">1</span>
              <button data-action="qty-plus" data-id="${product.id}" class="btn btn-sm btn-outline-secondary">+</button>
            </div>
            <button class="btn btn-primary btn-sm w-100"
              data-action="add-to-cart" data-id="${product.id}">
              Add
            </button>
          </div>
        </div>
      </div>
    `,
      )
      .join("")}`,
    )
    .join("");

  document.getElementById("total-items-count").innerText =
    `${products.length} Products`;
}
// ================= QTY =================
function changeQty(btn, val, productId) {
  const qtyDisplay = btn.parentElement.querySelector(".qty-display");
  if (!qtyDisplay) return;

  const product = allProducts.find((p) => String(p.id) === String(productId));
  let currentQty = parseInt(qtyDisplay.innerText);
  
  // Check for stock limit
  if (val > 0 && product && currentQty >= product.stock) {
    showNotification(`Only ${product.stock} items in stock!`, "warning");
    //disable the plus button if stock limit reached
    const plusBtn = btn.parentElement.querySelector('button[data-action="qty-plus"]');
    if (plusBtn) plusBtn.disabled = true;
    return;

  } else if (val < 0) {
    //enable the plus button if user is reducing quantity
    const plusBtn = btn.parentElement.querySelector('button[data-action="qty-plus"]');
    if (plusBtn) plusBtn.disabled = false;
  }

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
  setTimeout(() => toast.remove(), 3000);
}

// ================= SPLASH SCREEN =================
function hideSplashScreen() {
  const splashScreen = document.getElementById("splash-screen");
  if (splashScreen) {
    splashScreen.classList.add("fade-out");
    // Remove the element from the DOM after the transition completes
    setTimeout(() => splashScreen.remove(), 500); // Match CSS transition duration
  }
}

// ================= ADD TO CART =================
function addToCart(btn, productId) {
  const product = allProducts.find((p) => String(p.id) === String(productId));
  if (!product) return;

  const qtySpan = btn.closest(".card-body")?.querySelector(".qty-display");
  if (!qtySpan) return;
  const qty = parseInt(qtySpan.innerText);

  if (product.stock <= 0) {
    showNotification("This item is currently out of stock!");
    return;
  }

  if (qty > product.stock) {
    showNotification(`Only ${product.stock} of ${product.name} are in stock!`);
    return;
  }

  if (qty <= 0) {
    showNotification(`Please select a valid quantity for ${product.name}`);
    return;
  }

  const id = String(product.id);
  const existing = cart.find((i) => String(i.id) === id);

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ ...product, id, qty: qty });
  }

  qtySpan.innerText = "1";
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

  document.getElementById("cart-total-price").innerText = total.toLocaleString();
  document.getElementById("cart-summary").innerText = `${count} items`;
  document.getElementById("cart-badge").innerText = count;

  const quickBarTotal = document.getElementById("quick-total-price");
  if (quickBarTotal) quickBarTotal.innerText = total.toLocaleString();

  const quickBar = document.getElementById("quick-checkout-bar");
  if (quickBar) document.body.style.paddingBottom = "80px";

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

// ================= BEST SELLER SORTING =================
function applyBestSellerSorting() {
  let salesToConsider = [];
  try {
    salesToConsider = JSON.parse(localStorage.getItem("allSales") || "[]");
  } catch (e) {
    console.error("Error parsing cached sales data for sorting:", e);
  }

  const salesCounts = salesToConsider.reduce((acc, sale) => {
    acc[sale.product_id] = (acc[sale.product_id] || 0) + 1;
    return acc;
  }, {});

  allProducts.sort((a, b) => {
    const salesA = salesCounts[a.id] || 0;
    const salesB = salesCounts[b.id] || 0;
    return salesB - salesA || a.name.localeCompare(b.name); // Sort by sales (desc), then name (asc)
  });
}

// ================= OFFLINE QUEUE =================
function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem("offlineSalesQueue") || "[]");
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue) {
  localStorage.setItem("offlineSalesQueue", JSON.stringify(queue));
}

function addToOfflineQueue(saleData) {
  const queue = getOfflineQueue();
  queue.push({ ...saleData, queuedAt: new Date().toISOString() });
  saveOfflineQueue(queue);
}

async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  showNotification(`Syncing ${queue.length} offline sale(s)...`, "info");

  const failed = [];

  for (const sale of queue) {
    try {
      const { error } = await _supabase.rpc("process_checkout", {
        cart_items: sale.items.map((i) => ({
          id: i.id,
          qty: i.qty,
          price: i.price,
        })),
        p_payment_method: sale.payment,
      });
      if (error) throw error;
    } catch (err) {
      console.error("Failed to sync queued sale:", err);
      failed.push(sale);
    }
  }

  saveOfflineQueue(failed);

  if (failed.length === 0) {
    showNotification("All offline sales synced successfully!", "success");
    fetchData();
  } else {
    showNotification(
      `${failed.length} sale(s) failed to sync. Will retry later.`,
      "warning",
    );
  }
}

function applyStockLocally(cartItems) {
  cartItems.forEach((cartItem) => {
    const product = allProducts.find(
      (p) => String(p.id) === String(cartItem.id),
    );
    if (product) product.stock -= cartItem.qty;
  });
  localStorage.setItem("allProducts", JSON.stringify(allProducts));
}

// ================= CHECKOUT =================
function checkout() {
  if (cart.length === 0) return;
  const modal = bootstrap.Modal.getOrCreateInstance(
    document.getElementById("confirmSaleModal"),
  );
  modal.show();
}

async function completeSale() {
  const confirmModal = bootstrap.Modal.getInstance(
    document.getElementById("confirmSaleModal"),
  );
  if (confirmModal) confirmModal.hide();

  const isOffcanvasOpen = document
    .getElementById("cartOffcanvas")
    .classList.contains("show");
  const selector = isOffcanvasOpen
    ? 'input[name="payment"]:checked'
    : 'input[name="payment-quick"]:checked';
  const payment = document.querySelector(selector)?.value || "Cash";

  lastSale = {
    items: [...cart],
    total: cart.reduce((s, i) => s + i.price * i.qty, 0),
    payment: payment,
  };

  if (!navigator.onLine) {
    addToOfflineQueue({ items: [...cart], payment });
    applyStockLocally(cart);
    showNotification("Offline: Sale saved and will sync when back online.", "warning");
    finalizeSale();
    return;
  }

  try {
    const { error } = await _supabase.rpc("process_checkout", {
      cart_items: cart.map((i) => ({ id: i.id, qty: i.qty, price: i.price })),
      p_payment_method: payment,
    });
    if (error) throw error;
    finalizeSale();
    fetchData();
  } catch (err) {
    showNotification("Sale failed. Saving locally...", "warning");
    addToOfflineQueue({ items: [...cart], payment });
    applyStockLocally(cart);
    finalizeSale();
  }
}

function finalizeSale() {
  const bsOffcanvas = bootstrap.Offcanvas.getInstance(
    document.getElementById("cartOffcanvas"),
  );
  if (bsOffcanvas) bsOffcanvas.hide();
  showReceiptPopup();
  clearCart();
  renderCards(allProducts);
}

function showReceiptPopup() {
  document.getElementById("receipt-details").innerText =
    `${lastSale.total.toLocaleString()} KES paid via ${lastSale.payment}`;
  const modal = new bootstrap.Modal(document.getElementById("receiptModal"));
  modal.show();
}

function shareToWhatsApp() {
  if (!lastSale) return;

  let message = `*--- RECEIPT ---*%0A`;
  lastSale.items.forEach((item) => {
    message += `${item.name} x${item.qty} = ${item.price * item.qty} KES%0A`;
  });
  message += `--------------------%0A`;
  message += `*TOTAL: ${lastSale.total.toLocaleString()} KES*%0A`;
  message += `Payment: ${lastSale.payment}%0A`;
  message += `_Thank you for shopping with us!_`;

  const url = `https://wa.me/?text=${message}`;
  window.open(url, "_blank");
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

  return allProducts
    .map((p) => ({
      name: p.name,
      count: counts[p.id] || 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ================= SUMMARY =================
async function showSummary() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Midnight local time

    const { data: sales, error } = await _supabase
      .from("sales")
      .select("*")
      .gte("created_at", today.toISOString()); // Database uses UTC, so we query relative to local midnight

    if (error) throw error;

    const safeSales = sales || [];
    let cash = 0, mpesa = 0, total = 0;

    safeSales.forEach((s) => {
      const amt = Number(s.amount_paid || 0);
      total += amt;
      if (s.payment_method === "Cash") cash += amt;
      if (s.payment_method === "M-Pesa") mpesa += amt;
    });

    document.getElementById("stat-cash").innerText = cash.toLocaleString();
    document.getElementById("stat-mpesa").innerText = mpesa.toLocaleString();
    document.getElementById("stat-total").innerText = total.toLocaleString();
    document.getElementById("stat-count").innerText = `${safeSales.length} sales`;

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

    const inventoryModal = bootstrap.Modal.getInstance(
      document.getElementById("inventoryModal"),
    );
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
    const monthAgo = new Date();
    monthAgo.setHours(0, 0, 0, 0);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const { data: sales, error } = await _supabase
      .from("sales")
      .select("*")
      .gte("created_at", monthAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    const safeSales = sales || [];

    const totalRevenue = safeSales.reduce(
      (sum, s) => sum + Number(s.amount_paid || 0), 0,
    );
    const avgSale = safeSales.length ? totalRevenue / safeSales.length : 0;
    document.getElementById("det-avg-sale").innerText =
      Math.round(avgSale).toLocaleString() + " KES";

    const hourCounts = safeSales.reduce((acc, s) => {
      const hr = new Date(s.created_at).getHours();
      acc[hr] = (acc[hr] || 0) + 1;
      return acc;
    }, {});
    let peakHour = 0, maxCount = -1;
    for (const hr in hourCounts) {
      if (hourCounts[hr] > maxCount) { peakHour = hr; maxCount = hourCounts[hr]; }
    }
    document.getElementById("det-peak-hour").innerText = `${peakHour}:00`;
    document.getElementById("det-total-qty").innerText = safeSales.length;

    const summaryModal = bootstrap.Modal.getInstance(
      document.getElementById("summaryModal"),
    );
    if (summaryModal) summaryModal.hide();

    const rankings = await getTopSellingItems();

    const topList = document.getElementById("top-sellers-list");
    if (topList) {
      const topItems = rankings.filter((i) => i.count > 0).slice(0, 5);
      topList.innerHTML = topItems.length
        ? topItems.map((item) => `
          <li class="list-group-item d-flex justify-content-between py-1 px-2 border-0">
            <small>${item.name}</small>
            <span class="badge bg-success rounded-pill">${item.count}</span>
          </li>`).join("")
        : `<li class="list-group-item text-muted border-0">No data</li>`;
    }

    const worstList = document.getElementById("worst-sellers-list");
    if (worstList) {
      const slowItems = [...rankings].reverse().slice(0, 5);
      worstList.innerHTML = slowItems.map((item) => `
        <li class="list-group-item d-flex justify-content-between py-1 px-2 border-0">
          <small>${item.name}</small>
          <span class="badge bg-light text-dark border rounded-pill">${item.count}</span>
        </li>`).join("");
    }

    renderTrendChart(safeSales);

    // Render transactions log for deep analysis
    const deepLog = document.getElementById("deep-sales-log");
    if (deepLog) {
      deepLog.innerHTML = safeSales.length 
        ? safeSales.slice(0, 50).map(sale => {
            const product = allProducts.find(p => String(p.id) === String(sale.product_id));
            const date = new Date(sale.created_at);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            return `
              <tr>
                <td><small class="text-muted">${dateStr}, ${timeStr}</small></td>
                <td><small class="fw-bold">${product ? product.name : 'Unknown Item'}</small></td>
                <td class="text-end"><small>${Number(sale.amount_paid).toLocaleString()} KES</small></td>
              </tr>`;
          }).join("")
        : `<tr><td colspan="3" class="text-center text-muted py-3">No transactions found in the last 30 days</td></tr>`;
    }

    const detailModal = bootstrap.Modal.getOrCreateInstance(
      document.getElementById("detailedSummaryModal")
    );
    detailModal.show();
  } catch (err) {
    console.error("DEEP SUMMARY ERROR:", err);
    showNotification("Failed to load detailed report", "danger");
  }
}

function renderTrendChart(salesData) {
  const ctx = document.getElementById("salesTrendChart").getContext("2d");

  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString("en-CA"); // Gets YYYY-MM-DD in local (Nairobi) time
  }).reverse();

  const dailyTotals = last7Days.map((date) =>
    salesData
      .filter((s) => new Date(s.created_at).toLocaleDateString("en-CA") === date) // Filter using local date strings
      .reduce((sum, s) => sum + Number(s.amount_paid), 0)
  );

  if (salesChart) salesChart.destroy();

  salesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: last7Days.map((d) => d.split("-").slice(1).join("/")),
      datasets: [{
        label: "Daily Revenue (KES)",
        data: dailyTotals,
        borderColor: "#0d6efd",
        backgroundColor: "rgba(13, 110, 253, 0.1)",
        fill: true,
        tension: 0.4,
      }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

// ================= INVENTORY MANAGEMENT =================
async function openInventoryManager() {
  renderFullInventoryList();
  renderInventoryList();
  renderPriceList();
  renderSalesLog();

  window.categoryPresets = {
    sodas: ["Coca-Cola", "Fanta", "Sprite", "Pepsi", "Krest", "Stoney"],
    soda: ["Coca-Cola", "Fanta", "Sprite", "Pepsi", "Krest", "Stoney"],
    juices: ["Minute Maid", "Del Monte", "Pick N Peel", "Ceres", "Afia"],
    juice: ["Minute Maid", "Del Monte", "Pick N Peel", "Ceres", "Afia"],
    water: ["Dasani", "Keringet", "Aquafina", "Quench"],
  };

  const summaryModal = bootstrap.Modal.getInstance(
    document.getElementById("summaryModal"),
  );
  if (summaryModal) summaryModal.hide();

  const select = document.getElementById("new-p-cat-select");
  if (select) {
    if (allCategories.length === 0) {
      select.innerHTML = `<option value="" disabled selected>Fetching categories...</option>`;
      const { data, error } = await _supabase.from("categories").select("id, name");
      if (error) {
        select.innerHTML = `<option value="" disabled selected>Error: ${error.message}</option>`;
        return;
      }
      if (data && data.length > 0) allCategories = data;
    }

    if (allCategories.length === 0) {
      select.innerHTML = `<option value="" disabled selected>No categories found (Check RLS Policies)</option>`;
    } else {
      select.innerHTML = `
        <option value="" disabled selected>Choose a category...</option>
        ${allCategories.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}
      `;
    }
    updateQuickSuggestions();
  }

  const modal = bootstrap.Modal.getOrCreateInstance(
    document.getElementById("inventoryModal")
  );
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

  list.innerHTML = (sales || []).map((sale) => {
    const product = allProducts.find((p) => String(p.id) === String(sale.product_id));
    const date = new Date(sale.created_at);
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });

    return `
      <tr>
        <td><small>${dateStr}, ${timeStr}</small></td>
        <td><small class="fw-bold">${product ? product.name : "Unknown Item"}</small></td>
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

  container.innerHTML = presets.map((brand) => `
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
  const filtered = allProducts.filter((p) => p.name.toLowerCase().includes(q));

  list.innerHTML = filtered.map((p) => {
    const stockClass = p.stock <= 0 ? "text-danger fw-bold" : p.stock < 5 ? "text-warning fw-bold" : "";
    return `
      <tr>
        <td><small class="fw-bold">${p.name}</small></td>
        <td><small class="text-muted">${p.categories?.name || "N/A"}</small></td>
        <td class="text-end"><small>${p.price.toLocaleString()}</small></td>
        <td class="text-center ${stockClass}"><small>${p.stock}</small></td>
      </tr>
    `;
  }).join("");
}

function renderInventoryList() {
  const q = (document.getElementById("inventorySearchInput")?.value || "").toLowerCase().trim();
  const list = document.getElementById("inventory-management-list");
  const filtered = allProducts.filter((p) => p.name.toLowerCase().includes(q));

  list.innerHTML = filtered.map((p) => `
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
  const product = allProducts.find((p) => String(p.id) === String(id));
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

  const product = allProducts.find((p) => String(p.id) === String(id));
  if (!product) return;

  const newStock = product.stock + addAmount;
  const { error } = await _supabase.from("products").update({ stock: newStock }).eq("id", id);

  if (error) {
    showNotification("Error updating database", "danger");
  } else {
    showNotification("Stock updated successfully!", "success");
    await fetchData();
    renderInventoryList();
  }
}

function renderPriceList() {
  const q = (document.getElementById("priceSearchInput")?.value || "").toLowerCase().trim();
  const list = document.getElementById("price-management-list");
  const filtered = allProducts.filter((p) => p.name.toLowerCase().includes(q));

  list.innerHTML = filtered.map((p) => `
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
    await fetchData();
    renderPriceList();
    renderInventoryList();
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

  const { error } = await _supabase.from("products").insert([{ name, category_id, price, stock }]).select();

  if (error) {
    showNotification(`Error: ${error.message}`, "danger");
  } else {
    showNotification(`${name} added successfully!`, "success");
    document.getElementById("new-p-name").value = "";
    document.getElementById("new-p-name").focus();
    bootstrap.Tab.getOrCreateInstance(document.querySelector("#manage-tab")).show();
    await fetchData();
    renderInventoryList();
  }
}

// ================= ONLINE STATUS =================
function updateOnlineStatusUI() {
  const statusEl = document.getElementById("connection-status");
  if (!statusEl) return;
  if (navigator.onLine) {
    statusEl.innerText = "Online";
    statusEl.classList.replace("bg-danger", "bg-success");
  } else {
    statusEl.innerText = "Offline";
    statusEl.classList.replace("bg-success", "bg-danger");
  }
}

function notifyIfNoInternet() {
  updateOnlineStatusUI();
  if (!navigator.onLine) {
    showNotification("You are currently offline. Some features may not work.", "warning");
  }
}

window.addEventListener("load", notifyIfNoInternet);
window.addEventListener("offline", () => {
  updateOnlineStatusUI();
  showNotification("You lost internet connection!", "danger");
});
window.addEventListener("online", () => {
  updateOnlineStatusUI();
  showNotification("Back online! Syncing queued sales...", "success");
  syncOfflineQueue();
});

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

// ================= EVENT DELEGATION =================
function initEventListeners() {
  document.getElementById("inventory-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "qty-minus") changeQty(btn, -1, btn.dataset.id);
    else if (action === "qty-plus") changeQty(btn, 1, btn.dataset.id);
    else if (action === "add-to-cart") addToCart(btn, btn.dataset.id);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='quick-stock']");
    if (!btn) return;
    quickStock(btn.dataset.id, parseInt(btn.dataset.amount));
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-brand]");
    if (!btn) return;
    applySuggestion(btn.dataset.brand);
  });
}

// ================= INIT =================
fetchData();
updateCartUI();
initEventListeners();

const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-bs-theme", savedTheme);
updateThemeIcon(savedTheme);

if (navigator.onLine) {
  const pending = getOfflineQueue();
  if (pending.length > 0) {
    showNotification(`You have ${pending.length} unsynced sale(s). Syncing now...`, "info");
    syncOfflineQueue();
  }
}

// ================= SERVICE WORKER =================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.update();
      reg.onupdatefound = () => {
        const newSW = reg.installing;
        newSW.onstatechange = () => {
          if (newSW.state === "activated") {
            showNotification("App updated! Refresh for the latest version.", "info");
          }
        };
      };
    }).catch((err) => console.log("Service Worker registration failed:", err));
  });
}