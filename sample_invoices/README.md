# Sample Invoice Files for Testing FraudEx

## 📁 Available Test Invoices

### 1. **sample_invoice_1.txt** - ✅ NORMAL INVOICE
- **Invoice Number:** INV-2024-001
- **Vendor:** ABC Suppliers Ltd
- **Amount:** ₹11,800 (₹10,000 + 18% GST)
- **Expected Result:** 🟢 LOW risk
- **Use for:** Testing normal, legitimate invoice flow

---

### 2. **duplicate_invoice.txt** - 🔴 DUPLICATE
- **Invoice Number:** INV-2024-001 (SAME AS #1!)
- **Vendor:** ABC Suppliers Ltd (SAME!)
- **Expected Result:** 🔴 CRITICAL risk
- **Fraud Flags:** DUPLICATE_INVOICE
- **Use for:** Testing duplicate detection

**How to test:**
1. Upload sample_invoice_1.txt first
2. Then upload duplicate_invoice.txt
3. Both will have same invoice number + vendor
4. Second one should get CRITICAL alert

---

### 3. **suspicious_invoice_invalid_tax.txt** - 🟠 INVALID TAX
- **Invoice Number:** INV-2024-002
- **Vendor:** DEF Traders Pvt Ltd
- **Tax Rate:** 15% (INVALID!)
- **Expected Result:** 🟠 HIGH risk
- **Fraud Flags:** INVALID_GST_RATE
- **Use for:** Testing tax validation

**Note:** Valid GST rates are 5%, 12%, 18%, 28%

---

### 4. **suspicious_round_amount.txt** - 🟡 ROUND AMOUNT
- **Invoice Number:** INV-2024-003
- **Vendor:** GHI Enterprises
- **Amount:** ₹100,000 (very round!)
- **Expected Result:** 🟡 MEDIUM risk
- **Fraud Flags:** SUSPICIOUSLY_ROUND_AMOUNT
- **Use for:** Testing anomaly detection

---

### 5. **future_dated_invoice.txt** - 🟠 FUTURE DATE
- **Invoice Number:** INV-2025-001
- **Date:** 31-12-2025 (in the future!)
- **Expected Result:** 🟠 HIGH risk
- **Fraud Flags:** FUTURE_INVOICE_DATE
- **Use for:** Testing date validation

---

### 6. **high_value_no_tax.txt** - 🟠 NO TAX
- **Invoice Number:** INV-2024-004
- **Amount:** ₹50,000 with ₹0 tax
- **Expected Result:** 🟠 HIGH risk
- **Fraud Flags:** MISSING_TAX_HIGH_VALUE
- **Use for:** Testing tax requirement validation

---

## 🧪 Testing Workflow

### Using Frontend (Website):

1. **Open:** http://localhost:5173
2. **Login** with your account
3. **Create vendors** first (Settings page):
   - ABC Suppliers Ltd (GSTIN: 27AABCU9603R1ZM)
   - DEF Traders Pvt Ltd (GSTIN: 07AABCD1234E1ZF)
   - GHI Enterprises (GSTIN: 06AABCE5678F1ZG)
   - JKL Services Ltd (GSTIN: 29AABCJ9012K1ZH)
   - MNO Trading Co. (GSTIN: 27AABMN3456P1ZI)

4. **Upload invoices:**
   - Go to Upload Invoice page
   - Select file
   - Or manually enter the data from the invoice

5. **Run fraud detection:**
   - Go to Invoices page
   - Click on invoice
   - Click "Run Fraud Detection"
   - View results!

### Using API (http://localhost:8000/docs):

1. Create user and login (get token)
2. Authorize with token
3. Create vendors
4. Upload these files via POST /invoices/upload
5. Run POST /invoices/{id}/detect-fraud
6. View GET /invoices/{id}/fraud-detection

---

## 📊 Expected Results Summary

| File | Risk Level | Main Fraud Flag | Severity |
|------|------------|-----------------|----------|
| sample_invoice_1.txt | 🟢 LOW | NEW_VENDOR (maybe) | Low |
| duplicate_invoice.txt | 🔴 CRITICAL | DUPLICATE_INVOICE | Critical |
| suspicious_invoice_invalid_tax.txt | 🟠 HIGH | INVALID_GST_RATE | High |
| suspicious_round_amount.txt | 🟡 MEDIUM | SUSPICIOUSLY_ROUND_AMOUNT | Medium |
| future_dated_invoice.txt | 🟠 HIGH | FUTURE_INVOICE_DATE | High |
| high_value_no_tax.txt | 🟠 HIGH | MISSING_TAX_HIGH_VALUE | High |

---

## 💡 Tips

- Upload invoices in order (1 through 6) for best results
- Create all vendors before uploading invoices
- Check Analytics page after running multiple fraud detections
- Try uploading same file twice to test duplicate detection
- Modify dates/amounts when entering data to test different scenarios

---

## 🎯 Quick Test Scenarios

**Scenario A - Happy Path:**
1. Upload sample_invoice_1.txt → Should be LOW risk ✅

**Scenario B - Duplicate Detection:**
1. Upload sample_invoice_1.txt
2. Upload duplicate_invoice.txt
3. Second should be CRITICAL 🔴

**Scenario C - Multiple Fraud Patterns:**
1. Upload all 6 files
2. Run fraud detection on all
3. Check Analytics to see risk distribution
4. View high-risk invoice list

---

**All files are ready to use! Just upload and test! 🚀**
