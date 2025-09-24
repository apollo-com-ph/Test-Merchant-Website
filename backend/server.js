const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fetch = require("node-fetch"); // Install: npm install node-fetch@2
const {
  incrementCount,
  getCallbackCount,
  resetCount,
  logEntry,
  getLogs,
  resetLogs,
} = require("./callbackUtils");

const app = express();
const port = process.env.PORT || 3000;

// Environment / config
let PAYCONNECT_BASEURL =
  process.env.PAYCONNECT_API_BASE_URL || "http://localhost:8080";
let MERCHANT_RESPONSE_KEY =
  process.env.MERCHANT_RESPONSE_KEY ||
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlbLRN4tqHsVPxpIqfHv9nWwhu9Px+TOclj0vZ5Dn7cW7pbigzq+xItn5QYRbuIlthNvdg/7ht1v6LpByY5CtlVYqeNHbT8n7toLu4e11jRgV9TN6nCgmdZFYJgqsjQcZPw/lUjwUzXxDDiAX43PNYFhgbXre/cj9xyVUTtH3Hp8nO/PeAt42yMbN47iIRErN4N5GBdq1B4o9Yv3s8b2sAmYkf1sczN7YakFOrWrp33uvM4vWP8685kaXkMKWE1ugcNo7qIl9WycFVgKjUTysV0x/aLEge1sMR+afZr0lYFoYXOQ86v4Yuj+qaHVmPgRueOKLTdti1tFhOlACAQaNoQIDAQAB";

// Middleware
app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf.toString(encoding || "utf8");
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use("/", express.static(path.join(__dirname, "../frontend")));

// In-memory storage
const webhookStore = new Map();         // transactionReferenceNumber → webhook payload
const checkoutStore = new Map();        // merchantReferenceNumber → expected amount

app.post("/testcheckout", async (req, res) => {
  console.log("Direct checkout test");

  const { merchantPublicKey, currency, merchantReferenceNumber, items } = req.body;

  if (!merchantPublicKey) {
    return res.status(400).json({ error: "Merchant Public Key is required" });
  }

  const authkey = merchantPublicKey.trim();
  const url = PAYCONNECT_BASEURL;

  const token = Buffer.from(authkey + ":").toString("base64");
  const amount = items.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0
  );

  // ✅ Save expected amount for this merchantReferenceNumber
  checkoutStore.set(merchantReferenceNumber, amount);

  const requestOptions = {
    method: "POST",
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currency: currency || "PHP",
      amount,
      merchantReferenceNumber,
      items,
    }),
  };

  try {
    const response = await fetch(url + "/v1/payments/checkout", requestOptions);
    if (!response.ok) {
      console.log(response.status);
      return res.send(response.status + "<br/>" + (await response.text()));
    } else {
      const checkoutData = await response.json();
      return res.redirect(checkoutData.checkoutUrl);
    }
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).json({
      errorCode: "INTERNAL_SERVER_ERROR",
      errorDescription: "An error occurred while processing your request.",
      errorDetails: error.message,
    });
  }
});

// --- Webhook ---
app.post("/webhook", async (req, res) => {
  console.log("Webhook received body:", req.body);
  const data = req.body;

  // --- Signature headers ---
  const signatureHeader =
    req.header("Payconnect-Signature") || req.header("payconnect-signature");
  const timestampHeader =
    req.header("Payconnect-Timestamp") || req.header("payconnect-timestamp");
  const nonceHeader =
    req.header("Payconnect-Nonce") || req.header("payconnect-nonce");

  if (!signatureHeader || !timestampHeader || !nonceHeader) {
    return res.status(400).json({
      errorCode: "MISSING_SIGNATURE_HEADERS",
      errorDescription: "Missing Payconnect signature headers.",
    });
  }

  const rawPayload =
    req.rawBody && req.rawBody.length ? req.rawBody : JSON.stringify(data);
  const signaturePayload = nonceHeader + timestampHeader + rawPayload;

  const isValidSignature = verifyRsaSignature(
    MERCHANT_RESPONSE_KEY,
    signaturePayload,
    signatureHeader
  );

  if (!isValidSignature) {
    return res.status(400).json({
      errorCode: "INVALID_SIGNATURE",
      errorDescription: "Invalid signature.",
    });
  }

  // --- ✅ Amount validation based on user input ---
  const expectedAmount = checkoutStore.get(data.merchantReferenceNumber);
  const receivedAmount = parseFloat(data.amount);

  if (expectedAmount == null) {
    console.warn("No expected amount found for this merchantReferenceNumber");
  } else if (receivedAmount !== expectedAmount) {
    console.error("Amount validation failed:", {
      expected: expectedAmount,
      received: receivedAmount,
    });
    return res.status(400).json({
      errorCode: "AMOUNT_MISMATCH",
      errorDescription: `Expected ₱${expectedAmount}, but received ₱${receivedAmount}`,
    });
  }

  // --- Store webhook event ---
  if (data.transactionReferenceNumber) {
    webhookStore.set(data.transactionReferenceNumber, data);
    incrementCount();
    logEntry(data);
    console.log("Stored webhook event for:", data.transactionReferenceNumber);
  }

  const resBody = {
    status: "SUCCESS",
    message: "Merchant webhook processed successfully",
  };
  return res.status(200).json(resBody);
});


// --- Success page ---
app.get("/success/:transactionReferenceNumber", (req, res) => {
  const { transactionReferenceNumber } = req.params;
  const event = webhookStore.get(transactionReferenceNumber);

  if (!event) {
    return res.status(404).send(`<h1>No webhook event found</h1>
      <p>Transaction Reference Number: ${transactionReferenceNumber}</p>`);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payment Success</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f9fafb; padding: 20px; }
          .container {
            max-width: 600px; margin: auto; background: #fff;
            border-radius: 10px; padding: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #28a745; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          td, th { border: 1px solid #ddd; padding: 10px; }
          th { background: #f3f4f6; text-align: left; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Payment Successful</h1>
          <p>Your payment has been confirmed by the webhook.</p>
          <table>
            <tr><th>Transaction Reference</th><td>${event.transactionReferenceNumber}</td></tr>
            <tr><th>Merchant Reference</th><td>${event.merchantReferenceNumber}</td></tr>
            <tr><th>Amount</th><td>₱${event.amount}</td></tr>
            <tr><th>Merchant Code</th><td>${event.merchantCode}</td></tr>
            <tr><th>Status</th><td>${event.status}</td></tr>
            <tr><th>Event Type</th><td>${event.eventType}</td></tr>
            <tr><th>Timestamp</th><td>${event.timestamp}</td></tr>
          </table>
        </div>
      </body>
    </html>
  `);
});

// --- Callbacks overview ---
app.get("/callbacks", (req, res) => {
  res.json({
    count: getCallbackCount(),
    logs: getLogs(),
  });
});


app.post("/reset3", (req, res) => {
  resetLogs();
  resetCount();
  res.json({ status: "reset done" });
});



// Success/fail redirects
app.get("/success", (req, res) => res.send("<h1>Payment Success</h1>"));
app.get("/fail", (req, res) => res.send("<h1>Payment Failed</h1>"));

function verifyRsaSignature(publicKey, data, signature) {
  if (typeof signature === "string" && signature.startsWith("hmac256-")) {
    return false;
  }
  const loadedPublicKey = crypto.createPublicKey({
    key: Buffer.from(publicKey, "base64"),
    format: "der",
    type: "spki",
  });
  return crypto
    .createVerify("sha256")
    .update(data)
    .end()
    .verify(loadedPublicKey, Buffer.from(signature, "base64"));
}

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
