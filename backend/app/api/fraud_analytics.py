"""
Fraud Analytics API

Endpoints for fraud detection statistics and analytics.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models.fraud_detection_result import FraudDetectionResult
from app.models.invoice import Invoice
from app.models.vendor import Vendor
from app.models.user import User
from app.schemas.fraud import (
    FraudStatistics,
    HighRiskInvoice,
    VendorRiskProfile,
)
from app.fraud.vendor_analysis import get_vendor_risk_profile

router = APIRouter(prefix="/fraud", tags=["Fraud Analytics"])


@router.get("/statistics", response_model=FraudStatistics)
def get_fraud_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get overall fraud detection statistics.
    
    Returns counts by risk level, most common fraud types, and average risk score.
    """
    # Count by risk level
    total_analyzed = db.query(FraudDetectionResult).count()
    
    low_risk = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.risk_level == "LOW"
    ).count()
    
    medium_risk = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.risk_level == "MEDIUM"
    ).count()
    
    high_risk = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.risk_level == "HIGH"
    ).count()
    
    critical_risk = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.risk_level == "CRITICAL"
    ).count()

    # Calculate average risk score
    avg_score_result = db.query(
        func.avg(FraudDetectionResult.risk_score)
    ).scalar()
    avg_risk_score = float(avg_score_result) if avg_score_result else 0.0

    # Get most common fraud types
    fraud_type_counts = {}
    
    all_results = db.query(FraudDetectionResult).all()
    for result in all_results:
        if result.fraud_flags:
            for flag in result.fraud_flags:
                code = flag.get("code", "UNKNOWN")
                if code not in fraud_type_counts:
                    fraud_type_counts[code] = {
                        "code": code,
                        "count": 0,
                        "description": flag.get("message", "")[:100],  # First 100 chars
                    }
                fraud_type_counts[code]["count"] += 1

    # Sort by count and take top 10
    most_common = sorted(
        fraud_type_counts.values(),
        key=lambda x: x["count"],
        reverse=True
    )[:10]

    return FraudStatistics(
        total_invoices_analyzed=total_analyzed,
        low_risk_count=low_risk,
        medium_risk_count=medium_risk,
        high_risk_count=high_risk,
        critical_risk_count=critical_risk,
        most_common_fraud_types=most_common,
        average_risk_score=round(avg_risk_score, 2),
    )


@router.get("/high-risk-invoices", response_model=List[HighRiskInvoice])
def get_high_risk_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    min_risk_level: Optional[str] = Query("HIGH", description="Minimum risk level (MEDIUM, HIGH, CRITICAL)"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of results"),
):
    """
    Get list of high-risk invoices for review.
    
    Returns invoices with HIGH or CRITICAL risk levels, sorted by risk score.
    """
    # Map risk levels to filtering
    risk_levels = []
    if min_risk_level == "MEDIUM":
        risk_levels = ["MEDIUM", "HIGH", "CRITICAL"]
    elif min_risk_level == "HIGH":
        risk_levels = ["HIGH", "CRITICAL"]
    else:  # CRITICAL
        risk_levels = ["CRITICAL"]

    # Query high-risk fraud results
    fraud_results = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.risk_level.in_(risk_levels)
    ).order_by(
        desc(FraudDetectionResult.risk_score)
    ).limit(limit).all()

    # Build response with invoice details
    high_risk_list = []
    for fraud_result in fraud_results:
        invoice = db.query(Invoice).filter(
            Invoice.id == fraud_result.invoice_id
        ).first()
        
        if not invoice:
            continue

        vendor_name = None
        if invoice.vendor_id:
            vendor = db.query(Vendor).filter(
                Vendor.id == invoice.vendor_id
            ).first()
            if vendor:
                vendor_name = vendor.name

        high_risk_list.append(
            HighRiskInvoice(
                invoice_id=invoice.id,
                invoice_number=invoice.invoice_number,
                vendor_name=vendor_name,
                total_amount=float(invoice.total_amount) if invoice.total_amount else None,
                risk_score=fraud_result.risk_score,
                risk_level=fraud_result.risk_level,
                critical_flags=fraud_result.critical_count,
                detection_date=fraud_result.detection_timestamp,
            )
        )

    return high_risk_list


@router.get("/vendors/{vendor_id}/risk-profile", response_model=VendorRiskProfile)
def get_vendor_risk(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get comprehensive risk profile for a vendor.
    
    Includes historical statistics, rejection rate, and risk assessment.
    """
    # Verify vendor exists
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    # Get risk profile from fraud analysis module
    risk_profile = get_vendor_risk_profile(db, vendor_id)

    # Calculate average risk score from fraud detections
    invoices = db.query(Invoice).filter(
        Invoice.vendor_id == vendor_id
    ).all()
    
    invoice_ids = [inv.id for inv in invoices]
    
    if invoice_ids:
        fraud_results = db.query(FraudDetectionResult).filter(
            FraudDetectionResult.invoice_id.in_(invoice_ids)
        ).all()
        
        if fraud_results:
            avg_risk = sum(fr.risk_score for fr in fraud_results) / len(fraud_results)
            risk_profile["average_risk_score"] = round(avg_risk, 2)
        else:
            risk_profile["average_risk_score"] = None
    else:
        risk_profile["average_risk_score"] = None

    # Get last invoice date
    last_invoice = db.query(Invoice).filter(
        Invoice.vendor_id == vendor_id,
        Invoice.invoice_date.isnot(None)
    ).order_by(desc(Invoice.invoice_date)).first()

    last_invoice_date = last_invoice.invoice_date if last_invoice else None

    return VendorRiskProfile(
        vendor_id=vendor_id,
        vendor_name=risk_profile["vendor_name"],
        total_invoices=risk_profile["total_invoices"],
        rejection_rate=risk_profile["rejection_rate"],
        average_amount=risk_profile["average_amount"],
        average_risk_score=risk_profile.get("average_risk_score"),
        is_new_vendor=risk_profile["is_new_vendor"],
        last_invoice_date=last_invoice_date,
    )


@router.get("/risk-distribution")
def get_risk_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get distribution of invoices by risk level.
    
    Useful for dashboard charts.
    """
    total = db.query(FraudDetectionResult).count()
    
    distribution = {
        "LOW": db.query(FraudDetectionResult).filter(
            FraudDetectionResult.risk_level == "LOW"
        ).count(),
        "MEDIUM": db.query(FraudDetectionResult).filter(
            FraudDetectionResult.risk_level == "MEDIUM"
        ).count(),
        "HIGH": db.query(FraudDetectionResult).filter(
            FraudDetectionResult.risk_level == "HIGH"
        ).count(),
        "CRITICAL": db.query(FraudDetectionResult).filter(
            FraudDetectionResult.risk_level == "CRITICAL"
        ).count(),
    }

    # Calculate percentages
    distribution_pct = {}
    for level, count in distribution.items():
        pct = (count / total * 100) if total > 0 else 0
        distribution_pct[level] = {
            "count": count,
            "percentage": round(pct, 1),
        }

    return {
        "total_analyzed": total,
        "distribution": distribution_pct,
    }


@router.get("/fraud-trends")
def get_fraud_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
):
    """
    Get fraud detection trends over time.
    
    Returns daily counts of fraud detections by risk level.
    """
    from datetime import datetime, timedelta

    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    # Get fraud results within date range
    results = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.detection_timestamp >= start_date,
        FraudDetectionResult.detection_timestamp <= end_date,
    ).all()

    # Group by date and risk level
    trends = {}
    for result in results:
        date_key = result.detection_timestamp.date().isoformat()
        if date_key not in trends:
            trends[date_key] = {
                "date": date_key,
                "LOW": 0,
                "MEDIUM": 0,
                "HIGH": 0,
                "CRITICAL": 0,
                "total": 0,
            }
        trends[date_key][result.risk_level] += 1
        trends[date_key]["total"] += 1

    # Sort by date
    sorted_trends = sorted(trends.values(), key=lambda x: x["date"])

    return {
        "period_days": days,
        "start_date": start_date.date().isoformat(),
        "end_date": end_date.date().isoformat(),
        "trends": sorted_trends,
    }


@router.get("/vendor-risk-summary")
def get_vendor_risk_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100, description="Number of vendors to return"),
):
    """
    Get summary of vendors by risk level.
    
    Returns top risky vendors based on their invoice fraud detection results.
    """
    vendors = db.query(Vendor).all()
    
    vendor_risks = []
    for vendor in vendors:
        # Get all invoices for this vendor
        invoices = db.query(Invoice).filter(
            Invoice.vendor_id == vendor.id
        ).all()
        
        if not invoices:
            continue

        invoice_ids = [inv.id for inv in invoices]
        
        # Get fraud results
        fraud_results = db.query(FraudDetectionResult).filter(
            FraudDetectionResult.invoice_id.in_(invoice_ids)
        ).all()

        if not fraud_results:
            continue

        # Calculate average risk score
        avg_risk = sum(fr.risk_score for fr in fraud_results) / len(fraud_results)
        
        # Count high and critical flags
        high_critical_count = sum(
            fr.high_count + fr.critical_count
            for fr in fraud_results
        )

        vendor_risks.append({
            "vendor_id": vendor.id,
            "vendor_name": vendor.name,
            "total_invoices": len(invoices),
            "analyzed_invoices": len(fraud_results),
            "average_risk_score": round(avg_risk, 2),
            "high_critical_flags": high_critical_count,
        })

    # Sort by average risk score
    vendor_risks.sort(key=lambda x: x["average_risk_score"], reverse=True)

    return {
        "total_vendors": len(vendor_risks),
        "top_risky_vendors": vendor_risks[:limit],
    }
