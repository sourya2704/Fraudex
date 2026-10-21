"""
Generate a fictional, clearly-marked SAMPLE invoice that trips several
FrauDex fraud rules, for demos and testing.

    backend/venv/bin/python scripts/make_fake_invoice.py

Writes sample_invoices/invoice_7_fraud_demo.pdf. The vendor, buyer and GSTINs
are invented; the footer marks the document as a test sample.

Fraud signals built in:
  - 21% GST (10.5% CGST + 10.5% SGST): not a valid GST rate  -> INVALID_GST_RATE
  - total Rs. 99,220, just under a Rs. 1,00,000 approval limit -> AMOUNT_BELOW_THRESHOLD
  - due date before the invoice date                        -> DUE_DATE_BEFORE_INVOICE
  - a vendor with no history                                -> NEW_VENDOR
"""

import os

import pymupdf as fitz

OUT = os.path.join(os.path.dirname(__file__), "..", "sample_invoices", "invoice_7_fraud_demo.pdf")

INK, MUTED, ACCENT, RED = (0.10, 0.10, 0.08), (0.45, 0.45, 0.40), (0.33, 0.44, 0.04), (0.78, 0.12, 0.18)


def text(page, x, y, s, size=10, bold=False, color=INK, font=None):
    page.insert_text((x, y), s, fontsize=size, fontname=font or ("hebo" if bold else "helv"), color=color)


def main():
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4

    # Supplier (fictional)
    text(page, 50, 70, "NIMBUS OFFICE SOLUTIONS PVT LTD", 16, True)
    text(page, 50, 88, "Plot 14, Sector 9, Industrial Area, Noida, Uttar Pradesh 201301", 9, color=MUTED)
    text(page, 50, 102, "GSTIN: 09AAKCN4821M1ZQ", 9, color=MUTED)
    text(page, 400, 70, "TAX INVOICE", 18, True, ACCENT)

    # Invoice meta: label alone on its line, value on the next (like the other samples)
    y = 140
    for label, value in [("Invoice Number:", "NOS/2026/0007"),
                         ("Invoice Date:", "12-10-2026"),
                         ("Due Date:", "28-09-2026")]:
        text(page, 400, y, label, 9, color=MUTED)
        text(page, 400, y + 13, value, 10, True)
        y += 32

    # Buyer (fictional)
    text(page, 50, 140, "BILL TO:", 9, True, MUTED)
    text(page, 50, 155, "Lumen Retail Pvt Ltd", 10, True)
    text(page, 50, 169, "22 MG Road, Pune, Maharashtra 411001", 9, color=MUTED)
    text(page, 50, 183, "GSTIN 27AAACL7314Q1ZK", 9, color=MUTED)

    # Line items
    y = 250
    page.draw_line((50, y - 14), (545, y - 14), color=MUTED, width=0.6)
    text(page, 50, y, f"{'DESCRIPTION':<34}{'QTY':>4}{'RATE':>14}{'AMOUNT':>14}", 10, color=MUTED, font="cour")
    page.draw_line((50, y + 8), (545, y + 8), color=MUTED, width=0.6)
    rows = [("Ergonomic office chairs", "20", "2,500.00", "50,000.00"),
            ("Standing desk frames", "8", "3,250.00", "26,000.00"),
            ("Installation and setup", "1", "6,000.00", "6,000.00")]
    y += 28
    for d, q, r, a in rows:
        # One string per row: separately placed cells come out of the PDF's
        # text layer one per line, and the parser reads items row by row.
        text(page, 50, y, f"{d:<34}{q:>4}{r:>14}{a:>14}", 10, font="cour")
        y += 22
    page.draw_line((50, y - 8), (545, y - 8), color=MUTED, width=0.6)

    # Totals
    y += 14
    for label, value, bold in [("Subtotal:", "Rs. 82,000.00", False),
                               ("CGST @ 10.5%:", "Rs. 8,610.00", False),
                               ("SGST @ 10.5%:", "Rs. 8,610.00", False),
                               ("Grand Total:", "Rs. 99,220.00", True)]:
        text(page, 350, y, label, 10, bold)
        text(page, 455, y, value, 10, bold)
        y += 18

    text(page, 50, y + 30, "Payment: bank transfer to account 50200014467781, IFSC SMPL0000123 (sample)", 9, color=MUTED)

    # Clearly marked as a test document
    page.draw_rect(fitz.Rect(50, 770, 545, 800), color=RED, width=1)
    text(page, 62, 789, "SAMPLE - FICTIONAL COMPANIES - FOR FRAUDEX TESTING ONLY - NOT A REAL INVOICE", 9, True, RED)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    doc.save(OUT)
    print("wrote", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
