const supabaseUrl = "https://sgysjdrbsdniaxztbury.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneXNqZHJic2RuaWF4enRidXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzYxMzMsImV4cCI6MjA5MjAxMjEzM30.7RygricljOX-i9AkgOGpAqSBZNjuPjhGx5NpXJXh9Qo";

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let cart = [];
let allProducts = [];
let salesChart = null;

let selectedQty = 1;

// FETCH PRODUCTS
async function fetchData() {
  const { data, error } = await _supabase.from("products").select("*");

  if (error) return console.error(error);

  allProducts = data;
  renderCards(allProducts);
}

// SEARCH
let searchTimeout;

function handleSearch() {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const query = document
      .getElementById("searchInput")
      .value.toLowerCase()
      .trim();

    const filtered = allProducts.filter((p) =>
      p.name.toLowerCase().includes(query)
    );

    renderCards(filtered);
  }, 150);
}

// RENDER PRODUCTS (WITH CATEGORY + QTY PICKER)
function renderCards(products) {
  const grid = document.getElementById("inventory-grid");
  const loading = document.getElementById("loading-state");
  if (loading) loading.remove();

  // group by category
  const grouped = {};
  products.forEach((p) => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  grid.innerHTML = Object.keys(grouped)
    .map((cat) => {
      return `
      <div class="col-12 mt-3">
        <h5 class="text-primary">${cat}</h5>
      </div>

      ${grouped[cat]
        .map(
          (product) => `
        <div class="col-6">
          <div class="card shadow-sm border-0">
            <div class="card-body text-center">

              <h6>${product.name}</h6>
              <small class="text-muted">${product.category}</small>

              <p class="fw-bold text-primary mt-2">${product.price} KES</p>

              <!-- QTY SELECTOR -->
              <div class="d-flex justify-content-center align-items-center gap-2 mb-2">
                <button class="btn btn-sm btn-outline-secondary"
                  onclick="changeQty(-1)">-</button>

                <span id="qtyDisplay">${selectedQty}</span>

                <button class="btn btn-sm btn-outline-secondary"
                  onclick="changeQty(1)">+</button>
              </div>

              <button class="btn btn-sm btn-primary w-100"
                onclick='addToCart(${JSON.stringify(product)})'>
                Add
              </button>

            </div>
          </div>
        </div>
      `
        )
        .join("")}
    `;
    })
    .join("");

  document.getElementById("total-items-count").innerText =
    `${products.length} Products`;
}

// CHANGE QTY BEFORE ADDING
function changeQty(value) {
  selectedQty += value;

  if (selectedQty < 1) selectedQty = 1;

  document.querySelectorAll("#qtyDisplay").forEach((el) => {
    el.innerText = selectedQty;
  });
}

// ADD TO CART
function addToCart(product) {
  const id = String(product.id);

  const existing = cart.find((i) => String(i.id) === id);

  if (existing) {
    existing.qty += selectedQty;
  } else {
    cart.push({ ...product, id, qty: selectedQty });
  }

  selectedQty = 1;
  updateCartUI();
}

// REMOVE FROM CART
function removeFromCart(id) {
  id = String(id);

  const item = cart.find((p) => String(p.id) === id);
  if (!item) return;

  item.qty -= 1;

  if (item.qty <= 0) {
    cart = cart.filter((p) => String(p.id) !== id);
  }

  updateCartUI();
}

// CART UI
function updateCartUI() {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  document.getElementById("cart-total-price").innerText =
    total.toLocaleString();

  document.getElementById("cart-summary").innerText =
    `${count} item(s)`;

  renderCartItems();
}

// CART RENDER
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
        <strong>${item.name}</strong><br>
        <small>${item.price} x ${item.qty}</small>
      </div>

      <div>
        <b>${item.price * item.qty} KES</b>
        <button class="btn btn-sm btn-danger ms-2"
          onclick="removeFromCart('${item.id}')">−</button>
      </div>
    </li>
  `
    )
    .join("");
}

// CLEAR
function clearCart() {
  cart = [];
  updateCartUI();
}

// CHECKOUT
async function checkout() {
  if (cart.length === 0) return;

  const payment = document.querySelector(
    'input[name="payment"]:checked'
  ).value;

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

  alert("Sale complete");
  clearCart();
  fetchData();
}

// INIT
fetchData();
updateCartUI();

// SALES CHART 