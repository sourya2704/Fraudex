import os

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.dependencies import get_db, get_current_user, require_role
from app.core.storage import (
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE,
    build_stored_path,
    ensure_storage_dir,
)
from app.extraction import extract_text, ExtractionError
from app.extraction.parser import normalize_gstin, parse_invoice_text
from app.validation import validate_invoice_fields
from app.models.invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem
from app.models.vendor import Vendor
from app.models.user import User
from app.models.fraud_detection_result import FraudDetectionResult
from app.schemas.invoice import InvoiceListItem, InvoiceResponse, InvoiceUpdate
from app.schemas.fraud import FraudDetectionResponse, FraudDetectionSummary
from app.fraud.detector import FraudDetector
from app.core.audit import log_action
from app.core.notifications import notify, notify_all_admins

router = APIRouter(prefix="/invoices", tags=["Invoices"])

@router.post(
    "/upload",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext or 'unknown'}'. "
                   f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    if file.content_type not in ALLOWED_EXTENSIONS[ext]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content type '{file.content_type}' does not match "
                   f"extension '{ext}'",
        )

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of "
                   f"{MAX_FILE_SIZE // (1024 * 1024)} MB",
        )

    ensure_storage_dir()
    abs_path, _ = build_stored_path(file.filename)
    with open(abs_path, "wb") as f:
        f.write(contents)

    invoice = Invoice(
        uploaded_by=current_user.id,
        status=InvoiceStatus.DOCUMENTS_UPLOADED.value,
        document_path=abs_path,
    )
    try:
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
    except Exception:
        db.rollback()
        if os.path.exists(abs_path):
            os.remove(abs_path)
        raise

    log_action(
        db,
        action="INVOICE_UPLOADED",
        user_id=current_user.id,
        invoice_id=invoice.id,
        detail={"filename": file.filename, "size_bytes": len(contents)},
    )
    notify_all_admins(
        db,
        type="INVOICE_UPLOADED",
        title="New invoice uploaded",
        message=f"{current_user.name} uploaded '{file.filename}' (Invoice #{invoice.id})",
        invoice_id=invoice.id,
        exclude_user_id=current_user.id,
    )
    db.commit()

    return invoice

def _get_invoice_or_404(db: Session, invoice_id: int) -> Invoice:
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    return invoice

@router.get("/", response_model=list[InvoiceListItem])
def list_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Vendor and fraud result are loaded in two batched queries, so the list
    # carries vendor_name / risk_level without one request per invoice.
    return (
        db.query(Invoice)
        .options(selectinload(Invoice.vendor), selectinload(Invoice.fraud_result))
        .order_by(Invoice.id.desc())
        .all()
    )

@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_invoice_or_404(db, invoice_id)

@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    invoice_update: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "FINANCE_MANAGER")),
):
    invoice = _get_invoice_or_404(db, invoice_id)

    update_data = invoice_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value

    new_vendor_id = update_data.get("vendor_id")
    if new_vendor_id is not None:
        from app.models.vendor import Vendor
        vendor = db.query(Vendor).filter(Vendor.id == new_vendor_id).first()
        if vendor is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vendor {new_vendor_id} does not exist",
            )

    old_status = invoice.status
    for field, value in update_data.items():
        setattr(invoice, field, value)

    db.commit()
    db.refresh(invoice)

    new_status = invoice.status
    if "status" in update_data and old_status != new_status:
        log_action(
            db,
            action="INVOICE_STATUS_CHANGED",
            user_id=current_user.id,
            invoice_id=invoice_id,
            detail={"old_status": old_status, "new_status": new_status},
        )
        db.commit()

    return invoice

@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    invoice = _get_invoice_or_404(db, invoice_id)

    doc_path = invoice.document_path

    db.delete(invoice)
    db.commit()

    if doc_path and os.path.exists(doc_path):
        try:
            os.remove(doc_path)
        except OSError:
            pass

    return None

def _match_or_create_vendor(db: Session, parsed_vendor: dict):
    """
    Link the supplier printed on the invoice to a Vendor row.

    GSTIN is the reliable identity, so it is matched first (ignoring a 'GSTIN'
    prefix some records carry). A vendor is created only when the invoice has
    a valid GSTIN; a name alone is matched case-insensitively but never used
    to create a vendor, since OCR'd names are too noisy.
    """
    gstin = normalize_gstin(parsed_vendor.get("gstin"))
    name = (parsed_vendor.get("name") or "").strip()

    if gstin:
        for vendor in db.query(Vendor).filter(Vendor.tax_id.isnot(None)).all():
            if normalize_gstin(vendor.tax_id) == gstin:
                return vendor

    if name:
        vendor = db.query(Vendor).filter(func.lower(Vendor.name) == name.lower()).first()
        if vendor is not None:
            return vendor

    if gstin:
        vendor = Vendor(name=name[:255] or f"Vendor {gstin}", tax_id=gstin)
        db.add(vendor)
        db.flush()
        return vendor

    return None


@router.post("/{invoice_id}/extract", response_model=InvoiceResponse)
def extract_invoice_text(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = _get_invoice_or_404(db, invoice_id)

    if not invoice.document_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice has no uploaded document to extract from",
        )

    invoice.status = InvoiceStatus.PROCESSING.value
    db.commit()

    try:
        raw_text, method = extract_text(invoice.document_path)
    except ExtractionError as e:
        invoice.status = InvoiceStatus.PROCESSING_FAILED.value
        log_action(
            db,
            action="INVOICE_EXTRACTED",
            user_id=current_user.id,
            invoice_id=invoice_id,
            detail={"success": False, "error": str(e)},
        )
        notify(
            db,
            user_id=current_user.id,
            type="PROCESSING_FAILED",
            title="Invoice processing failed",
            message=f"Failed to extract text from Invoice #{invoice_id}: {str(e)}",
            invoice_id=invoice_id,
        )
        db.commit()
        db.refresh(invoice)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Extraction failed: {e}",
        )

    invoice.raw_text = raw_text

    parsed_all = parse_invoice_text(raw_text)
    parsed = parsed_all["fields"]
    for name, value in parsed.items():
        if value is not None and getattr(invoice, name, None) in (None, ""):
            setattr(invoice, name, value)

    vendor_linked = None
    if invoice.vendor_id is None:
        vendor = _match_or_create_vendor(db, parsed_all.get("vendor") or {})
        if vendor is not None:
            invoice.vendor_id = vendor.id
            vendor_linked = vendor.id

    # Re-extracting replaces the previous line items instead of duplicating them.
    db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).delete()
    for item in parsed_all.get("line_items", []):
        db.add(InvoiceItem(invoice_id=invoice.id, **item))

    invoice.status = InvoiceStatus.ANALYSIS_READY.value

    log_action(
        db,
        action="INVOICE_EXTRACTED",
        user_id=current_user.id,
        invoice_id=invoice_id,
        detail={
            "success": True,
            "method": method,
            "chars": len(raw_text),
            "line_items": len(parsed_all.get("line_items", [])),
            "vendor_id": vendor_linked,
        },
    )

    db.commit()
    db.refresh(invoice)
    return invoice

@router.post("/{invoice_id}/validate")
def validate_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = _get_invoice_or_404(db, invoice_id)

    fields = {
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date,
        "due_date": invoice.due_date,
        "subtotal": invoice.subtotal,
        "tax": invoice.tax,
        "total_amount": invoice.total_amount,
        "currency": invoice.currency,
    }

    result = validate_invoice_fields(fields, items=invoice.items)

    log_action(
        db,
        action="INVOICE_VALIDATED",
        user_id=current_user.id,
        invoice_id=invoice_id,
        detail={
            "valid": result.valid,
            "error_count": result.to_dict()["error_count"],
            "warning_count": result.to_dict()["warning_count"],
        },
    )
    db.commit()

    return {
        "invoice_id": invoice.id,
        "fields": {
            "invoice_number": invoice.invoice_number,
            "invoice_date": (
                invoice.invoice_date.isoformat() if invoice.invoice_date else None
            ),
            "due_date": (
                invoice.due_date.isoformat() if invoice.due_date else None
            ),
            "subtotal": (
                str(invoice.subtotal) if invoice.subtotal is not None else None
            ),
            "tax": str(invoice.tax) if invoice.tax is not None else None,
            "total_amount": (
                str(invoice.total_amount)
                if invoice.total_amount is not None else None
            ),
            "currency": invoice.currency,
        },
        "validation": result.to_dict(),
    }

def run_and_store_detection(db: Session, invoice: Invoice):
    """
    Run every fraud check on one invoice and upsert its stored result.

    Returns (result_dict, FraudDetectionResult row); the caller commits.
    Shared by the single-invoice endpoint and the batch "check all" job.
    """
    result_dict = FraudDetector(db).detect_fraud(invoice).to_dict()
    db_result = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.invoice_id == invoice.id
    ).first()
    if db_result is None:
        db_result = FraudDetectionResult(invoice_id=invoice.id)
        db.add(db_result)
    for key in ("risk_score", "risk_level", "fraud_flags", "critical_count",
                "high_count", "medium_count", "low_count"):
        setattr(db_result, key, result_dict[key])
    return result_dict, db_result


@router.post("/{invoice_id}/detect-fraud", response_model=FraudDetectionResponse)
def detect_fraud(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = _get_invoice_or_404(db, invoice_id)

    result_dict, db_result = run_and_store_detection(db, invoice)

    try:
        db.commit()
        db.refresh(db_result)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save fraud detection results: {str(e)}",
        )

    log_action(
        db,
        action="FRAUD_CHECK_RUN",
        user_id=current_user.id,
        invoice_id=invoice_id,
        detail={
            "risk_score": result_dict["risk_score"],
            "risk_level": result_dict["risk_level"],
            "total_flags": result_dict.get("total_flags", len(result_dict["fraud_flags"])),
        },
    )

    risk_level = result_dict["risk_level"]
    if risk_level in ("HIGH", "CRITICAL"):
        notif_type = "FRAUD_CRITICAL" if risk_level == "CRITICAL" else "FRAUD_HIGH"
        notify_all_admins(
            db,
            type=notif_type,
            title=f"{risk_level} risk invoice flagged",
            message=f"Invoice #{invoice_id} scored {result_dict['risk_score']:.1f}/100 — {result_dict.get('total_flags', 0)} fraud signal(s) detected. Immediate review recommended.",
            invoice_id=invoice_id,
        )

    db.commit()

    return db_result

@router.get("/{invoice_id}/fraud-detection", response_model=FraudDetectionResponse)
def get_fraud_detection(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_invoice_or_404(db, invoice_id)

    fraud_result = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.invoice_id == invoice_id
    ).first()

    if not fraud_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No fraud detection results found for this invoice. "
                   "Run fraud detection first.",
        )

    return fraud_result

@router.get("/{invoice_id}/fraud-summary", response_model=FraudDetectionSummary)
def get_fraud_summary(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = _get_invoice_or_404(db, invoice_id)

    fraud_result = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.invoice_id == invoice_id
    ).first()

    if not fraud_result:
        detector = FraudDetector(db)
        detection_result = detector.detect_fraud(invoice)
        result_dict = detection_result.to_dict()

        fraud_result = FraudDetectionResult(
            invoice_id=invoice_id,
            risk_score=result_dict["risk_score"],
            risk_level=result_dict["risk_level"],
            fraud_flags=result_dict["fraud_flags"],
            critical_count=result_dict["critical_count"],
            high_count=result_dict["high_count"],
            medium_count=result_dict["medium_count"],
            low_count=result_dict["low_count"],
        )
        db.add(fraud_result)
        db.commit()
        db.refresh(fraud_result)

    top_concerns = []
    if fraud_result.fraud_flags:
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
        sorted_flags = sorted(
            fraud_result.fraud_flags,
            key=lambda f: severity_order.get(f.get("severity", "INFO"), 5)
        )[:3]
        top_concerns = [flag.get("message", "") for flag in sorted_flags]

    return FraudDetectionSummary(
        invoice_id=invoice_id,
        risk_score=fraud_result.risk_score,
        risk_level=fraud_result.risk_level,
        total_flags=len(fraud_result.fraud_flags) if fraud_result.fraud_flags else 0,
        critical_flags=fraud_result.critical_count,
        high_flags=fraud_result.high_count,
        top_concerns=top_concerns,
    )

@router.delete("/{invoice_id}/fraud-detection", status_code=status.HTTP_204_NO_CONTENT)
def delete_fraud_detection(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    fraud_result = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.invoice_id == invoice_id
    ).first()

    if fraud_result:
        db.delete(fraud_result)
        db.commit()

    return None
