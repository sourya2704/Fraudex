"""
Generate a labelled dataset of realistic Indian GST invoices for training and
evaluating the fraud model.

    python scripts/generate_training_invoices.py            # 10,000 invoices
    python scripts/generate_training_invoices.py --count 20000 --seed 7

Writes data/training/invoices.jsonl (one invoice per line, with `is_fraud` and
`fraud_type` labels) and data/training/texts/ (rendered invoice text for a
sample, used to measure the parser).

The data is synthetic: no real company's invoices are used. Vendor behaviour
(amount ranges, GST slabs, CGST+SGST vs IGST, payment terms, invoice-number
sequences, retainers, seasonal spikes, round-off) and the fraud patterns are
modelled on how Indian B2B invoicing and invoice fraud look in practice, and
legitimate edge cases (exempt 0% GST, one-off large orders, fixed monthly
retainers, small new vendors) are included on purpose so the model learns not
to flag them.
"""

import argparse
import json
import math
import os
import random
import string
from datetime import date, datetime, timedelta

GST_SLABS = [0.0, 0.05, 0.12, 0.18, 0.28]
STATE_CODES = {
    "27": "Maharashtra", "29": "Karnataka", "07": "Delhi", "33": "Tamil Nadu",
    "24": "Gujarat", "09": "Uttar Pradesh", "36": "Telangana", "19": "West Bengal",
    "06": "Haryana", "08": "Rajasthan", "32": "Kerala", "23": "Madhya Pradesh",
}
BUYER_STATE = "27"  # the company using FrauDex is in Maharashtra

INDUSTRIES = [
    # name words, GST slab, amount range (subtotal INR), description items
    ("Cloud Technologies", 0.18, (25_000, 600_000), ["Cloud hosting - monthly", "Managed database", "CDN bandwidth", "Support plan"]),
    ("Logistics", 0.12, (8_000, 250_000), ["Freight charges", "Warehousing", "Last-mile delivery", "Packaging"]),
    ("Consulting Services", 0.18, (50_000, 900_000), ["Advisory retainer", "Audit support", "Process consulting", "Strategy workshop"]),
    ("Office Supplies", 0.12, (2_000, 80_000), ["A4 paper reams", "Printer toner", "Stationery kit", "Office chairs"]),
    ("Catering Services", 0.05, (5_000, 120_000), ["Corporate lunch", "Event catering", "Pantry supplies", "Snacks"]),
    ("Electronics", 0.18, (10_000, 700_000), ["Laptops", "Monitors", "Networking switches", "UPS units"]),
    ("Automobiles", 0.28, (150_000, 2_500_000), ["Fleet vehicle", "Vehicle spares", "Annual maintenance"]),
    ("Healthcare Diagnostics", 0.0, (3_000, 90_000), ["Employee health check", "Lab tests", "Medical camp"]),
    ("Facility Management", 0.18, (20_000, 300_000), ["Housekeeping", "Security services", "Electrical maintenance"]),
    ("Printing & Packaging", 0.12, (4_000, 150_000), ["Brochures", "Corrugated boxes", "Labels"]),
    ("Software Licensing", 0.18, (15_000, 1_200_000), ["Annual licence", "User seats", "Implementation"]),
    ("Construction Materials", 0.28, (30_000, 1_500_000), ["Cement bags", "Steel rods", "Tiles"]),
]
NAME_PREFIXES = [
    "Apex", "Horizon", "Meridian", "Sunrise", "Vertex", "Pinnacle", "Shree", "Ganesh",
    "Bharat", "Indus", "Sapphire", "Evergreen", "Nova", "Trident", "Lotus", "Kaveri",
    "Himalaya", "Orbit", "Quantum", "Saffron", "Zenith", "Aarav", "Krishna", "Omkar",
    "Rudra", "Silverline", "Bluestone", "Greenfield", "Starlight", "Unity",
]
SUFFIXES = ["Pvt Ltd", "Private Limited", "LLP", "& Co", "Ltd", "Enterprises"]
APPROVAL_THRESHOLDS = [50_000, 100_000, 500_000, 1_000_000]

START = date(2024, 4, 1)
END = date(2026, 9, 30)


def money(x: float) -> float:
    return round(x + 1e-9, 2)


def make_gstin(rng: random.Random, state: str) -> str:
    pan = (
        "".join(rng.choices(string.ascii_uppercase, k=3))
        + rng.choice("CPFH")
        + rng.choice(string.ascii_uppercase)
        + "".join(rng.choices(string.digits, k=4))
        + rng.choice(string.ascii_uppercase)
    )
    return f"{state}{pan}{rng.choice('123')}Z{rng.choice(string.ascii_uppercase + string.digits)}"


def make_vendor(rng: random.Random, idx: int) -> dict:
    industry = rng.choice(INDUSTRIES)
    words, slab, (lo, hi), items = industry
    state = rng.choice(list(STATE_CODES))
    name = f"{rng.choice(NAME_PREFIXES)} {words} {rng.choice(SUFFIXES)}"
    # Each vendor works in a narrower band of its industry's range.
    centre = math.exp(rng.uniform(math.log(lo), math.log(hi)))
    style = rng.choice(["{p}-{n:04d}", "{p}/{fy}/{n:04d}", "{p}{n:05d}", "INV-{p}-{n}"])
    retainer = rng.random() < 0.15
    return {
        "vendor_key": f"V{idx:04d}",
        "name": name,
        "gstin": make_gstin(rng, state),
        "state": state,
        "slab": slab if rng.random() > 0.08 else rng.choice(GST_SLABS),
        "centre": centre,
        "spread": rng.uniform(0.25, 0.7),
        "lo": lo,
        "hi": hi,
        "items": items,
        "prefix": "".join(w[0] for w in name.split()[:3] if w[0].isalnum()).upper(),
        "number_style": style,
        "terms": rng.choice([0, 7, 15, 30, 30, 45, 60]),
        # ~15% of vendors bill a fixed monthly retainer (identical amounts, legit)
        "retainer": retainer,
        # A retainer is billed once a month; other vendors bill 1-12 times.
        "monthly_volume": 1 if retainer else rng.choice([1, 2, 3, 4, 6, 8, 12]),
        "round_off": rng.random() < 0.4,
    }


def invoice_number(vendor: dict, n: int, d: date) -> str:
    fy_start = d.year if d.month >= 4 else d.year - 1
    fy = f"{fy_start % 100:02d}-{(fy_start + 1) % 100:02d}"
    return vendor["number_style"].format(p=vendor["prefix"], n=n, fy=fy)


def amounts(vendor: dict, subtotal: float, rate: float = None, round_off: bool = None) -> dict:
    rate = vendor["slab"] if rate is None else rate
    tax = money(subtotal * rate)
    total = subtotal + tax
    if (vendor["round_off"] if round_off is None else round_off):
        total = float(round(total))  # "Round off" line: within ±0.50
    return {"subtotal": money(subtotal), "tax": tax, "total_amount": money(total), "rate": rate}


def legit_subtotal(rng: random.Random, vendor: dict, month_index: int) -> float:
    if vendor["retainer"]:
        return round(vendor["centre"], -2)
    seasonal = 1 + 0.15 * math.sin(month_index / 12 * 2 * math.pi)
    raw = rng.lognormvariate(math.log(vendor["centre"] * seasonal), vendor["spread"])
    # Legit one-off large orders (year-end, bulk purchase): 2-3x typical
    if rng.random() < 0.02:
        raw *= rng.uniform(2.0, 3.0)
    raw = min(max(raw, vendor["lo"] * 0.3), vendor["hi"] * 2)
    return round(raw, rng.choice([0, 0, -1, -2]))


def record(vendor, number, inv_date, due_date, created_at, amt, items, is_fraud, fraud_type):
    return {
        "vendor_key": vendor["vendor_key"],
        "vendor_name": vendor["name"],
        "vendor_gstin": vendor["gstin"],
        "vendor_state": vendor["state"],
        "invoice_number": number,
        "invoice_date": inv_date.isoformat(),
        "due_date": due_date.isoformat() if due_date else None,
        "created_at": created_at.isoformat(),
        "subtotal": amt["subtotal"],
        "tax": amt["tax"],
        "total_amount": amt["total_amount"],
        "gst_rate": amt["rate"],
        "currency": "INR",
        "items": items,
        "is_fraud": int(is_fraud),
        "fraud_type": fraud_type,
    }


def line_items(rng: random.Random, vendor: dict, subtotal: float) -> list:
    n = rng.choice([1, 1, 2, 3])
    weights = [rng.random() + 0.2 for _ in range(n)]
    parts = [money(subtotal * w / sum(weights)) for w in weights]
    parts[-1] = money(subtotal - sum(parts[:-1]))
    out = []
    for desc, amount in zip(rng.sample(vendor["items"], k=min(n, len(vendor["items"]))), parts):
        qty = rng.choice([1, 1, 2, 5, 10, 12, 25])
        out.append({"description": desc, "quantity": qty, "unit_price": money(amount / qty), "line_total": amount})
    return out


def upload_time(rng: random.Random, inv_date: date) -> datetime:
    lag = rng.choice([0, 1, 1, 2, 3, 5, 7, 10, 14, 21])
    return datetime.combine(inv_date + timedelta(days=lag), datetime.min.time()) + timedelta(
        hours=rng.randint(9, 19), minutes=rng.randint(0, 59)
    )


def generate(count: int, seed: int, fraud_rate: float) -> list:
    rng = random.Random(seed)
    vendors = [make_vendor(rng, i) for i in range(1, 181)]
    legit_target = int(count * (1 - fraud_rate))

    # ── Legitimate history, vendor by vendor, month by month ────────────────
    legit = []
    months = (END.year - START.year) * 12 + END.month - START.month + 1
    per_invoice_weight = sum(v["monthly_volume"] for v in vendors) * months
    scale = legit_target / per_invoice_weight
    for vendor in vendors:
        n = rng.randint(1, 40)
        for m in range(months):
            year = START.year + (START.month - 1 + m) // 12
            month = (START.month - 1 + m) % 12 + 1
            expected = vendor["monthly_volume"] * scale
            k = int(expected) + (1 if rng.random() < expected - int(expected) else 0)
            for _ in range(k):
                day = 1 if vendor["retainer"] else rng.randint(1, 28)
                inv_date = date(year, month, day)
                sub = legit_subtotal(rng, vendor, m)
                rate = vendor["slab"]
                amt = amounts(vendor, sub, rate)
                # Legit small rounding error on a few hand-made invoices (<= ₹1)
                if rng.random() < 0.01:
                    amt["total_amount"] = money(amt["total_amount"] + rng.choice([-1, 1]) * 0.5)
                terms = vendor["terms"] if rng.random() > 0.1 else rng.choice([15, 30, 45])
                legit.append(record(
                    vendor, invoice_number(vendor, n, inv_date), inv_date,
                    inv_date + timedelta(days=terms), upload_time(rng, inv_date), amt,
                    line_items(rng, vendor, amt["subtotal"]), False, None,
                ))
                n += 1

    # Legit new small vendors that only ever send one or two invoices.
    for i in range(40):
        v = make_vendor(rng, 900 + i)
        v["centre"] = rng.uniform(1_500, 25_000)
        for j in range(rng.choice([1, 1, 2])):
            d = START + timedelta(days=rng.randint(0, (END - START).days))
            amt = amounts(v, legit_subtotal(rng, v, 0))
            legit.append(record(v, invoice_number(v, j + 1, d), d, d + timedelta(days=v["terms"]),
                                upload_time(rng, d), amt, line_items(rng, v, amt["subtotal"]), False, None))
        vendors.append(v)

    legit.sort(key=lambda r: r["created_at"])
    by_vendor = {}
    for r in legit:
        by_vendor.setdefault(r["vendor_key"], []).append(r)
    vendor_by_key = {v["vendor_key"]: v for v in vendors}
    established = [k for k, rows in by_vendor.items() if len(rows) >= 8]

    # ── Fraud, injected on top of the legitimate history ────────────────────
    fraud_target = count - len(legit)
    fraud = []
    fraud_types = [
        ("duplicate_resubmission", 0.16),
        ("near_duplicate", 0.12),
        ("inflated_amount", 0.14),
        ("tax_tampering", 0.12),
        ("invalid_gst_rate", 0.09),
        ("threshold_splitting", 0.10),
        ("date_manipulation", 0.09),
        ("fake_vendor", 0.10),
        ("rate_switch", 0.08),
    ]
    names, weights = zip(*fraud_types)
    fake_seq = 0

    while len(fraud) < fraud_target:
        kind = rng.choices(names, weights)[0]
        key = rng.choice(established)
        vendor = vendor_by_key[key]
        base = rng.choice(by_vendor[key])
        base_date = date.fromisoformat(base["invoice_date"])
        base_created = datetime.fromisoformat(base["created_at"])
        # Numbers far above the vendor's real sequence, so a fraud invoice never
        # collides with a later legitimate one (no accidental duplicates).
        n_next = 70_000 + len(fraud) * 4

        if kind == "duplicate_resubmission":
            num = base["invoice_number"]
            if rng.random() < 0.5:  # disguised: change separators / case
                num = num.replace("-", "").replace("/", "-").lower() if rng.random() < 0.5 else num.replace("-", " ")
            created = base_created + timedelta(days=rng.randint(5, 120))
            d = base_date + timedelta(days=rng.choice([0, 0, 1, 3, 10]))
            amt = {k: base[k] for k in ("subtotal", "tax", "total_amount")} | {"rate": base["gst_rate"]}
            fraud.append(record(vendor, num, d, d + timedelta(days=vendor["terms"]), created, amt,
                                base["items"], True, kind))

        elif kind == "near_duplicate":
            d = base_date + timedelta(days=rng.randint(-5, 5))
            sub = base["subtotal"] * rng.uniform(0.97, 1.03)
            amt = amounts(vendor, round(sub, -1))
            created = base_created + timedelta(days=rng.randint(1, 6))
            fraud.append(record(vendor, invoice_number(vendor, n_next, d), d, d + timedelta(days=vendor["terms"]),
                                created, amt, line_items(rng, vendor, amt["subtotal"]), True, kind))

        elif kind == "inflated_amount":
            typical = sorted(r["subtotal"] for r in by_vendor[key])[len(by_vendor[key]) // 2]
            sub = typical * rng.uniform(4, 15)
            d = base_date + timedelta(days=rng.randint(1, 40))
            amt = amounts(vendor, round(sub, -2))
            fraud.append(record(vendor, invoice_number(vendor, n_next, d), d, d + timedelta(days=vendor["terms"]),
                                upload_time(rng, d), amt, line_items(rng, vendor, amt["subtotal"]), True, kind))

        elif kind == "tax_tampering":
            d = base_date + timedelta(days=rng.randint(1, 40))
            amt = amounts(vendor, legit_subtotal(rng, vendor, 0))
            # Total padded beyond subtotal + tax (or tax shown lower than what was added)
            pad = amt["subtotal"] * rng.uniform(0.02, 0.25) + rng.choice([0, 99, 500, 999])
            if rng.random() < 0.5:
                amt["total_amount"] = money(amt["total_amount"] + pad)
            else:
                amt["tax"] = money(max(0.0, amt["tax"] - pad))
            fraud.append(record(vendor, invoice_number(vendor, n_next, d), d, d + timedelta(days=vendor["terms"]),
                                upload_time(rng, d), amt, line_items(rng, vendor, amt["subtotal"]), True, kind))

        elif kind == "invalid_gst_rate":
            d = base_date + timedelta(days=rng.randint(1, 40))
            rate = rng.choice([0.07, 0.10, 0.15, 0.21, 0.22, 0.24, 0.32, 0.40])
            amt = amounts(vendor, legit_subtotal(rng, vendor, 0), rate)
            fraud.append(record(vendor, invoice_number(vendor, n_next, d), d, d + timedelta(days=vendor["terms"]),
                                upload_time(rng, d), amt, line_items(rng, vendor, amt["subtotal"]), True, kind))

        elif kind == "threshold_splitting":
            threshold = min((t for t in APPROVAL_THRESHOLDS if t > vendor["centre"] * 0.5), default=APPROVAL_THRESHOLDS[-1])
            d = base_date + timedelta(days=rng.randint(1, 40))
            created = upload_time(rng, d)
            for part in range(rng.choice([1, 2, 3])):
                total = threshold * rng.uniform(0.982, 0.999)
                sub = total / (1 + vendor["slab"])
                amt = amounts(vendor, round(sub, 2), round_off=False)
                fraud.append(record(vendor, invoice_number(vendor, n_next + part, d), d,
                                    d + timedelta(days=vendor["terms"]), created + timedelta(minutes=part * 7),
                                    amt, line_items(rng, vendor, amt["subtotal"]), True, kind))

        elif kind == "date_manipulation":
            amt = amounts(vendor, legit_subtotal(rng, vendor, 0))
            created = upload_time(rng, base_date + timedelta(days=rng.randint(1, 60)))
            mode = rng.choice(["future", "due_before", "very_old"])
            if mode == "future":
                d = created.date() + timedelta(days=rng.randint(5, 120))
                due = d + timedelta(days=vendor["terms"])
            elif mode == "due_before":
                d = created.date() - timedelta(days=rng.randint(0, 10))
                due = d - timedelta(days=rng.randint(5, 60))
            else:
                d = created.date() - timedelta(days=rng.randint(760, 1400))
                due = d + timedelta(days=vendor["terms"])
            fraud.append(record(vendor, invoice_number(vendor, n_next, d), d, due, created, amt,
                                line_items(rng, vendor, amt["subtotal"]), True, kind))

        elif kind == "fake_vendor":
            fake_seq += 1
            fv = make_vendor(rng, 5000 + fake_seq)
            sub = rng.choice([1, 2, 2.5, 3, 4.5, 5, 7.5, 9.9]) * 10 ** rng.choice([4, 5, 5, 5])
            d = START + timedelta(days=rng.randint(30, (END - START).days))
            amt = amounts(fv, sub)
            num = f"{rng.randint(1, 999)}" if rng.random() < 0.5 else f"INV-{rng.randint(1, 99)}"
            fraud.append(record(fv, num, d, d + timedelta(days=rng.choice([0, 3, 7])), upload_time(rng, d), amt,
                                line_items(rng, fv, amt["subtotal"]), True, kind))

        elif kind == "rate_switch":
            other = [s for s in GST_SLABS if s != vendor["slab"] and s > vendor["slab"]]
            if not other:
                continue
            d = base_date + timedelta(days=rng.randint(1, 40))
            amt = amounts(vendor, legit_subtotal(rng, vendor, 0), rng.choice(other))
            fraud.append(record(vendor, invoice_number(vendor, n_next, d), d, d + timedelta(days=vendor["terms"]),
                                upload_time(rng, d), amt, line_items(rng, vendor, amt["subtotal"]), True, kind))

    rows = legit + fraud[:fraud_target]
    rows.sort(key=lambda r: r["created_at"])
    for i, r in enumerate(rows, 1):
        r["id"] = i
    return rows


# ── Text rendering (for parser accuracy) ─────────────────────────────────────

def _fmt_inr(x: float) -> str:
    whole, frac = f"{x:.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    return f"{whole}.{frac}"


def render_text(r: dict, rng: random.Random) -> str:
    d = date.fromisoformat(r["invoice_date"])
    due = date.fromisoformat(r["due_date"]) if r["due_date"] else None
    date_fmt = rng.choice(["%d-%m-%Y", "%d/%m/%Y", "%d-%b-%Y", "%Y-%m-%d", "%d %B %Y", "%d.%m.%Y"])
    cur = rng.choice(["₹", "Rs.", "INR ", "", "I"])  # "I" = PDF font without a rupee glyph
    inter_state = r["vendor_state"] != BUYER_STATE
    layout = rng.choice(["inline", "stacked"])
    sep = "\n" if layout == "stacked" else " "

    lines = [
        r["vendor_name"].upper() if rng.random() < 0.5 else r["vendor_name"],
        f"{rng.randint(1, 400)}, Industrial Area, {STATE_CODES[r['vendor_state']]}",
        f"GSTIN: {r['vendor_gstin']}",
        "TAX INVOICE",
        f"Invoice No:{sep}{r['invoice_number']}",
        f"Invoice Date:{sep}{d.strftime(date_fmt)}",
    ]
    if due:
        lines.append(f"Due Date:{sep}{due.strftime(date_fmt)}")
    lines += [
        "Bill To:",
        "FrauDex Demo Buyer Pvt Ltd",
        f"GSTIN: 27AAACF{rng.randint(1000, 9999)}K1Z{rng.choice('ABC')}",
        "Description    Qty    Rate    Amount",
    ]
    for it in r["items"]:
        lines.append(f"{it['description']}    {it['quantity']}    {_fmt_inr(it['unit_price'])}    {_fmt_inr(it['line_total'])}")
    lines.append(f"{rng.choice(['Sub Total', 'Subtotal', 'Taxable Value'])}:{sep}{cur}{_fmt_inr(r['subtotal'])}")
    pct = round(r["gst_rate"] * 100, 2)
    if inter_state:
        lines.append(f"IGST @ {pct:g}%:{sep}{cur}{_fmt_inr(r['tax'])}")
    else:
        half = r["tax"] / 2
        cgst = money(half)
        sgst = money(r["tax"] - cgst)
        lines.append(f"CGST @ {pct / 2:g}%:{sep}{cur}{_fmt_inr(cgst)}")
        lines.append(f"SGST @ {pct / 2:g}%:{sep}{cur}{_fmt_inr(sgst)}")
    lines.append(f"{rng.choice(['Grand Total', 'Total Invoice Value', 'Total Amount', 'TOTAL'])}:{sep}{cur}{_fmt_inr(r['total_amount'])}")
    lines.append("Thank you for your business.")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--count", type=int, default=10_000)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--fraud-rate", type=float, default=0.10)
    ap.add_argument("--texts", type=int, default=1_000, help="how many invoices to render as text")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data", "training"))
    args = ap.parse_args()

    rows = generate(args.count, args.seed, args.fraud_rate)
    os.makedirs(os.path.join(args.out, "texts"), exist_ok=True)
    with open(os.path.join(args.out, "invoices.jsonl"), "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")

    rng = random.Random(args.seed + 1)
    for r in rng.sample(rows, k=min(args.texts, len(rows))):
        with open(os.path.join(args.out, "texts", f"{r['id']:05d}.txt"), "w") as f:
            f.write(render_text(r, rng))

    fraud = sum(r["is_fraud"] for r in rows)
    vendors = len({r["vendor_key"] for r in rows})
    print(f"{len(rows)} invoices, {vendors} vendors, {fraud} fraudulent ({fraud / len(rows):.1%})")
    counts = {}
    for r in rows:
        if r["fraud_type"]:
            counts[r["fraud_type"]] = counts.get(r["fraud_type"], 0) + 1
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {k:<24}{v}")


if __name__ == "__main__":
    main()
