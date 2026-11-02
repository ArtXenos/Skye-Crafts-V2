// The main journeys, in order: a guest shops, signs up at checkout, orders,
// pays by GCash; the owner confirms; the customer sees the pickup place.
import { expect, test } from "@playwright/test";
import { expectAccessible, logIn, logOut, person, PNG, register, run, sql } from "./helpers";

test.describe.configure({ mode: "serial" });

const buyer = person("buyer");
const owner = person("owner");
let pickupOrderUrl = "";

test.beforeAll(async () => {
  await sql("update public.products set stock = 50, is_active = true where title in ('Mirror Keychain', 'Fuzzy Wire Pot')");
  await sql("update public.shop_settings set value = 'Blk 7 Lot 3, Rose Street (test)' where key = 'pickup_location'");
  await sql("update public.shop_settings set value = '0917 555 0000' where key = 'gcash_number'");
  await sql("update public.shop_settings set value = '7.073100,125.612800' where key = 'pickup_coordinates'");
});

test("a guest can browse, filter and fill a cart", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("twisted by hand");
  await expectAccessible(page);

  // Categories on the home page jump to their section of the collection.
  await page.getByRole("link", { name: /^Fuzzy Wire Pots/ }).click();
  await expect(page).toHaveURL(/\/products#fuzzy-wire-pots$/);
  await expect(page.getByRole("heading", { level: 2, name: /^Fuzzy Wire Pots/ })).toBeInViewport();
  for (const category of ["Flower Bouquets", "Keychains", "Fuzzy Wire Pots", "Desk Figurines"]) {
    await expect(page.getByRole("region", { name: new RegExp(`^${category}`) })).toBeVisible();
  }

  await page.getByRole("button", { name: "Keychains" }).click();
  await expect(page.getByRole("link", { name: "Mirror Keychain" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fuzzy Wire Pot" })).toBeHidden();
  await expectAccessible(page);

  await page.getByRole("link", { name: "Mirror Keychain" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mirror Keychain" })).toBeVisible();
  await page.getByRole("button", { name: "One more" }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("2 in your cart").filter({ visible: true })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("link", { name: /Cart, 2 items/ }).click();
  await expect(page.getByText("₱300", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expectAccessible(page);
});

test("checkout asks a guest to sign up, then keeps their cart", async ({ page }) => {
  await page.goto("/products");
  await page.getByRole("link", { name: "Fuzzy Wire Pot" }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/cart");
  await page.getByRole("link", { name: "Check out" }).click();

  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await register(page, buyer);
  // The local test stack confirms emails automatically; real Supabase sends a link.
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByRole("heading", { name: "Your order" })).toBeVisible();
  await expect(page.getByText("Fuzzy Wire Pot").filter({ visible: true })).toBeVisible();
  await expectAccessible(page);
});

test("a pickup order paid in cash hides the pickup place until confirmed", async ({ page }) => {
  // Each test gets a fresh browser, so the cart (kept in the browser) starts empty.
  await logIn(page, buyer, "/products/3");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/checkout");
  await page.getByLabel("Recipient's name").filter({ visible: true }).fill("Maria Santos");
  await page.getByLabel("Mobile number").filter({ visible: true }).fill("0917 123 4567");

  // Cash is only offered for pickup.
  await expect(page.getByRole("radio", { name: /Cash on pickup/ })).toBeDisabled();
  await page.getByRole("radio", { name: /Pickup/ }).check();
  await page.getByRole("radio", { name: /Cash on pickup/ }).check();
  await page.getByLabel("Note for the shop").filter({ visible: true }).fill("Pink ribbon please <b>thanks</b>");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page).toHaveURL(/\/account\/orders\/\d+\?placed=1/);
  pickupOrderUrl = new URL(page.url()).pathname;
  await expect(page.getByText("Thank you! Your order is in.").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Pink ribbon please <b>thanks</b>").filter({ visible: true })).toBeVisible(); // shown as text, not HTML
  await expect(page.getByText("Rose Street").filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Cart, 0 items/ })).toBeVisible();
  await expectAccessible(page);
});

test("a GCash delivery order shows payment details and takes a receipt", async ({ page }) => {
  await logIn(page, buyer, "/products/2");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/checkout");
  await page.getByLabel("Recipient's name").filter({ visible: true }).fill("Maria Santos");
  await page.getByLabel("Mobile number").filter({ visible: true }).fill("0917 123 4567");
  await page.getByLabel("Delivery address").filter({ visible: true }).fill("12 Rizal Street, Barangay 5, Davao City");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page.getByRole("heading", { name: "Pay with GCash" })).toBeVisible();
  await expect(page.getByText("0917 555 0000").filter({ visible: true })).toBeVisible();
  await page.getByLabel("Upload your GCash payment screenshot").filter({ visible: true }).setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Upload screenshot" }).click();
  await expect(page.getByText("We have your payment screenshot.").filter({ visible: true })).toBeVisible();

  // A text file renamed to .png is refused.
  await page.getByLabel("Upload a different screenshot").filter({ visible: true }).setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await page.getByRole("button", { name: "Upload screenshot" }).click();
  await expect(page.getByText("Upload a JPG, PNG or WebP image.").filter({ visible: true })).toBeVisible();
});

test("customers can't open the admin pages", async ({ page }) => {
  await logIn(page, buyer);
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin/);
  await logOut(page);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
});

test("the owner confirms the order, and the customer then sees where to pick up", async ({ page }) => {
  await page.goto("/register");
  await register(page, owner);
  await expect(page).toHaveURL(/\/account/);
  await sql("update public.profiles set is_admin = true where username = $1", [owner.username]);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expectAccessible(page);
  const orderId = pickupOrderUrl.split("/").pop()!;
  await page.getByRole("link", { name: `#${orderId}`, exact: true }).click();
  await expect(page.getByText("Pink ribbon please <b>thanks</b>").filter({ visible: true })).toBeVisible();
  await page.getByLabel("Note for the customer").filter({ visible: true }).fill("Ready on Saturday!");
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByText(/is now approved/).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark packed" })).toBeVisible();
  await expectAccessible(page);

  await logOut(page);
  await logIn(page, buyer, pickupOrderUrl);
  await expect(page.getByRole("heading", { name: "Where to pick up" })).toBeVisible();
  await expect(page.getByText("Blk 7 Lot 3, Rose Street (test)").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Note from the shop: Ready on Saturday!").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Map of the pickup place" })).toBeVisible();
  await expect(page.locator(".leaflet-container").filter({ visible: true })).toBeVisible(); // Leaflet loaded
  await expect(page.getByRole("link", { name: "Get directions (Google Maps)" })).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=7.0731,125.6128",
  );
  await expectAccessible(page);
});

test("the owner sets the map pin from a Google Maps link", async ({ page }) => {
  await logIn(page, owner, "/admin/settings");
  const field = page.getByLabel("Pickup map pin").filter({ visible: true });
  await expect(field).toHaveValue("7.073100,125.612800");
  await expect(page.getByRole("region", { name: "Map for choosing the pickup pin" })).toBeVisible();
  await expectAccessible(page);

  await field.fill("Davao City");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/Paste the two numbers from Google Maps/).filter({ visible: true })).toBeVisible();

  await field.fill("https://www.google.com/maps/place/Shop/@7.0700,125.6000,17z/data=!3m1!4b1!4m6!3m5!8m2!3d7.0712!4d125.6105");
  await field.blur();
  await expect(field).toHaveValue("7.071200,125.610500"); // tidied to plain numbers
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.").first()).toBeVisible();
  expect(await sql("select value from public.shop_settings where key = 'pickup_coordinates'")).toEqual([{ value: "7.071200,125.610500" }]);

  // Tapping the map (away from the zoom buttons) moves the pin.
  await page.getByRole("region", { name: "Map for choosing the pickup pin" }).click({ position: { x: 250, y: 60 } });
  await expect(field).not.toHaveValue("7.071200,125.610500");
  await expect(field).toHaveValue(/^7\.\d{6},125\.\d{6}$/);
});

test("the owner sees the GCash receipt on the order", async ({ page }) => {
  await logIn(page, owner, "/admin");
  await page.getByLabel("Search").filter({ visible: true }).fill(buyer.username.slice(0, 5));
  await page.getByLabel("Status").filter({ visible: true }).selectOption("Placed");
  await page.getByRole("button", { name: "Show orders" }).click();
  await expect(page.getByText("Receipt uploaded").filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("link", { name: /^#\d+$/ }).first().click();
  await expect(page.getByRole("img", { name: /GCash receipt for order/ })).toBeVisible();
});

test("a guest custom request reaches the owner, who can quote it", async ({ page }) => {
  await page.goto("/#custom");
  await expect(page.getByText("before sending if you might want to change it later.").filter({ visible: true })).toBeVisible();
  await page.getByLabel("Your name").filter({ visible: true }).fill(`Guest ${run}`);
  await page.getByLabel("Email or mobile number").filter({ visible: true }).fill("guest@example.com");
  await page.getByLabel("Your idea").filter({ visible: true }).fill("A graduation bouquet in maroon and gold, about 30 cm tall.");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Request sent.").filter({ visible: true })).toBeVisible();

  await logIn(page, owner, "/admin/requests");
  const card = page.getByRole("listitem").filter({ hasText: `Guest ${run}` });
  await card.getByLabel("Quote (₱)").fill("850");
  await card.getByLabel("Status").selectOption("Quoted");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Request updated.").filter({ visible: true })).toBeVisible();
  await expectAccessible(page);
});

test("a customer edits their request, and the owner sees it was edited", async ({ page }) => {
  // Made directly, so reruns don't hit the request form's hourly limit.
  const details = `A sunflower bouquet for a graduation (${run})`;
  await sql(`insert into public.custom_requests (user_id, name, contact, details)
    select id, 'Maria', 'maria@example.com', $2 from public.profiles where username = $1`, [buyer.username, details]);

  await logIn(page, buyer, "/account");
  const card = page.getByRole("listitem").filter({ hasText: details });
  await expect(card.getByText("New", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Edit request" }).click();
  await card.getByLabel("Your idea").fill(`${details}, in yellow and white`);
  await expectAccessible(page);
  await card.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Request updated.").first()).toBeVisible();
  const edited = page.getByRole("listitem").filter({ hasText: `${details}, in yellow and white` });
  await expect(edited.getByRole("button", { name: "Edit request" })).toBeVisible();

  // A quoted request warns that changing it withdraws the quote.
  await sql("update public.custom_requests set status = 'Quoted', quote_cents = 60000 where details like $1", [`${details}%`]);
  await page.reload();
  await edited.getByRole("button", { name: "Edit request" }).click();
  await expect(edited.getByText("Changing your request withdraws the current quote and the shop will quote again.")).toBeVisible();
  await edited.getByRole("button", { name: "Cancel" }).click();

  // Once the shop has started, it's locked.
  await sql("update public.custom_requests set status = 'In progress' where details like $1", [`${details}%`]);
  await page.reload();
  await expect(edited.getByText("This request is locked. Contact the shop to change it.")).toBeVisible();
  await expect(edited.getByRole("button", { name: "Edit request" })).toHaveCount(0);

  await logOut(page);
  await logIn(page, owner, "/admin/requests");
  await expect(page.getByRole("listitem").filter({ hasText: `${details}, in yellow and white` }).getByText(/^Edited by customer /)).toBeVisible();
});

test("the owner adds a product with a photo and it appears in the shop", async ({ page }) => {
  // Each category lists its varieties, with its own "Add a variety" button.
  await logIn(page, owner, "/admin/products");
  await expect(page.getByRole("region", { name: /^Accessories/ }).getByText("No accessories yet.")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("link", { name: "Add a variety to Fuzzy Wire Pots" }).click();
  await expect(page.getByLabel("Category").filter({ visible: true })).toHaveValue("Fuzzy Wire Pots");
  const title = `Sunflower ${run}`;
  await page.getByLabel("Name").filter({ visible: true }).fill(title);
  await page.getByLabel("Description").filter({ visible: true }).fill("A single sunflower on a long stem.");
  await page.getByLabel("Price (₱)").filter({ visible: true }).fill("199.50");
  await page.getByLabel("In stock").filter({ visible: true }).fill("4");
  await expect(page.getByRole("button", { name: "Take a photo" })).toBeVisible();
  await expectAccessible(page);

  // A photo is required.
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText("Add a photo of the piece.").first()).toBeVisible();

  // Choose a saved photo (the hidden file input behind "Choose a saved photo").
  await page.getByRole("group", { name: "Photo", exact: true }).filter({ visible: true }).getByLabel("Photo: saved photo").setInputFiles({ name: "flower.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "The new photo" })).toBeVisible();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText("Product added with its photo.").filter({ visible: true })).toBeVisible();
  // The browser redrew it as a JPEG before uploading.
  const [saved] = await sql("select image_path from public.products where title = $1", [title]);
  expect(saved.image_path).toMatch(/\.jpg$/);

  // Replace it from the edit page.
  await page.getByRole("group", { name: "Photo", exact: true }).filter({ visible: true }).getByLabel("Photo: saved photo").setInputFiles({ name: "flower2.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Save this photo" }).click();
  await expect(page.getByText("Photo updated.").first()).toBeVisible();
  const [replaced] = await sql("select image_path from public.products where title = $1", [title]);
  expect(replaced.image_path).not.toBe(saved.image_path);

  await page.goto("/products");
  const pots = page.getByRole("region", { name: /^Fuzzy Wire Pots/ });
  await expect(pots.getByRole("link", { name: title })).toBeVisible();
  await expect(pots.getByRole("img", { name: title })).toBeVisible();
  await pots.getByRole("link", { name: title }).click();
  await expect(page.getByText("₱199.50").filter({ visible: true })).toBeVisible();
  // The breadcrumb leads back to the category's varieties.
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Fuzzy Wire Pots" }).click();
  await expect(page).toHaveURL(/\/products#fuzzy-wire-pots$/);
});

test("the owner downloads orders as a CSV file, and customers can't", async ({ page }) => {
  await logIn(page, owner, "/admin");
  await expect(page.getByRole("heading", { name: "Download for Excel or Google Sheets" })).toBeVisible();
  await page.getByLabel("Which orders").selectOption("all");

  const [orders] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "One row per order" }).click()]);
  expect(orders.suggestedFilename()).toMatch(/^skye-crafts-orders-\d{4}-\d{2}-01-to-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await streamText(await orders.createReadStream());
  expect(csv.startsWith("\uFEFFOrder,Date (Manila),Status,Customer")).toBe(true);
  expect(csv).toContain(`#${pickupOrderUrl.split("/").pop()}`.slice(1));
  expect(csv).toContain("Pink ribbon please <b>thanks</b>");

  const [items] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "One row per piece sold" }).click()]);
  const itemsCsv = await streamText(await items.createReadStream());
  expect(itemsCsv).toContain("Product,Made to order,Quantity");

  await logOut(page);
  await logIn(page, buyer, "/account");
  const refused = await page.request.get("/admin/orders/export?from=2026-01-01&to=2026-12-31");
  expect(refused.status()).toBe(403);
});

async function streamText(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

test("a coupon applies at checkout and the total is charged correctly", async ({ page }) => {
  await sql(`insert into public.coupons (code, discount_type, discount_value, starts_on, ends_on, once_per_customer)
    values ($1, 'percentage', 10, current_date - 1, current_date + 1, false) on conflict (code) do nothing`, [`TEN${run}`.toUpperCase()]);
  await logIn(page, buyer, "/products/2");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/checkout");
  await page.getByLabel("Recipient's name").filter({ visible: true }).fill("Maria Santos");
  await page.getByLabel("Mobile number").filter({ visible: true }).fill("0917 123 4567");
  await page.getByLabel("Delivery address").filter({ visible: true }).fill("12 Rizal Street, Barangay 5, Davao City");
  await page.getByLabel("Coupon code").filter({ visible: true }).fill(`ten${run}`);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/applied: you save ₱15/).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: "Pay with GCash" })).toBeVisible();
  await expect(page.getByText("₱135").filter({ visible: true }).first()).toBeVisible();
});

test("checkout refuses a mobile number that isn't a PH mobile number", async ({ page }) => {
  await logIn(page, buyer, "/products/2");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/checkout");
  await page.getByLabel("Recipient's name").filter({ visible: true }).fill("Maria Santos");
  const mobile = page.getByLabel("Mobile number").filter({ visible: true });
  await expect(mobile).toHaveAttribute("type", "tel");
  await expect(mobile).toHaveAttribute("inputmode", "numeric");
  await expect(mobile).toHaveAttribute("placeholder", "09XX XXX XXXX");
  await mobile.fill("0817 123 4567");
  await page.getByLabel("Delivery address").filter({ visible: true }).fill("12 Rizal Street, Barangay 5, Davao City");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Enter a valid PH mobile number, e.g. 0917 123 4567.").filter({ visible: true })).toBeVisible();
  await expect(mobile).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/checkout$/);
});

test("the password can be shown, and is hidden again when the form is sent", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  const field = page.getByLabel("Password", { exact: true }).filter({ visible: true });
  await field.fill("not-the-right-password");
  await expect(field).toHaveAttribute("type", "password");

  // Reachable from the keyboard, big enough to tap, and doesn't send the form.
  const show = page.getByRole("button", { name: "Show password" });
  await expect(show).toHaveAttribute("aria-pressed", "false");
  const box = await show.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await field.focus();
  await page.keyboard.press("Tab");
  await expect(show).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(field).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("That email and password don't match an account.")).toHaveCount(0);
  await expectAccessible(page);

  await page.getByLabel("Email").filter({ visible: true }).fill(buyer.email);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("That email and password don't match an account.").filter({ visible: true })).toBeVisible();
  await expect(field).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false");
});

test("saving a product doesn't undo stock that sold in the meantime", async ({ page }) => {
  const [{ id }] = await sql("select id from public.products where title = 'Fuzzy Wire Pot'");
  await sql("update public.products set stock = 10 where id = $1", [id]);
  await logIn(page, owner, `/admin/products/${id}`);
  await expect(page.getByLabel("In stock").filter({ visible: true })).toHaveValue("10");
  await sql("update public.products set stock = 8 where id = $1", [id]); // two sold while the form was open

  await page.getByLabel("Price (₱)").filter({ visible: true }).fill("290");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Product saved.").filter({ visible: true })).toBeVisible();
  const [after] = await sql("select stock, price_cents from public.products where id = $1", [id]);
  expect(after).toEqual({ stock: 8, price_cents: 29000 });

  // Editing the stock from an out-of-date form is refused, not silently applied.
  await sql("update public.products set stock = 7 where id = $1", [id]);
  await page.getByLabel("In stock").filter({ visible: true }).fill("20");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/changed since you opened it/).filter({ visible: true })).toBeVisible();
  const [still] = await sql("select stock from public.products where id = $1", [id]);
  expect(still.stock).toBe(7);
});

test("a login link can't send people to another website afterwards", async ({ page }) => {
  await page.goto("/login?next=" + encodeURIComponent("/\t/evil.example"));
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  await page.getByLabel("Email").filter({ visible: true }).fill(buyer.email);
  await page.getByLabel("Password", { exact: true }).filter({ visible: true }).fill(buyer.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => url.pathname === "/account");
  expect(new URL(page.url()).host).toBe(new URL(test.info().project.use.baseURL ?? "http://localhost:3000").host);
});
