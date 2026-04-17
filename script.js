const supabaseUrl = "https://sgysjdrbsdniaxztbury.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneXNqZHJic2RuaWF4enRidXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzYxMzMsImV4cCI6MjA5MjAxMjEzM30.7RygricljOX-i9AkgOGpAqSBZNjuPjhGx5NpXJXh9Qo";
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let cart = [];
let salesChart = null;
let allProducts = [];

// FETCH PRODUCTS
async function fetchData() {
  const { data, error } = await _supabase.from("products").select("*");

  if (error) return console.error(error);

  allProducts = data; // store globally
  renderCards(allProducts);
}
let searchTimeout;

function handleSearch() {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const query = document
      .getElementById("searchInput")
      .value.toLowerCase()
      .trim();

    const filtered = allProducts.filter((product) =>
      product.name.toLowerCase().includes(query),
    );

    renderCards(filtered);
  }, 150);
}

// RENDER PRODUCTS
function renderCards(products) {
  const grid = document.getElementById("inventory-grid");
  const loading = document.getElementById("loading-state");
  if (loading) loading.remove();

  grid.innerHTML = products
    .map(
      (product) => `
    <div class="col-6">
      <div class="card text-center shadow-sm border-0">
        <div class="card-body">
          <h6 class="fw-bold">${product.name}</h6>
          <p class="text-primary fw-bold">${product.price} KES</p>
          <button class="btn btn-sm btn-outline-primary w-100"
            onclick='addToCart(${JSON.stringify(product)})'>
            + Add
          </button>
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  document.getElementById("total-items-count").innerText =
    `${products.length} Products`;
}

// ADD TO CART
function addToCart(product) {
  cart.push(product);
  updateCartUI();
}

// UPDATE CART UI
function updateCartUI() {
  const total = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);

  document.getElementById("cart-total-price").innerText =
    total.toLocaleString();

  document.getElementById("cart-summary").innerText = `${cart.length} item(s)`;
}

// CLEAR CART
function clearCart() {
  cart = [];
  updateCartUI();
}

// CHECKOUT
async function checkout() {
  if (cart.length === 0) return;

  const paymentMethod = document.querySelector(
    'input[name="payment"]:checked',
  ).value;

  if (!confirm(`Sell ${cart.length} items via ${paymentMethod}?`)) return;

  for (const item of cart) {
    await _supabase
      .from("products")
      .update({ stock: item.stock - 1 })
      .eq("id", item.id);

    await _supabase.from("sales").insert([
      {
        product_id: item.id,
        amount_paid: item.price,
        payment_method: paymentMethod,
      },
    ]);
  }

  alert("Sale complete");
  clearCart();
  fetchData();
}

// SUMMARY
async function showSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: sales, error: salesError } = await _supabase
    .from("sales")
    .select("*")
    .gte("created_at", today.toISOString());

  const { data: products, error: prodError } = await _supabase
    .from("products")
    .select("name, stock")
    .lt("stock", 5);

  if (salesError || prodError) {
    console.error(salesError || prodError);
    alert("Error loading summary");
    return;
  }
  renderChart(sales);

  let cash = 0;
  let mpesa = 0;
  let total = 0;

  sales.forEach((sale) => {
    const amt = parseFloat(sale.amount_paid);
    total += amt;

    if (sale.payment_method === "Cash") cash += amt;
    if (sale.payment_method === "M-Pesa") mpesa += amt;
  });

  document.getElementById("stat-cash").innerText = cash.toLocaleString();
  document.getElementById("stat-mpesa").innerText = mpesa.toLocaleString();
  document.getElementById("stat-total").innerText = total.toLocaleString();
  document.getElementById("stat-count").innerText = `${sales.length} sale(s)`;

  const list = document.getElementById("low-stock-list");
  list.innerHTML = products.length
    ? products
        .map(
          (p) => `
        <li class="list-group-item d-flex justify-content-between">
          ${p.name}
          <span class="badge bg-danger">${p.stock}</span>
        </li>
      `,
        )
        .join("")
    : `<li class="list-group-item text-muted">All stock OK</li>`;

  new bootstrap.Modal(document.getElementById("summaryModal")).show();
}
function renderChart(sales) {
  // Group sales by date
  const dailyTotals = {};

  sales.forEach((sale) => {
    const date = new Date(sale.created_at).toLocaleDateString();

    if (!dailyTotals[date]) dailyTotals[date] = 0;
    dailyTotals[date] += parseFloat(sale.amount_paid);
  });

  const labels = Object.keys(dailyTotals);
  const data = Object.values(dailyTotals);

  const ctx = document.getElementById("salesChart");

  // Destroy old chart if it exists
  if (salesChart) {
    salesChart.destroy();
  }

  salesChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "KES Earned",
          data: data,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// INIT
fetchData();
