"""
The built-in policy knowledge base: GST rules, every fraud flag the rule
engine raises, common fraud patterns and the review guidelines. AI
explanations cite these passages. Loaded on server start when the knowledge
base is empty, or with scripts/seed_knowledge_base.py.
"""

from app.rag.store import RAGStore

# One rule per paragraph, indexed as one passage each, so each search hit
# is a single rule an explanation can cite. Keep these in step with
# app/fraud/ and app/fraud/config.py.
KNOWLEDGE_DOCS = [
    {
        "name": "GST Tax Rules India",
        "source_type": "policy",
        "content": """
GST rates (INVALID_GST_RATE). The effective tax rate (tax / subtotal) must be one of the total GST rates: 0%, 0.25% (rough diamonds), 3% (gold and silver), 5%, 12%, 18% or 28%, within 1.5 percentage points. CGST and SGST are each half the rate on intra-state supplies, so their sum is the rate; IGST is the full rate on inter-state supplies. 9% or 14% on their own are half rates, not valid totals. A rate between slabs, such as 15% or 21%, is a medium-risk signal that the tax was keyed in or altered.

Tax arithmetic (TAX_CALCULATION_MISMATCH). Total must equal subtotal plus tax within Rs 2 for rounding. A difference up to Rs 5 is low risk, up to Rs 50 medium, above Rs 50 high: a total that does not add up usually means a figure was edited after the invoice was raised.

Excessive tax (EXCESSIVE_TAX_RATE). The highest GST slab is 28%. An effective rate above 35% is impossible under any category and is high risk; it often hides an inflated total.

Vendor's usual rate (TAX_RATE_DEVIATION). A vendor supplying the same goods or services charges the same rate each time. A rate more than 2 percentage points away from the vendor's most common historical rate is medium risk: confirm the goods or services actually changed.

GSTIN. A GSTIN has 15 characters: a 2-digit state code, the 10-character PAN, an entity number, the letter Z and a check character. Invoices above Rs 50,000 must carry the supplier's GSTIN.
""",
    },
    {
        "name": "Invoice Fraud Detection Rules",
        "source_type": "fraud_rule",
        "content": """
Duplicate invoice (DUPLICATE_INVOICE). The same vendor and the same invoice number already exist. This is critical: paying it would pay the same bill twice. Reject unless the earlier copy was cancelled.

Duplicate document (DUPLICATE_DOCUMENT). The extracted text is identical to an invoice already uploaded, even under a different file name or with no vendor linked. Critical: the same document is being submitted again.

Near-duplicate (SIMILAR_INVOICE). Same vendor, amount within 5% and invoice date within 7 days of another invoice. High risk when the amount is within 0.5% and the dates within 2 days; medium within 2%; otherwise low, because vendors who bill often send invoices of similar size.

Statistical outlier (AMOUNT_STATISTICAL_ANOMALY). With at least 5 earlier invoices from the vendor, an amount more than 3 standard deviations from the vendor's mean is medium risk, and more than 4.5 standard deviations high risk. 3 standard deviations is used because 2 flags about 5% of ordinary invoices.

Broken fixed amount (AMOUNT_ANOMALY_UNIFORM). The vendor always billed one fixed amount (a retainer or subscription) and this invoice differs. Medium risk: check whether the contract changed.

Amount spike (VENDOR_AMOUNT_SPIKE). The amount is 3 times or more the vendor's average over at least 5 earlier invoices. Medium risk, a typical sign of overbilling.

Approval threshold splitting (AMOUNT_BELOW_THRESHOLD). The amount is within 2% below an approval limit of Rs 50,000, Rs 1,00,000, Rs 5,00,000 or Rs 10,00,000. Medium risk: a large bill may have been split to stay under the limit. Several such invoices from one vendor are a strong signal.

Rapid submission (RAPID_INVOICE_SUBMISSION). 5 or more invoices from the same vendor uploaded within 5 minutes. Medium risk: bulk submission can be used to slip a fraudulent invoice through with genuine ones.

New vendor (NEW_VENDOR). No earlier invoices from this vendor. Medium risk, high when the first invoice is above Rs 10,000. Verify the vendor's registration, GSTIN and bank details before paying. Having one or two earlier invoices is not suspicious.

Unknown vendor (UNKNOWN_VENDOR). No vendor could be linked to the invoice. Low risk on its own (often the name was not read cleanly), but the vendor must be identified before payment.

High rejection rate (HIGH_VENDOR_REJECTION_RATE). More than 30% of the vendor's reviewed invoices (at least 5 reviews) were rejected. High risk: give this vendor's invoices extra scrutiny.

Future date (FUTURE_INVOICE_DATE). The invoice is dated after today. High risk: an invoice cannot be issued for the future.

Post-dated after upload (BACK_DATED_INVOICE). The invoice date is more than 1 day after the upload date. Medium risk: the date was probably fabricated.

Very old invoice (VERY_OLD_INVOICE). The invoice is more than 730 days (2 years) old at upload. Medium risk: stale invoices are a common way to claim payment twice or to use an expired budget. An invoice a few months late is normal and is not flagged.

Due date before invoice date (DUE_DATE_BEFORE_INVOICE). High risk: the dates are inconsistent, which suggests editing.

Trained model (ML_FRAUD_PATTERN). A gradient-boosting model trained on 10,000 labelled invoices, and retrained on reviewers' approve and reject decisions, rates the invoice at or above its fraud threshold. High risk at 90% or more, otherwise medium. It is supporting evidence, not proof: check the factors it names, such as a duplicate number, an unusual amount for the vendor or an off-slab tax rate.

Long payment terms (EXTENDED_PAYMENT_TERMS). More than 180 days between invoice and due date. Low risk; check it matches the contract.
""",
    },
    {
        "name": "Financial Fraud Patterns Reference",
        "source_type": "fraud_rule",
        "content": """
Ghost vendor fraud. Invoices from a vendor that does not exist or did not supply anything. Signs: new or unknown vendor, a large first invoice, no purchase order. Check the vendor's GSTIN and bank account against official records.

Duplicate payment fraud. The same invoice submitted twice, sometimes with a changed number or file name. Signs: duplicate invoice number, identical document, or near-identical amount and date.

Overbilling. Amounts inflated above the real price. Signs: an amount spike or statistical outlier against the vendor's own history.

Shell company fraud. Payments to a company controlled by an insider. Signs: new vendor, no history, high-value first invoice, round amounts.

Tax manipulation. A wrong GST rate or a total that does not equal subtotal plus tax, used to inflate the amount paid or claim extra input tax credit.

Approval threshold splitting. One large purchase split into several invoices just below an approval limit so that no single invoice needs senior approval.

Date manipulation. Invoices dated in the future, after the upload date, or years in the past, to fit a budget period or to re-claim an old bill.
""",
    },
    {
        "name": "Human Review Decision Guidelines",
        "source_type": "policy",
        "content": """
Approve when every signal is explained: risk below 25 with no high or critical flag, or a flag that verification cleared (for example a new vendor whose GSTIN and bank details were confirmed).

Reject when there is a critical flag or several high flags with no valid explanation: a confirmed duplicate, tax manipulation, a vendor that cannot be verified, or an invoice that does not match the purchase order or contract.

Request further review when the risk is between 25 and 74 and the context is unclear, the evidence conflicts, supporting documents are missing, or the vendor's answer is awaited.

Written reason. Every decision needs a specific reason that names the signals checked and any verification done. The reason becomes part of the permanent audit trail, and approve/reject decisions are used to retrain the fraud model.

The AI analysis is advisory. Risk scores and explanations support the reviewer; the reviewer makes the final decision.
""",
    },
]


def passages(doc: dict) -> list[str]:
    return [c.strip() for c in doc["content"].split("\n\n") if c.strip()]


def load_default_policies(db) -> dict[str, int]:
    """Index (or re-index) every built-in document; returns chunks per document."""
    store = RAGStore(db)
    return {
        doc["name"]: store.add_document(doc["name"], doc["content"], doc["source_type"], chunks=passages(doc))
        for doc in KNOWLEDGE_DOCS
    }
