from datetime import date
from decimal import Decimal

from app.extraction.parser import normalize_gstin, parse_invoice_text

GST_INVOICE = """ACME Traders Pvt Ltd
GSTIN: 27AAPFU0939F1ZV
Tax Invoice
Invoice No: ACM/24-25/0012      Invoice Date: 05-Aug-2026
Due Date: 04/09/2026
Bill To:
Buyer Ltd  GSTIN 29AABCU9603R1ZM
Description          Qty   Rate     Amount
Laptop stand          2    1500.00  3000.00
USB-C hub 18%         1    2000.00  2000.00
Taxable Value: 5,000.00
CGST @ 9%: 450.00
SGST @ 9%: 450.00
Total Amount: 5,900.00
"""


def test_cgst_sgst_are_summed_and_rate_is_not_read_as_amount():
    fields = parse_invoice_text(GST_INVOICE)["fields"]
    assert fields["tax"] == Decimal("900.00")
    assert fields["subtotal"] == Decimal("5000.00")
    assert fields["total_amount"] == Decimal("5900.00")


def test_dates_on_shared_line_and_currency_inferred_from_gstin():
    fields = parse_invoice_text(GST_INVOICE)["fields"]
    assert fields["invoice_number"] == "ACM/24-25/0012"
    assert fields["invoice_date"] == date(2026, 8, 5)
    assert fields["due_date"] == date(2026, 9, 4)
    assert fields["currency"] == "INR"


def test_supplier_gstin_is_not_the_buyer_gstin():
    vendor = parse_invoice_text(GST_INVOICE)["vendor"]
    assert vendor == {"gstin": "27AAPFU0939F1ZV", "name": "ACME Traders Pvt Ltd"}


def test_line_items_are_extracted():
    items = parse_invoice_text(GST_INVOICE)["line_items"]
    assert [i["line_total"] for i in items] == [Decimal("3000.00"), Decimal("2000.00")]
    assert items[0]["quantity"] == Decimal("2")


def test_rupee_rendered_as_I_and_specific_label_beats_footnote():
    text = "Subtotal:\nI50,000.00\nGST:\nI0.00\nTOTAL:\nI50,000.00\nNote: TAX - I50,000 invoice"
    fields = parse_invoice_text(text)["fields"]
    assert fields["subtotal"] == Decimal("50000.00")
    assert fields["tax"] == Decimal("0.00")
    assert fields["total_amount"] == Decimal("50000.00")


def test_hash_in_invoice_number_is_not_a_currency():
    assert parse_invoice_text("Invoice #7\nTotal 100.00")["fields"]["currency"] is None


def test_normalize_gstin_strips_label():
    assert normalize_gstin("GSTIN27APEXC1234F1Z5") == "27APEXC1234F1Z5"
