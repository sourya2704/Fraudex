"""
Seed 1000 realistic demo invoices for fraud detection training/testing.

Run from the backend directory:
    python scripts/seed_demo_invoices.py

Creates 10 vendors × ~100 invoices each = ~1000 invoices.
Includes a few deliberate fraud scenarios so the detection rules can be verified.
"""

import os
import sys
import random
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.database.connection import SessionLocal, engine, Base
from app.models.vendor import Vendor
from app.models.invoice import Invoice, InvoiceStatus
from app.models import *   # ensure all models are registered

random.seed(42)

Base.metadata.create_all(bind=engine)

def d(value: float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def random_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))

def make_invoice_number(prefix: str, n: int) -> str:
    return f"{prefix}-{n:04d}"

# ----- Vendor profiles -------------------------------------------------------
# Each vendor has a realistic amount range, typical GST rate, and invoice count.

VENDOR_PROFILES = [
    {
        "name": "Apex Cloud Technologies Pvt Ltd",
        "tax_id": "GSTIN27APEXC1234F1Z5",
        "email": "billing@apexcloud.in",
        "phone": "+91-9800001001",
        "address": "Pune, Maharashtra",
        "inv_prefix": "ACT",
        "count": 110,
        "min_amt": 50000,
        "max_amt": 500000,
        "gst_rate": 0.18,
    },
    {
        "name": "Horizon Logistics & Supply Co",
        "tax_id": "GSTIN29HORIZ5678K2A3",
        "email": "accounts@horizonlog.com",
        "phone": "+91-9800002002",
        "address": "Bengaluru, Karnataka",
        "inv_prefix": "HLS",
        "count": 105,
        "min_amt": 20000,
        "max_amt": 200000,
        "gst_rate": 0.12,
    },
    {
        "name": "Meridian Consulting Services",
        "tax_id": "GSTIN07MERID9012P3B6",
        "email": "finance@meridianconsult.in",
        "phone": "+91-9800003003",
        "address": "New Delhi",
        "inv_prefix": "MCS",
        "count": 95,
        "min_amt": 75000,
        "max_amt": 750000,
        "gst_rate": 0.18,
    },
    {
        "name": "Bharat Fabricators Ltd",
        "tax_id": "GSTIN24BHARF3456Q4C7",
        "email": "billing@bharatfab.com",
        "phone": "+91-9800004004",
        "address": "Surat, Gujarat",
        "inv_prefix": "BFL",
        "count": 90,
        "min_amt": 30000,
        "max_amt": 300000,
        "gst_rate": 0.28,
    },
    {
        "name": "Saffron Digital Media",
        "tax_id": "GSTIN27SAFFR7890M5D8",
        "email": "invoices@saffrondigital.in",
        "phone": "+91-9800005005",
        "address": "Mumbai, Maharashtra",
        "inv_prefix": "SDM",
        "count": 100,
        "min_amt": 15000,
        "max_amt": 150000,
        "gst_rate": 0.18,
    },
    {
        "name": "NorthStar Export Solutions",
        "tax_id": "GSTIN33NORTH2345N6E9",
        "email": "billing@northstarexp.com",
        "phone": "+91-9800006006",
        "address": "Chennai, Tamil Nadu",
        "inv_prefix": "NES",
        "count": 85,
        "min_amt": 100000,
        "max_amt": 1000000,
        "gst_rate": 0.00,  # exports — zero GST
    },
    {
        "name": "Greenfield Infrastructure Pvt Ltd",
        "tax_id": "GSTIN36GREEN6789G7F1",
        "email": "accounts@greenfieldinfra.in",
        "phone": "+91-9800007007",
        "address": "Hyderabad, Telangana",
        "inv_prefix": "GIP",
        "count": 80,
        "min_amt": 200000,
        "max_amt": 2000000,
        "gst_rate": 0.18,
    },
    {
        "name": "Rapid Pharma Distributors",
        "tax_id": "GSTIN09RAPID1234R8G2",
        "email": "billing@rapidpharma.in",
        "phone": "+91-9800008008",
        "address": "Lucknow, Uttar Pradesh",
        "inv_prefix": "RPD",
        "count": 95,
        "min_amt": 25000,
        "max_amt": 250000,
        "gst_rate": 0.12,
    },
    {
        "name": "Pinnacle HR Solutions",
        "tax_id": "GSTIN27PINNA5678H9I3",
        "email": "finance@pinnacle-hr.com",
        "phone": "+91-9800009009",
        "address": "Pune, Maharashtra",
        "inv_prefix": "PHS",
        "count": 120,
        "min_amt": 40000,
        "max_amt": 400000,
        "gst_rate": 0.18,
    },
    {
        "name": "Sunrise Catering Services",
        "tax_id": "GSTIN27SUNRI9012S0J4",
        "email": "billing@sunrisecatering.in",
        "phone": "+91-9800010010",
        "address": "Mumbai, Maharashtra",
        "inv_prefix": "SCS",
        "count": 100,
        "min_amt": 10000,
        "max_amt": 100000,
        "gst_rate": 0.05,
    },
]

START_DATE = date(2025, 1, 1)
END_DATE   = date(2026, 9, 30)


def generate_amount(min_amt: int, max_amt: int) -> tuple[Decimal, Decimal, Decimal]:
    """Return (subtotal, tax, total) with realistic variation."""
    # Use log-normal distribution so most invoices cluster near the lower end
    import math
    log_min = math.log(min_amt)
    log_max = math.log(max_amt)
    log_mean = (log_min + log_max) / 2
    log_std  = (log_max - log_min) / 4
    raw = random.lognormvariate(log_mean, log_std)
    raw = max(min_amt, min(max_amt, raw))
    # Round to nearest 100 to make amounts realistic
    subtotal = d(round(raw / 100) * 100)
    return subtotal


def build_invoice(
    vendor_id: int,
    inv_number: str,
    subtotal: Decimal,
    gst_rate: float,
    inv_date: date,
    status: str = InvoiceStatus.DECIDED.value,
) -> Invoice:
    tax = d(float(subtotal) * gst_rate)
    total = subtotal + tax
    due = inv_date + timedelta(days=random.choice([15, 30, 45, 60]))
    return Invoice(
        vendor_id=vendor_id,
        invoice_number=inv_number,
        invoice_date=inv_date,
        due_date=due,
        subtotal=subtotal,
        tax=tax,
        total_amount=total,
        currency="INR",
        status=status,
    )


def seed():
    db = SessionLocal()
    try:
        # Remove existing seed data
        existing = db.query(Vendor).filter(
            Vendor.tax_id.like("GSTIN%")
        ).all()
        if existing:
            print(f"Removing {len(existing)} existing seed vendors and their invoices...")
            for v in existing:
                db.query(Invoice).filter(Invoice.vendor_id == v.id).delete()
                db.delete(v)
            db.commit()

        total_invoices = 0
        fraud_scenarios = []

        for profile in VENDOR_PROFILES:
            # Create vendor
            vendor = Vendor(
                name=profile["name"],
                tax_id=profile["tax_id"],
                email=profile["email"],
                phone=profile["phone"],
                address=profile["address"],
            )
            db.add(vendor)
            db.flush()  # get vendor.id

            invoices_created = 0
            prefix = profile["inv_prefix"]
            count = profile["count"]
            gst = profile["gst_rate"]

            # Generate normal invoices
            for i in range(1, count + 1):
                subtotal = generate_amount(profile["min_amt"], profile["max_amt"])
                inv_date = random_date(START_DATE, END_DATE)
                inv_num = make_invoice_number(prefix, i)
                inv = build_invoice(vendor.id, inv_num, subtotal, gst, inv_date)
                db.add(inv)
                invoices_created += 1

            # Inject fraud scenarios for 3 vendors so detection rules can be verified
            if profile["inv_prefix"] == "ACT":
                # DUPLICATE invoice number
                dup_subtotal = generate_amount(profile["min_amt"], profile["max_amt"])
                dup = build_invoice(
                    vendor.id, make_invoice_number(prefix, 1),  # same number as first
                    dup_subtotal, gst,
                    random_date(START_DATE, END_DATE),
                    status=InvoiceStatus.DOCUMENTS_UPLOADED.value,
                )
                db.add(dup)
                invoices_created += 1
                fraud_scenarios.append(
                    f"[ACT] DUPLICATE: {prefix}-0001 used twice"
                )

            if profile["inv_prefix"] == "MCS":
                # UNUSUAL AMOUNT: 10x the typical range
                big_sub = d(float(profile["max_amt"]) * 10)
                big = build_invoice(
                    vendor.id, make_invoice_number(prefix, count + 1),
                    big_sub, gst,
                    random_date(START_DATE, END_DATE),
                    status=InvoiceStatus.DOCUMENTS_UPLOADED.value,
                )
                db.add(big)
                invoices_created += 1
                fraud_scenarios.append(
                    f"[MCS] UNUSUAL AMOUNT: {big_sub} (10× normal max)"
                )

            if profile["inv_prefix"] == "BFL":
                # TAX MISMATCH: total doesn't equal subtotal + tax
                bad_sub = generate_amount(profile["min_amt"], profile["max_amt"])
                bad_tax = d(float(bad_sub) * gst)
                bad_total = bad_sub + bad_tax + d(99999)  # tampered total
                bad = Invoice(
                    vendor_id=vendor.id,
                    invoice_number=make_invoice_number(prefix, count + 1),
                    invoice_date=random_date(START_DATE, END_DATE),
                    due_date=date(2026, 12, 31),
                    subtotal=bad_sub,
                    tax=bad_tax,
                    total_amount=bad_total,
                    currency="INR",
                    status=InvoiceStatus.DOCUMENTS_UPLOADED.value,
                )
                db.add(bad)
                invoices_created += 1
                fraud_scenarios.append(
                    f"[BFL] TAX MISMATCH: total tampered by +99999"
                )

            db.commit()
            total_invoices += invoices_created
            print(f"  {profile['name'][:40]:<40} {invoices_created:>4} invoices")

        print(f"\n{'='*55}")
        print(f"Total invoices seeded: {total_invoices}")
        print(f"\nFraud scenarios injected (for testing):")
        for s in fraud_scenarios:
            print(f"  {s}")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding 1000 demo invoices...\n")
    seed()
    print("\nDone. Run fraud-check on the DOCUMENTS_UPLOADED invoices to verify.")
