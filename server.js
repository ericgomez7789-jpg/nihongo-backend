console.log(">>> USING CORRECT SERVER.JS <<<");

require("dotenv").config();
console.log("DEBUG STRIPE KEY =", process.env.STRIPE_SECRET_KEY);
console.log("ENV FRONTEND_URL =", process.env.FRONTEND_URL);

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ------------------------------------------------------
// SUPABASE CLIENT (backend — service role key)
// ------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ------------------------------------------------------
// STRIPE WEBHOOK (raw body only)
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
        console.log("DEBUG Stripe email:", email);

        // ------------------------------------------------------
        // UPSERT PROFILE (FIXED: now returns real data)
        // ------------------------------------------------------
        const { data, error } = await supabase
          .from("profiles")
          .upsert(
            {
              email,
              membership_status: "active",
              membership_plan: plan,
              stripe_session_id: session.id
            },
            { onConflict: "email" }
          )
          .select()
          .single(); // <-- FIX: return the updated row

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
// CORS + JSON FOR ALL NON-WEBHOOK ROUTES
// ------------------------------------------------------
const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

app.use((req, res, next) => {
  if (req.path === "/webhook") return next();
  return cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })(req, res, next);
});

// JSON parsing AFTER webhook
app.use((req, res, next) => {
  if (req.path === "/webhook") return next();
  express.json()(req, res, next);
});

// ------------------------------------------------------
// DEBUG: Log incoming Origin
// ------------------------------------------------------
app.use((req, res, next) => {
  console.log("Incoming Origin:", req.headers.origin);
  next();
});

// ------------------------------------------------------
// CHECKOUT ROUTES
// ------------------------------------------------------
app.post("/create-checkout-session-basic", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: "price_1Tihmk2VyFuAMnh5KQZeIPAo", quantity: 1 }],
      metadata: { plan: "basic-monthly" },
      success_url: `${process.env.FRONTEND_URL}/success.html`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creating basic monthly session:", err);
    res.status(500).json({ error: "Failed to create basic monthly session" });
  }
});

app.post("/create-checkout-session-basic-yearly", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: "price_1Tihnp2VyFuAMnh5Cl2LUzPy", quantity: 1 }],
      metadata: { plan: "basic-yearly" },
      success_url: `${process.env.FRONTEND_URL}/success.html`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creating basic yearly session:", err);
    res.status(500).json({ error: "Failed to create basic yearly session" });
  }
});

app.post("/create-checkout-session-premium", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: "price_1Tihly2VyFuAMnh5tw2x6Vj2", quantity: 1 }],
      metadata: { plan: "premium-monthly" },
      success_url: `${process.env.FRONTEND_URL}/success.html`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creating premium monthly session:", err);
    res.status(500).json({ error: "Failed to create premium monthly session" });
  }
});

app.post("/create-checkout-session-premium-yearly", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: "price_1Tihoi2VyFuAMnh5PMjUk8Z4", quantity: 1 }],
      metadata: { plan: "premium-yearly" },
      success_url: `${process.env.FRONTEND_URL}/success.html`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel.html`,
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
