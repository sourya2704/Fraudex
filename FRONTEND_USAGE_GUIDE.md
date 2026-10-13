# 🌐 FraudEx Frontend - User Guide

## How to Test Fraud Detection Using the Website

---

## 🚀 Getting Started

### Step 1: Open the Website
Open your browser and go to: **http://localhost:5173**

You should see the FraudEx login page.

---

## 👤 User Account Setup

### Step 2: Create an Account

1. Click **"Sign Up"** or **"Register"** button
2. Fill in the registration form:
   - **Name:** Admin User
   - **Email:** admin@fraudex.com
   - **Password:** admin123
   - **Role:** Select "ADMIN" (or the available role option)
3. Click **"Sign Up"** or **"Create Account"**

> **Note:** If you get an error, the user might already exist. Try logging in directly or use a different email.

### Step 3: Login

1. Enter your credentials:
   - **Email/Username:** admin@fraudex.com
   - **Password:** admin123
2. Click **"Login"**

You should now be redirected to the **Dashboard**.

---

## 📊 Dashboard Overview

After logging in, you'll see the main dashboard with a sidebar containing:

- **📈 Dashboard** - Overview and statistics
- **📤 Upload Invoice** - Upload new invoices
- **📋 Invoices** - View all invoices
- **🔍 Fraud Detection** - Fraud analysis results
- **📊 Analytics** - Fraud statistics and charts
- **⚙️ Settings** - Manage vendors and users

---

## 🏢 Setting Up Vendors

### Step 4: Create a Vendor

Before uploading invoices, you need to create vendors:

1. Go to **Settings** (⚙️) in the sidebar
2. Look for **"Vendors"** or **"Manage Vendors"** section
3. Click **"Add Vendor"** or **"Create New Vendor"**
4. Fill in vendor details:
   - **Name:** ABC Suppliers Ltd
   - **Tax ID/GSTIN:** 27AABCU9603R1ZM
   - **Email:** contact@abc-suppliers.com
   - **Phone:** +91-9876543210
   - **Address:** 123 Business Park, Mumbai, Maharashtra
5. Click **"Save"** or **"Create Vendor"**

**Create 2-3 vendors** for better testing.

---

## 📤 Uploading Invoices

### Step 5: Upload Your First Invoice

1. Go to **Upload Invoice** (📤) in the sidebar
2. You'll see an upload form with:
   - **File Upload** - Select your invoice PDF/image
   - **Vendor** - Select from dropdown
   - **Invoice Details** - Manual entry fields

3. **Choose one of two methods:**

#### Method A: Upload File Only
- Click **"Choose File"** or drag & drop
- Select any PDF or image file (invoice document)
- The system will try to extract data using OCR
- Click **"Upload"**

#### Method B: Upload with Manual Data Entry
- Upload the file
- Fill in the invoice details:
  - **Invoice Number:** INV-2024-001
  - **Vendor:** Select ABC Suppliers Ltd
  - **Invoice Date:** 2024-01-15
  - **Due Date:** 2024-02-15
  - **Subtotal:** ₹10,000.00
  - **Tax/GST:** ₹1,800.00
  - **Total Amount:** ₹11,800.00
  - **Currency:** INR
- Click **"Save"** or **"Submit"**

---

## 🔍 Running Fraud Detection

### Step 6: View Invoices

1. Go to **Invoices** (📋) in the sidebar
2. You'll see a list of all uploaded invoices
3. Each invoice shows:
   - Invoice number
   - Vendor name
   - Amount
   - Date
   - Status

### Step 7: Run Fraud Detection on an Invoice

**Option 1: From Invoice List**
- Find your invoice in the list
- Click **"Analyze"** or **"Run Fraud Detection"** button
- Wait for analysis to complete

**Option 2: From Invoice Detail Page**
- Click on an invoice to open its detail page
- Look for **"Run Fraud Detection"** or **"Analyze for Fraud"** button
- Click it and wait for results

### Step 8: View Fraud Detection Results

After analysis completes, you should see:

#### **Risk Assessment:**
- **Risk Score:** 0-100 (displayed as a number or gauge)
  - 0-25: 🟢 LOW Risk
  - 25-50: 🟡 MEDIUM Risk
  - 50-75: 🟠 HIGH Risk
  - 75-100: 🔴 CRITICAL Risk

#### **Risk Level Badge:**
- Color-coded indicator (Green/Yellow/Orange/Red)

#### **Fraud Flags:**
A list of detected issues, each showing:
- **Flag Type:** (e.g., "Duplicate Invoice", "Invalid Tax")
- **Severity:** Critical/High/Medium/Low
- **Description:** What was detected
- **Evidence:** Supporting details

#### **Example Results:**
```
🟢 Risk Score: 15 (LOW)
Flags Detected: 2
├─ 🟡 NEW_VENDOR (Medium)
│  └─ "New vendor with only 1 invoice(s) in system"
└─ ℹ️ WEEKEND_INVOICE_DATE (Info)
   └─ "Invoice is dated on a weekend (Saturday)"
```

---

## 🧪 Testing Different Fraud Scenarios

### Scenario 1: Normal Invoice (Should be LOW risk)
Create an invoice with:
- Valid invoice number: INV-2024-001
- Valid dates
- Correct tax calculation (18% GST)
- Reasonable amount: ₹11,800

**Expected:** LOW risk, maybe 1-2 info flags

---

### Scenario 2: Duplicate Invoice (Should be CRITICAL) 🔴

1. Create Invoice #1:
   - Invoice Number: **INV-DUP-001**
   - Vendor: ABC Suppliers
   - Amount: ₹10,000
   - Save it

2. Create Invoice #2:
   - Invoice Number: **INV-DUP-001** (same!)
   - Vendor: ABC Suppliers (same!)
   - Amount: ₹10,000
   - Save it

3. Run fraud detection on Invoice #2

**Expected Results:**
- 🔴 Risk Level: **CRITICAL**
- Flag: **DUPLICATE_INVOICE**
- Message: "Duplicate invoice detected: Invoice #INV-DUP-001 already exists for this vendor"
- Evidence: Shows the ID of the first invoice

---

### Scenario 3: Invalid Tax Rate (Should be HIGH) 🟠

Create an invoice with:
- Subtotal: ₹5,000
- Tax: ₹750 (This is 15% - INVALID for GST!)
- Total: ₹5,750

**Expected Results:**
- 🟠 Risk Level: **HIGH**
- Flag: **INVALID_GST_RATE**
- Message: "Tax rate (15%) does not match standard GST rates"
- Valid rates: 5%, 12%, 18%, 28%

---

### Scenario 4: Future-Dated Invoice (Should be HIGH) 🟠

Create an invoice with:
- Invoice Date: **2025-12-31** (future date!)
- Other fields: normal

**Expected Results:**
- 🟠 Risk Level: **HIGH**
- Flag: **FUTURE_INVOICE_DATE**
- Message: "Invoice date is X days in the future"

---

### Scenario 5: Round Amount (Should be MEDIUM) 🟡

Create an invoice with:
- Total Amount: **₹100,000.00** (suspiciously round!)
- Other fields: normal

**Expected Results:**
- 🟡 Risk Level: **MEDIUM**
- Flag: **SUSPICIOUSLY_ROUND_AMOUNT**
- Message: "Invoice amount is a suspiciously round number"

---

### Scenario 6: Missing Tax on High Value (Should be HIGH) 🟠

Create an invoice with:
- Subtotal: ₹50,000
- Tax: **₹0** (no tax on high value!)
- Total: ₹50,000

**Expected Results:**
- 🟠 Risk Level: **HIGH**
- Flag: **MISSING_TAX_HIGH_VALUE**
- Message: "High-value invoice has no tax applied"

---

### Scenario 7: Due Date Before Invoice Date (Should be HIGH) 🟠

Create an invoice with:
- Invoice Date: 2024-02-01
- Due Date: **2024-01-15** (before invoice date!)

**Expected Results:**
- 🟠 Risk Level: **HIGH**
- Flag: **DUE_BEFORE_INVOICE**
- Message: "Due date is before invoice date"

---

## 📊 Viewing Analytics

### Step 9: Check Fraud Analytics

1. Go to **Analytics** (📊) in the sidebar
2. You should see:

#### **Dashboard Overview:**
- Total invoices analyzed
- Risk distribution chart (pie/bar chart)
- Recent high-risk invoices

#### **Statistics:**
- **By Risk Level:**
  - Low Risk: X invoices
  - Medium Risk: Y invoices
  - High Risk: Z invoices
  - Critical Risk: W invoices

- **By Fraud Type:**
  - Most common fraud patterns
  - Frequency of each fraud type

#### **Trends:**
- Fraud detection over time
- Risk score trends
- Vendor-wise analysis

#### **High-Risk Invoices:**
- List of invoices with HIGH or CRITICAL risk
- Quick view of main concerns

---

## 🔍 Fraud Detection Page

### Step 10: Explore Dedicated Fraud Detection View

1. Go to **Fraud Detection** (🔍) in the sidebar
2. This page shows:
   - **All analyzed invoices** with their risk levels
   - **Filter options:**
     - By risk level (LOW/MEDIUM/HIGH/CRITICAL)
     - By date range
     - By vendor
   - **Quick actions:**
     - Re-analyze invoice
     - View details
     - Export report

---

## 🎯 Quick Testing Checklist

Use this checklist to verify all fraud detection features:

- [ ] ✅ Create user account and login
- [ ] ✅ Create 2-3 vendors
- [ ] ✅ Upload normal invoice → Should be LOW risk
- [ ] 🔴 Upload duplicate invoice → Should be CRITICAL
- [ ] 🟠 Upload invoice with invalid tax → Should be HIGH
- [ ] 🟠 Upload future-dated invoice → Should be HIGH
- [ ] 🟡 Upload round amount invoice → Should be MEDIUM
- [ ] 🟠 Upload high-value with no tax → Should be HIGH
- [ ] 🟠 Upload with reversed dates → Should be HIGH
- [ ] 📊 View analytics dashboard
- [ ] 📋 Check high-risk invoice list
- [ ] 🔍 Filter invoices by risk level

---

## 💡 Tips for Testing

1. **Create Multiple Vendors:**
   - This helps test vendor-specific fraud patterns
   - Try creating invoices with different vendors

2. **Upload Several Invoices:**
   - First invoice from a vendor: Will flag "NEW_VENDOR"
   - Multiple invoices: Can test anomaly detection
   - Similar amounts/dates: Can test similarity detection

3. **Use Realistic Data:**
   - Real invoice numbers (INV-2024-001, etc.)
   - Valid dates
   - Realistic amounts for your region

4. **Test Edge Cases:**
   - Very old dates (>2 years ago)
   - Weekend dates
   - Exactly matching amounts
   - Sequential invoice numbers

5. **Review Results Carefully:**
   - Each flag has evidence - click to see details
   - Risk score explanation
   - Recommendations for action

---

## 🐛 Troubleshooting

### Can't Login?
- Check if you created the account
- Try using API docs to verify credentials
- Check browser console for errors (F12)

### Invoice Upload Fails?
- Check file size (should be < 10MB)
- Supported formats: PDF, PNG, JPG
- Make sure vendor exists first

### Fraud Detection Not Running?
- Make sure invoice status is "ANALYSIS_READY"
- Check that invoice has required fields filled
- Try refreshing the page

### No Fraud Flags Showing?
- This is normal for legitimate invoices!
- LOW risk invoices might have 0-2 minor flags
- Try creating the test scenarios above

### Analytics Page Empty?
- You need to run fraud detection on at least one invoice first
- Make sure you're logged in
- Try refreshing the page

---

## 📱 Navigation Guide

**Main Menu Structure:**
```
FraudEx
├─ 📈 Dashboard (Overview)
├─ 📤 Upload Invoice (Create new)
├─ 📋 Invoices (View all)
│  └─ Click invoice → Detail page
│     └─ "Run Fraud Detection" button
├─ 🔍 Fraud Detection (Analysis results)
├─ 📊 Analytics (Statistics & charts)
└─ ⚙️ Settings
   ├─ Vendors
   ├─ Users
   └─ Configuration
```

---

## 🎉 Success Indicators

You'll know fraud detection is working when:

1. ✅ You can create and view invoices
2. ✅ "Run Fraud Detection" button works
3. ✅ Risk score appears (0-100)
4. ✅ Risk level badge shows (colored)
5. ✅ Fraud flags list appears
6. ✅ Analytics show statistics
7. ✅ Duplicate invoices get CRITICAL risk
8. ✅ Invalid tax gets HIGH risk

---

## 📞 Need More Help?

- Check API documentation: http://localhost:8000/docs
- Look at backend logs in terminal
- Check browser console (F12) for frontend errors
- Review TESTING_GUIDE.md for API-level testing

---

**Happy Testing! 🚀**

Remember: The goal is to see different risk levels based on the invoice data you enter. Try the test scenarios above to see how the fraud detection responds to different patterns!
