#!/bin/bash

# FraudEx - Quick Test Data Setup Script
# This script creates sample data to test fraud detection features

echo "🚀 FraudEx Fraud Detection Test Data Setup"
echo "=========================================="
echo ""

API_URL="http://localhost:8000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Create Admin User
echo -e "${YELLOW}Step 1: Creating admin user...${NC}"
USER_RESPONSE=$(curl -s -X POST "$API_URL/users/" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fraudex.com",
    "password": "admin123",
    "full_name": "Admin User",
    "role": "ADMIN"
  }')

if echo "$USER_RESPONSE" | grep -q "email"; then
    echo -e "${GREEN}✓ User created successfully${NC}"
    USER_ID=$(echo $USER_RESPONSE | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
    echo "  User ID: $USER_ID"
else
    echo -e "${RED}✗ User may already exist or error occurred${NC}"
fi
echo ""

# Step 2: Login
echo -e "${YELLOW}Step 2: Logging in...${NC}"
TOKEN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@fraudex.com&password=admin123")

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ Login failed! Please check if the user exists and credentials are correct.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "  Token: ${TOKEN:0:20}..."
echo ""

# Step 3: Create Vendors
echo -e "${YELLOW}Step 3: Creating test vendors...${NC}"

# Vendor 1 - ABC Suppliers
VENDOR1=$(curl -s -X POST "$API_URL/vendors/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Suppliers Ltd",
    "tax_id": "27AABCU9603R1ZM",
    "email": "contact@abc-suppliers.com",
    "phone": "+91-9876543210",
    "address": "123 Business Park, Mumbai, Maharashtra"
  }')

VENDOR1_ID=$(echo $VENDOR1 | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
echo -e "${GREEN}✓ Vendor 1 created: ABC Suppliers Ltd (ID: $VENDOR1_ID)${NC}"

# Vendor 2 - XYZ Services
VENDOR2=$(curl -s -X POST "$API_URL/vendors/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "XYZ Services Pvt Ltd",
    "tax_id": "29AABCU9604R1ZN",
    "email": "info@xyz-services.com",
    "phone": "+91-9876543211",
    "address": "456 Tech Valley, Bangalore, Karnataka"
  }')

VENDOR2_ID=$(echo $VENDOR2 | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
echo -e "${GREEN}✓ Vendor 2 created: XYZ Services Pvt Ltd (ID: $VENDOR2_ID)${NC}"
echo ""

# Step 4: Create Test Invoices
echo -e "${YELLOW}Step 4: Creating test invoices with various fraud patterns...${NC}"

# Create dummy file for upload
echo "Sample Invoice" > /tmp/test_invoice.txt

# Function to create and update invoice
create_invoice() {
    local invoice_data=$1
    local description=$2
    
    # Upload invoice
    UPLOAD=$(curl -s -X POST "$API_URL/invoices/upload" \
      -H "Authorization: Bearer $TOKEN" \
      -F "file=@/tmp/test_invoice.txt")
    
    INVOICE_ID=$(echo $UPLOAD | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
    
    if [ -z "$INVOICE_ID" ]; then
        echo -e "${RED}  ✗ Failed to create invoice${NC}"
        return
    fi
    
    # Update invoice with data
    curl -s -X PUT "$API_URL/invoices/$INVOICE_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$invoice_data" > /dev/null
    
    echo -e "${GREEN}  ✓ Invoice $INVOICE_ID: $description${NC}"
    echo "$INVOICE_ID"
}

# Invoice 1 - Normal legitimate invoice
INV1=$(create_invoice '{
  "invoice_number": "INV-2024-001",
  "vendor_id": '$VENDOR1_ID',
  "invoice_date": "2024-01-15",
  "due_date": "2024-02-15",
  "subtotal": 10000.00,
  "tax": 1800.00,
  "total_amount": 11800.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}' "Normal invoice (should be LOW risk)")

# Invoice 2 - DUPLICATE of Invoice 1 (CRITICAL)
INV2=$(create_invoice '{
  "invoice_number": "INV-2024-001",
  "vendor_id": '$VENDOR1_ID',
  "invoice_date": "2024-01-16",
  "due_date": "2024-02-16",
  "subtotal": 10000.00,
  "tax": 1800.00,
  "total_amount": 11800.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}' "DUPLICATE invoice number (CRITICAL)")

# Invoice 3 - Suspiciously round amount
INV3=$(create_invoice '{
  "invoice_number": "INV-2024-002",
  "vendor_id": '$VENDOR1_ID',
  "invoice_date": "2024-01-20",
  "due_date": "2024-02-20",
  "subtotal": 100000.00,
  "tax": 18000.00,
  "total_amount": 118000.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}' "Round amount ₹100,000 (suspicious)")

# Invoice 4 - Invalid GST rate (15%)
INV4=$(create_invoice '{
  "invoice_number": "INV-2024-003",
  "vendor_id": '$VENDOR1_ID',
  "invoice_date": "2024-01-25",
  "due_date": "2024-02-25",
  "subtotal": 5000.00,
  "tax": 750.00,
  "total_amount": 5750.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}' "Invalid tax rate 15% (HIGH)")

# Invoice 5 - Future dated invoice
INV5=$(create_invoice '{
  "invoice_number": "INV-2025-001",
  "vendor_id": '$VENDOR1_ID',
  "invoice_date": "2025-12-31",
  "due_date": "2026-01-31",
  "subtotal": 8000.00,
  "tax": 1440.00,
  "total_amount": 9440.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}' "Future-dated invoice (HIGH)")

# Invoice 6 - Missing tax on high value
INV6=$(create_invoice '{
  "invoice_number": "INV-2024-004",
  "vendor_id": '$VENDOR2_ID',
  "invoice_date": "2024-01-28",
  "due_date": "2024-02-28",
  "subtotal": 50000.00,
  "tax": 0.00,
  "total_amount": 50000.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}' "High value with no tax (HIGH)")

# Invoice 7 - Due date before invoice date
INV7=$(create_invoice '{
  "invoice_number": "INV-2024-005",
  "vendor_id": '$VENDOR2_ID',
  "invoice_date": "2024-02-01",
  "due_date": "2024-01-15",
  "subtotal": 7000.00,
  "tax": 1260.00,
  "total_amount": 8260.00,
  "currency": "INR",
  "status": "ANALYSIS_READY"
}' "Due date before invoice date (HIGH)")

echo ""

# Step 5: Run Fraud Detection on all invoices
echo -e "${YELLOW}Step 5: Running fraud detection on all invoices...${NC}"

run_fraud_detection() {
    local inv_id=$1
    if [ ! -z "$inv_id" ]; then
        RESULT=$(curl -s -X POST "$API_URL/invoices/$inv_id/detect-fraud" \
          -H "Authorization: Bearer $TOKEN")
        
        RISK_LEVEL=$(echo $RESULT | grep -o '"risk_level":"[^"]*' | grep -o '[^"]*$')
        RISK_SCORE=$(echo $RESULT | grep -o '"risk_score":[0-9.]*' | grep -o '[0-9.]*$')
        FLAG_COUNT=$(echo $RESULT | grep -o '"fraud_flags":\[' | wc -l)
        
        if [ ! -z "$RISK_LEVEL" ]; then
            echo -e "  Invoice $inv_id: ${GREEN}Risk: $RISK_LEVEL${NC} (Score: $RISK_SCORE)"
        fi
    fi
}

run_fraud_detection "$INV1"
run_fraud_detection "$INV2"
run_fraud_detection "$INV3"
run_fraud_detection "$INV4"
run_fraud_detection "$INV5"
run_fraud_detection "$INV6"
run_fraud_detection "$INV7"

echo ""
echo -e "${GREEN}=========================================="
echo "✅ Test Data Setup Complete!"
echo -e "==========================================${NC}"
echo ""
echo "📊 Summary:"
echo "  - Users: 1 admin user created"
echo "  - Vendors: 2 vendors created"
echo "  - Invoices: 7 test invoices with various fraud patterns"
echo ""
echo "🔍 Next Steps:"
echo "  1. Open API docs: http://localhost:8000/docs"
echo "  2. Click 'Authorize' and paste this token:"
echo "     $TOKEN"
echo ""
echo "  3. Test these endpoints:"
echo "     - GET /fraud/statistics"
echo "     - GET /fraud/high-risk-invoices"
echo "     - GET /invoices/$INV2/fraud-detection (duplicate)"
echo "     - GET /invoices/$INV5/fraud-detection (future date)"
echo ""
echo "📖 Full testing guide: See TESTING_GUIDE.md"
echo ""

# Cleanup
rm -f /tmp/test_invoice.txt
