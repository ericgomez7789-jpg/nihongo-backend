console.log(">>> USING CORRECT SERVER.JS <<<");

console.log("DEBUG STRIPE KEY =", process.env.STRIPE_SECRET_KEY);
console.log("ENV FRONTEND_URL =", process.env.FRONTEND_URL);

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ------------------------------------------------------
// LIVE PRICE IDS
// ------------------------------------------------------
const PRICE_BASIC_MONTHLY = "price_1TlBUbF0QR7lUrADu8FP6yM1";
const PRICE_BASIC_YEARLY = "price_1TlBbjF0QR7lUrADrlQe2ofJ";
const PRICE_PREMIUM_MONTHLY = "price_1TlBYLF0QR7lUrADmaomRX3l";
const PRICE_PREMIUM_YEARLY = "price_1TlBfuF0QR7lUrAD1IGmLGrI";

// ------------------------------------------------------
// CORS
// ------------------------------------------------------
const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://nihongo-frontend.onrender.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);

// ------------------------------------------------------
// *** IMPORTANT ***
// STRIPE WEBHOOK MUST COME BEFORE express.json()
// ------------------------------------------------------
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const email = session.customer_details.email;
        const plan = session.metadata.plan;

        console.log("🔥 Payment completed for:", email, "Plan:", plan);

        // ------------------------------------------------------
        // FIXED MEMBERSHIP UPDATE LOGIC
        // ------------------------------------------------------

        // 1. Find the Supabase user by email
        const { data: user, error: userError } = await supabase
          .from("auth.users")
          .select("id")
          .eq("email", email)
          .single();

        if (userError || !user) {
          console.error("❌ No Supabase user found for email:", email);
          return res.status(400).send("User not found");
        }

        // 2. Update the profile using the user's id
        const { data, error } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id, // <-- CRITICAL
              email,
              membership_status: "active",
              membership_plan: plan,
              stripe_session_id: session.id
            },
            { onConflict: "id" }
          )
          .select()
          .single();

        if (error) {
          console.error("❌ Supabase update failed:", error);
        } else {
          console.log("✅ Supabase membership activated:", data);
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  }
);

// ------------------------------------------------------
// JSON PARSER MUST COME AFTER WEBHOOK
// ------------------------------------------------------
app.use(express.json());

// Debug incoming origin
app.use((req, res, next) => {
  console.log("Incoming Origin:", req.headers.origin);
  next();
});

// ------------------------------------------------------
// SUPABASE
// ------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ------------------------------------------------------
// CHECKOUT ROUTES
// ------------------------------------------------------
function logStripeURLs(label, success_url, cancel_url) {
  console.log(`\n===== ${label} =====`);
  console.log("SUCCESS URL BEING SENT TO STRIPE:", success_url);
  console.log("CANCEL URL BEING SENT TO STRIPE:", cancel_url);
  console.log("==============================\n");
}

// BASIC MONTHLY
app.post("/create-checkout-session-basic", async (req, res) => {
  try {
    const success_url = `${process.env.FRONTEND_URL}/success.html`;
    const cancel_url = `${process.env.FRONTEND_URL}/cancel.html`;

    logStripeURLs("BASIC MONTHLY CHECKOUT", success_url, cancel_url);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRICE_BASIC_MONTHLY, quantity: 1 }],
      metadata: { plan: "basic-monthly" },
      success_url,
      cancel_url,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creating basic monthly session:", err);
    res.status(500).json({ error: "Failed to create basic monthly session" });
  }
});

// BASIC YEARLY
app.post("/create-checkout-session-basic-yearly", async (req, res) => {
  try {
    const success_url = `${process.env.FRONTEND_URL}/success.html`;
    const cancel_url = `${process.env.FRONTEND_URL}/cancel.html`;

    logStripeURLs("BASIC YEARLY CHECKOUT", success_url, cancel_url);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRICE_BASIC_YEARLY, quantity: 1 }],
      metadata: { plan: "basic-yearly" },
      success_url,
      cancel_url,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creating basic yearly session:", err);
    res.status(500).json({ error: "Failed to create basic yearly session" });
  }
});

// PREMIUM MONTHLY
app.post("/create-checkout-session-premium", async (req, res) => {
  try {
    const success_url = `${process.env.FRONTEND_URL}/success.html`;
    const cancel_url = `${process.env.FRONTEND_URL}/cancel.html`;

    logStripeURLs("PREMIUM MONTHLY CHECKOUT", success_url, cancel_url);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRICE_PREMIUM_MONTHLY, quantity: 1 }],
      metadata: { plan: "premium-monthly" },
      success_url,
      cancel_url,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creating premium monthly session:", err);
    res.status(500).json({ error: "Failed to create premium monthly session" });
  }
});

// PREMIUM YEARLY
app.post("/create-checkout-session-premium-yearly", async (req, res) => {
  try {
    const success_url = `${process.env.FRONTEND_URL}/success.html`;
    const cancel_url = `${process.env.FRONTEND_URL}/cancel.html`;

    logStripeURLs("PREMIUM YEARLY CHECKOUT", success_url, cancel_url);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRICE_PREMIUM_YEARLY, quantity: 1 }],
      metadata: { plan: "premium-yearly" },
      success_url,
      cancel_url,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creating premium yearly session:", err);
    res.status(500).json({ error: "Failed to create premium yearly session" });
  }
});

// ------------------------------------------------------
// START SERVER
// ------------------------------------------------------
const PORT = 4242;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
