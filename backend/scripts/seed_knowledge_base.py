"""
Seeds the RAG knowledge base with default fraud detection rules and GST policies.
Run after pgvector is enabled: python scripts/seed_knowledge_base.py
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.database.connection import SessionLocal
from app.rag.store import RAGStore

KNOWLEDGE_DOCS = [
    {
        "name": "GST Tax Rules India",
        "source_type": "policy",
        "content": """
India Goods and Services Tax (GST) Rules for Invoice Validation

Valid GST Rates: 0%, 5%, 12%, 18%, 28%
- 0%: Essential goods, exports, healthcare
- 5%: Basic necessities, some services
- 12%: Processed foods, business class air travel
- 18%: Most services, electronics, capital goods
- 28%: Luxury items, tobacco, automobiles

GST Invoice Requirements:
- Every invoice above Rs 50,000 must have a valid GSTIN
- Tax amount must equal: Subtotal × GST Rate
- Total Amount must equal: Subtotal + Tax Amount
- Tolerance for rounding: ±Rs 0.05
- CGST and SGST each = GST Rate / 2 for intra-state
- IGST = Full GST Rate for inter-state

Red Flags in GST Invoices:
- Tax rate not matching any valid GST slab (0/5/12/18/28%)
- Invoice total > Rs 10,000 with zero tax (unless genuinely 0% rated)
- Tax rate exceeding 35% is invalid under any category
- Effective tax rate deviating more than 2% from vendor's historical rate
- GSTIN format: 15 characters, state code + PAN + entity number + checksum
""",
    },
    {
        "name": "Invoice Fraud Detection Rules",
        "source_type": "fraud_rule",
        "content": """
FrauDex Invoice Fraud Detection Rules and Thresholds

DUPLICATE INVOICE FRAUD:
- Same vendor + same invoice number = CRITICAL fraud signal
- Same vendor + amount within 5% + date within 7 days = HIGH risk near-duplicate
- Document hash comparison for identical files (upcoming feature)

AMOUNT ANOMALY RULES:
- Invoice amount > 3x vendor historical average = HIGH risk
- Z-score > 2.0 standard deviations from vendor mean = MEDIUM risk
- Z-score > 3.0 standard deviations = HIGH risk (requires 5+ history invoices)
- Suspiciously round amounts (divisible by 1000, ≥ Rs 5,000) = LOW risk
- Amounts just below approval thresholds (Rs 50K, 1L, 5L, 10L) = MEDIUM risk (splitting)

VENDOR RISK RULES:
- New vendor (< 3 invoices) = MEDIUM risk, HIGH if invoice > Rs 1,00,000
- Unknown vendor (no vendor_id) = HIGH risk
- Vendor rejection rate > 30% with 5+ history = HIGH risk
- Perfect ascending amount pattern across vendor history = LOW risk

DATE VALIDATION RULES:
- Invoice dated in the future = HIGH risk
- Invoice older than 730 days from upload = MEDIUM risk
- Due date before invoice date = HIGH risk
- Invoice dated on weekend = INFO signal
- Payment terms > 180 days = LOW risk
- Same-day payment terms = LOW risk

THRESHOLD-BASED APPROVAL SPLITTING:
- Government and corporate approval thresholds: Rs 50,000 / 1,00,000 / 5,00,000 / 10,00,000
- Invoice within 5% below threshold likely indicates amount manipulation
- Multiple invoices just below threshold from same vendor = very high risk

RAPID SUBMISSION PATTERNS:
- 5+ invoices from same vendor within 5 minutes = MEDIUM risk
- Sequential invoice numbers with close dates = suspicious
""",
    },
    {
        "name": "Financial Fraud Patterns Reference",
        "source_type": "fraud_rule",
        "content": """
Common Financial Invoice Fraud Patterns

1. GHOST VENDOR FRAUD
Invoices submitted for non-existent vendors or services.
Signals: No purchase order match, vendor not in approved list, new vendor with large amounts.
Detection: vendor_id missing, first invoice from vendor > Rs 1,00,000.

2. DUPLICATE PAYMENT FRAUD
Same invoice submitted multiple times, sometimes with minor changes.
Signals: Same invoice number, same amount, similar dates.
Detection: exact duplicate check, near-duplicate within 5% amount and 7 days.

3. OVERBILLING FRAUD
Inflating invoice amounts above actual service/goods cost.
Signals: Amount significantly above historical average for same vendor/service.
Detection: z-score analysis, 3x average threshold.

4. SHELL COMPANY FRAUD
Payments to shell companies controlled by insiders.
Signals: New vendor, no historical pattern, high value first invoice.
Detection: new vendor + high value escalation.

5. TAX MANIPULATION
Incorrect GST rates applied to reduce taxable amount or inflate deductions.
Signals: GST rate not matching standard rates, tax amount mismatch.
Detection: GST rate validation against 0/5/12/18/28% slabs.

6. APPROVAL THRESHOLD SPLITTING
Breaking large invoices into smaller ones to avoid approval requirements.
Signals: Multiple invoices just below approval thresholds (Rs 50K, 1L, 5L, 10L).
Detection: amount just-below-threshold check within 5%.

7. BACKDATED INVOICES
Invoices dated in the past to match budget periods or avoid detection.
Signals: Invoice date significantly before upload date.
Detection: back-dated check, very old invoice check (>730 days).

8. FICTITIOUS SERVICES
Invoices for services that were never rendered.
Signals: Vague descriptions, missing line items, no corroborating PO.
Detection: missing fields, zero line items despite amount.
""",
    },
    {
        "name": "Human Review Decision Guidelines",
        "source_type": "policy",
        "content": """
FrauDex Human Review Decision Guidelines

APPROVE — Use when:
- All fraud signals are explained (e.g. first invoice from new vendor but verified)
- Risk score < 25 with no HIGH or CRITICAL flags
- Supporting documentation confirms legitimacy
- Vendor is known and trusted despite algorithm flags

REJECT — Use when:
- CRITICAL or multiple HIGH fraud signals with no valid explanation
- Duplicate invoice confirmed
- Invoice data does not match purchase order or contract
- Vendor cannot be verified or is on blacklist
- Tax manipulation confirmed

REQUEST_FURTHER_REVIEW — Use when:
- Risk score 25-74 with unclear context
- Conflicting evidence (some signals legitimate, some suspicious)
- Missing supporting documentation that could clarify
- New vendor with reasonable first invoice but needs verification
- Awaiting vendor response or additional information

WRITTEN REASON REQUIREMENTS:
- Reason must be specific and evidence-based
- Reference specific fraud signals or their absence
- Document any manual verification steps taken
- Minimum: explain why the decision was made
- This reason becomes part of the permanent audit trail

IMPORTANT: The AI analysis is advisory only.
The human reviewer makes the final decision.
AI risk scores and explanations support review, not replace it.
""",
    },
]


def main():
    print("=== Seeding FrauDex Knowledge Base ===\n")
    db = SessionLocal()
    rag = RAGStore(db)

    for doc in KNOWLEDGE_DOCS:
        print(f"  Indexing: {doc['name']} ({doc['source_type']})...")
        try:
            count = rag.add_document(
                document_name=doc["name"],
                content=doc["content"],
                source_type=doc["source_type"],
            )
            print(f"    → {count} chunks created")
        except Exception as e:
            print(f"    → ERROR: {e}")

    db.close()
    print("\n✓ Knowledge base seeded.")


if __name__ == "__main__":
    main()
