# FraudEx - Fraud Detection Testing Guide

## 🚀 Quick Start

### Applications Running:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

## 📋 Step-by-Step Testing Guide

### **Method 1: Using API Documentation (Easiest)**

#### Step 1: Open API Documentation
Go to: **http://localhost:8000/docs**

You'll see all available endpoints with a "Try it out" button.

#### Step 2: Create a User
1. Find **POST /users/** endpoint
2. Click "Try it out"
3. Use this JSON:
```json
{
  "email": "admin@fraudex.com",
  "password": "admin123",
  "full_name": "Admin User",
  "role": "ADMIN"
}
```
4. Click "Execute"
5. **Copy the user ID** from the response

#### Step 3: Login
1. Find **POST /auth/login** endpoint
2. Click "Try it out"
3. Fill in:
   - username: `admin@fraudex.com`
   - password: `admin123`
4. Click "Execute"
5. **Copy the access_token** from the response

#### Step 4: Authorize (Important!)
1. Click the **"Authorize"** button at the top of the page
2. Paste your access_token in the "Value" field
3. Click "Authorize" and "Close"

Now you're authenticated for all subsequent requests!

#### Step 5: Create a Vendor
1. Find **POST /vendors/** endpoint
2. Click "Try it out"
3. Use this JSON:
```json
{
  "name": "ABC Suppliers Ltd",
  "tax_id": "27AABCU9603R1ZM",
  "email": "contact@abc-suppliers.com",
  "phone": "+91-9876543210",
  "address": "123 Business Park, Mumbai, Maharashtra"
}
```
4. Click "Execute"
5. **Note the vendor ID** from response

#### Step 6: Create Sample Invoices

**Invoice 1 - Normal Invoice:**
1. Find **POST /invoices/upload** endpoint
2. Click "Try it out"
3. Select a PDF/image file (or create a dummy text file named "invoice1.pdf")
4. Click "Execute"
5. **Note the invoice ID**

Let's add data to this invoice manually:
1. Find **PUT /invoices/{invoice_id}** endpoint
2. Click "Try it out"
3. Enter your invoice ID
4. Use this JSON:
```json
{
  "invoice_number": "INV-2024-001",
  "vendor_id": 1,
  "invoice_date": "2024-01-15",
  "due_date": "2024-02-15",
  "subtotal": 10000.00,
  "tax": 1800.00,
  "total_amount": 11800.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}
```
5. Click "Execute"

**Invoice 2 - Duplicate Invoice (Will trigger CRITICAL fraud alert):**
1. Upload another invoice
2. Update it with **same invoice_number** and **same vendor_id**:
```json
{
  "invoice_number": "INV-2024-001",
  "vendor_id": 1,
  "invoice_date": "2024-01-16",
  "due_date": "2024-02-16",
  "subtotal": 10000.00,
  "tax": 1800.00,
  "total_amount": 11800.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}
```

**Invoice 3 - Suspicious Round Amount:**
```json
{
  "invoice_number": "INV-2024-003",
  "vendor_id": 1,
  "invoice_date": "2024-01-20",
  "due_date": "2024-02-20",
  "subtotal": 100000.00,
  "tax": 18000.00,
  "total_amount": 118000.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}
```

**Invoice 4 - Invalid Tax Rate:**
```json
{
  "invoice_number": "INV-2024-004",
  "vendor_id": 1,
  "invoice_date": "2024-01-25",
  "due_date": "2024-02-25",
  "subtotal": 5000.00,
  "tax": 750.00,
  "total_amount": 5750.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}
```
*This has 15% tax rate which is invalid for GST (should be 5%, 12%, 18%, or 28%)*

**Invoice 5 - Future Date:**
```json
{
  "invoice_number": "INV-2025-001",
  "vendor_id": 1,
  "invoice_date": "2025-12-31",
  "due_date": "2026-01-31",
  "subtotal": 8000.00,
  "tax": 1440.00,
  "total_amount": 9440.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}
```

#### Step 7: Run Fraud Detection

For each invoice, run fraud detection:

1. Find **POST /invoices/{invoice_id}/detect-fraud** endpoint
2. Click "Try it out"
3. Enter the invoice ID
4. Click "Execute"

**You'll see:**
- `risk_score`: 0-100 (higher = more risky)
- `risk_level`: LOW, MEDIUM, HIGH, or CRITICAL
- `fraud_flags`: Array of detected fraud issues
  - Each flag has:
    - `code`: What type of fraud
    - `severity`: How serious it is
    - `message`: Human-readable explanation
    - `evidence`: Supporting data

#### Step 8: Get Fraud Summary

1. Find **GET /invoices/{invoice_id}/fraud-summary** endpoint
2. Click "Try it out"
3. Enter invoice ID
4. Click "Execute"

This gives you a quick overview with top concerns.

#### Step 9: View Fraud Analytics

**Overall Statistics:**
- Find **GET /fraud/statistics**
- Click "Execute"
- See total invoices analyzed, risk distribution, most common fraud types

**High-Risk Invoices:**
- Find **GET /fraud/high-risk-invoices**
- Click "Execute"
- See all high-risk and critical invoices

**Risk Distribution:**
- Find **GET /fraud/risk-distribution**
- Click "Execute"
- See percentage breakdown by risk level

**Vendor Risk Profile:**
- Find **GET /fraud/vendors/{vendor_id}/risk-profile**
- Enter vendor ID: 1
- Click "Execute"
- See vendor's overall risk assessment

---

## 🧪 What Each Test Case Will Show

### Test Case 1: Normal Invoice (INV-2024-001)
**Expected Result:**
- Risk Level: LOW or MEDIUM
- May flag for "New Vendor" if it's the first invoice
- Should pass most validations

### Test Case 2: Duplicate Invoice (Same invoice number)
**Expected Result:**
- Risk Level: CRITICAL
- Fraud Flags:
  - `DUPLICATE_INVOICE` (CRITICAL severity)
  - Shows the duplicate invoice ID as evidence

### Test Case 3: Round Amount (₹100,000)
**Expected Result:**
- Risk Level: MEDIUM
- Fraud Flags:
  - `SUSPICIOUSLY_ROUND_AMOUNT` (MEDIUM severity)
  - May also flag `VENDOR_AMOUNT_SPIKE` if much higher than average

### Test Case 4: Invalid Tax Rate (15%)
**Expected Result:**
- Risk Level: HIGH
- Fraud Flags:
  - `INVALID_GST_RATE` (HIGH severity)
  - Shows that 15% doesn't match standard GST rates

### Test Case 5: Future Date (2025)
**Expected Result:**
- Risk Level: HIGH
- Fraud Flags:
  - `FUTURE_INVOICE_DATE` (HIGH severity)
  - Shows how many days in the future

---

## 🔍 All Fraud Detection Features to Test

### ✅ Duplicate Detection
- Upload 2 invoices with same vendor + invoice number
- Should get `DUPLICATE_INVOICE` flag

### ✅ Similar Invoice Detection
- Upload 2 invoices from same vendor with:
  - Similar amounts (within 5%)
  - Similar dates (within 7 days)
- Should get `SIMILAR_INVOICE` flag

### ✅ Vendor Risk
- First invoice from new vendor: `NEW_VENDOR` flag
- High-value invoice from new vendor: Escalated to HIGH severity

### ✅ Amount Anomalies
- Round numbers (10000, 50000, 100000): `SUSPICIOUSLY_ROUND_AMOUNT`
- Amount 3x higher than vendor average: `VENDOR_AMOUNT_SPIKE`
- Repeating digits (11111, 22222): `REPEATING_DIGIT_AMOUNT`
- Amount just below approval threshold: `AMOUNT_BELOW_THRESHOLD`

### ✅ Tax Validation
- Invalid GST rate (not 5/12/18/28%): `INVALID_GST_RATE`
- Subtotal + tax ≠ total: `TAX_CALCULATION_MISMATCH`
- High-value invoice with no tax: `MISSING_TAX_HIGH_VALUE`
- Tax rate > 35%: `EXCESSIVE_TAX_RATE`

### ✅ Date Validation
- Future-dated invoice: `FUTURE_INVOICE_DATE`
- Invoice > 2 years old: `VERY_OLD_INVOICE`
- Due date before invoice date: `DUE_BEFORE_INVOICE`
- Weekend invoice: `WEEKEND_INVOICE_DATE` (INFO level)

---

## 📊 Understanding Risk Scores

- **0-25**: LOW - Minor concerns, likely legitimate
- **25-50**: MEDIUM - Some suspicious patterns, needs review
- **50-75**: HIGH - Multiple red flags, careful review needed
- **75-100**: CRITICAL - Serious fraud indicators, immediate attention

---

## 🛠️ Using cURL (Command Line Testing)

If you prefer command line:

```bash
# 1. Create user
curl -X POST http://localhost:8000/users/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fraudex.com","password":"admin123","full_name":"Admin","role":"ADMIN"}'

# 2. Login and get token
TOKEN=$(curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@fraudex.com&password=admin123" | jq -r '.access_token')

# 3. Create vendor
curl -X POST http://localhost:8000/vendors/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"ABC Suppliers","tax_id":"27AABCU9603R1ZM"}'

# 4. Update invoice data
curl -X PUT http://localhost:8000/invoices/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invoice_number":"INV-001","vendor_id":1,"invoice_date":"2024-01-15","total_amount":11800,"status":"ANALYSIS_READY"}'

# 5. Run fraud detection
curl -X POST http://localhost:8000/invoices/1/detect-fraud \
  -H "Authorization: Bearer $TOKEN" | jq

# 6. Get fraud summary
curl -X GET http://localhost:8000/invoices/1/fraud-summary \
  -H "Authorization: Bearer $TOKEN" | jq

# 7. Get fraud statistics
curl -X GET http://localhost:8000/fraud/statistics \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 🎯 Quick Verification Checklist

- [ ] Can create users and login
- [ ] Can create vendors
- [ ] Can upload/update invoices
- [ ] Fraud detection runs without errors
- [ ] Duplicate invoice gets CRITICAL flag
- [ ] Invalid tax rate gets HIGH flag
- [ ] Future date gets HIGH flag
- [ ] Round amounts get flagged
- [ ] Can view fraud statistics
- [ ] Can see high-risk invoice list
- [ ] Vendor risk profiles work

---

## 🐛 Troubleshooting

**If you get "401 Unauthorized":**
- Make sure you clicked "Authorize" in the API docs
- Your token may have expired, login again

**If fraud detection returns empty flags:**
- Make sure invoice status is `ANALYSIS_READY`
- Check that invoice has required fields (invoice_date, total_amount, vendor_id)

**If you can't see the frontend:**
- Check that both servers are running
- Backend: http://localhost:8000
- Frontend: http://localhost:5173

---

## 📝 Sample Test Scenario

Here's a complete test flow:

1. **Setup**: Create user, login, create vendor
2. **Test Normal**: Upload invoice with valid data → Should be LOW risk
3. **Test Duplicate**: Upload same invoice number → Should be CRITICAL
4. **Test Tax**: Upload invoice with 15% tax → Should be HIGH risk
5. **Test Amount**: Upload invoice for ₹100,000 → Should flag round number
6. **Analytics**: Check fraud statistics → Should show all analyzed invoices
7. **Vendor**: Check vendor risk profile → Should show statistics

---

**Need help? Check the server logs in your terminal for detailed error messages!**
