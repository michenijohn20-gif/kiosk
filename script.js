const supabaseUrl = "https://sgysjdrbsdniaxztbury.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneXNqZHJic2RuaWF4enRidXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzYxMzMsImV4cCI6MjA5MjAxMjEzM30.7RygricljOX-i9AkgOGpAqSBZNjuPjhGx5NpXJXh9Qo";

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let cart = [];
let allProducts = [];
let salesChart = null;
// ================= FETCH PRODUCTS =================
async function fetchData() {
  const { data, error } = await _supabase.from("products").select("*");

  if (error) return console.error(error);

  allProducts = data;
  renderCards(allProducts);
}

// ================= SEARCH =================
let searchTimeout;

function handleSearch() {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const q = document.getElementById("searchInput").value.toLowerCase().trim();

    const filtered = allProducts.filter((p) =>
      p.name.toLowerCase().includes(q),
    );

    renderCards(filtered);
  }, 150);
}
console.log("Script loaded");
console.log("Supabase client initialized:", _supabase);

// ================= RENDER PRODUCTS =================
function renderCards(products) {
  const grid = document.getElementById("inventory-grid");
  const loading = document.getElementById("loading-state");
  if (loading) loading.remove();

  const grouped = {};

  products.forEach((p) => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  grid.innerHTML = Object.keys(grouped)
    .map(
      (cat) => `
    <div class="col-12 mt-3">
      <h5 class="text-primary">${cat}</h5>
    </div>

    ${grouped[cat]
      .map(
        (product) => `
      <div class="col-6">
        <div class="card shadow-sm">
          <div class="card-body text-center">

            <h6>${product.name}</h6>
            <small class="text-muted">${product.category}</small>
            
            <div class="mb-2">
              ${product.stock <= 0 
                ? '<span class="badge bg-danger">Out of stock</span>' 
                : product.stock < 5 
                ? '<span class="badge bg-warning text-dark">Few in stock</span>' 
                : '<span class="badge bg-success">In stock</span>'}
            </div>

            <p class="fw-bold text-primary">${product.price} KES</p>

            <div class="d-flex justify-content-center gap-2 mb-2">
              <button onclick="changeQty(this, -1)" class="btn btn-sm btn-outline-secondary">-</button>
              <span>1</span>
              <button onclick="changeQty(this, 1)" class="btn btn-sm btn-outline-secondary">+</button>
            </div>

            <button class="btn btn-primary btn-sm w-100"
              onclick='addToCart(this, ${JSON.stringify(product)})'>
              Add
            </button>

          </div>
        </div>
      </div>
    `,
      )
      .join("")}
  `,
    )
    .join("");

  document.getElementById("total-items-count").innerText =
    `${products.length} Products`;
}
console.log("Render function defined");
// ================= QTY =================
function changeQty(btn, val) {
  const span = btn.parentElement.querySelector("span");
  let currentQty = parseInt(span.innerText);
  currentQty += val;
  if (currentQty < 1) currentQty = 1;
  span.innerText = currentQty;
}

// ================= NOTIFICATIONS =================
function showNotification(message, type = "danger") {
  const toast = document.createElement("div");
  toast.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3 shadow-lg`;
  toast.style.zIndex = "1060";
  toast.style.minWidth = "250px";
  toast.innerText = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ================= ADD TO CART =================
function addToCart(btn, product) {
  const qtySpan = btn.closest(".card-body").querySelector(".d-flex span");
  const qty = parseInt(qtySpan.innerText);

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
}
console.log("Add to cart function defined");
console.log("Initial cart state:", cart);
console.log("Initial products state:", allProducts);

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
  const quickBar = document.getElementById("quick-checkout-bar");
  const quickTotal = document.getElementById("quick-total-price");
  
  if (quickTotal) quickTotal.innerText = total.toLocaleString();
  if (quickBar) {
    // Only show the bar if there are items, otherwise hide to save space
    count > 0 ? quickBar.classList.remove("d-none") : quickBar.classList.add("d-none");
    // Add padding to body so the bar doesn't cover the last product row
    document.body.style.paddingBottom = count > 0 ? "80px" : "0px";
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

  // Close the offcanvas on success
  const cartPanel = document.getElementById('cartOffcanvas');
  const bsOffcanvas = bootstrap.Offcanvas.getInstance(cartPanel);
  if (bsOffcanvas) bsOffcanvas.hide();

  alert("Sale complete");
  clearCart();
  fetchData();
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

    const { data: sales, error } = await _supabase
      .from("sales")
      .select("*")
      .gte("created_at", today.toISOString());

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
    const modal = new bootstrap.Modal(document.getElementById("summaryModal"));
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
    const totalRevenue = safeSales.reduce((sum, s) => sum + Number(s.amount_paid), 0);
    const avgSale = safeSales.length ? (totalRevenue / safeSales.length) : 0;
    document.getElementById("det-avg-sale").innerText = Math.round(avgSale).toLocaleString() + " KES";

    // 2. Calculate Peak Hour
    const hours = safeSales.map(s => new Date(s.created_at).getHours());
    const peakHour = hours.length ? hours.sort((a,b) =>
          hours.filter(v => v===a).length - hours.filter(v => v===b).length
    ).pop() : 0;
    document.getElementById("det-peak-hour").innerText = `${peakHour}:00`;

    // 3. Total Items Sold (Volume)
    document.getElementById("det-total-qty").innerText = safeSales.length;

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
    const detailModal = new bootstrap.Modal(document.getElementById("detailedSummaryModal"));
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
      .filter(s => s.created_at.startsWith(date))
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

// ================= INIT =================
fetchData();
updateCartUI();