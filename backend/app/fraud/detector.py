"""
Fraud Detector - Main Orchestrator

Coordinates all fraud detection checks and aggregates results.
"""

from typing import List

from sqlalchemy.orm import Session

from app.fraud.models import FraudDetectionResult, FraudFlag
from app.models.invoice import Invoice


class FraudDetector:
    """
    Main fraud detection orchestrator.
    
    Runs all fraud detection checks on an invoice and aggregates
    the results into a comprehensive fraud detection result.
    """

    def __init__(self, db: Session):
        """
        Initialize fraud detector.
        
        Args:
            db: Database session for queries
        """
        self.db = db

    def detect_fraud(self, invoice: Invoice) -> FraudDetectionResult:
        """
        Run all fraud detection checks on an invoice.
        
        Args:
            invoice: Invoice to analyze
            
        Returns:
            FraudDetectionResult with all detected fraud flags
        """
        result = FraudDetectionResult(invoice_id=invoice.id)

        # Import check modules
        from app.fraud.duplicate import check_duplicate_invoice, check_similar_invoice
        from app.fraud.vendor_analysis import analyze_vendor_risk, analyze_vendor_history
        from app.fraud.anomaly import (
            detect_amount_anomaly,
            detect_round_number,
            detect_rapid_submission,
            detect_sequential_amounts,
            detect_amount_just_below_threshold,
        )
        from app.fraud.tax_validation import (
            validate_gst_rate,
            validate_tax_calculation,
            check_missing_tax,
            check_tax_rate_deviation,
            check_excessive_tax,
        )
        from app.fraud.date_validation import (
            check_future_date,
            check_very_old_invoice,
            check_due_date_anomaly,
            check_weekend_invoice,
            check_back_dated_invoice,
            check_suspicious_date_pattern,
        )

        # Run all checks and collect flags
        checks = [
            # Duplicate detection
            lambda: check_duplicate_invoice(self.db, invoice),
            lambda: check_similar_invoice(self.db, invoice),
            
            # Vendor analysis
            lambda: analyze_vendor_risk(self.db, invoice),
            lambda: analyze_vendor_history(self.db, invoice),
            
            # Anomaly detection
            lambda: detect_amount_anomaly(self.db, invoice),
            lambda: detect_round_number(invoice),
            lambda: detect_rapid_submission(self.db, invoice),
            lambda: detect_sequential_amounts(self.db, invoice),
            lambda: detect_amount_just_below_threshold(invoice),
            
            # Tax validation
            lambda: validate_gst_rate(invoice),
            lambda: validate_tax_calculation(invoice),
            lambda: check_missing_tax(invoice),
            lambda: check_tax_rate_deviation(self.db, invoice),
            lambda: check_excessive_tax(invoice),
            
            # Date validation
            lambda: check_future_date(invoice),
            lambda: check_very_old_invoice(invoice),
            lambda: check_due_date_anomaly(invoice),
            lambda: check_weekend_invoice(invoice),
            lambda: check_back_dated_invoice(invoice),
            lambda: check_suspicious_date_pattern(invoice),
        ]

        for check in checks:
            try:
                flags = check()
                if flags:
                    if isinstance(flags, list):
                        for flag in flags:
                            result.add_flag(flag)
                    else:
                        result.add_flag(flags)
            except Exception as e:
                # Log error but continue with other checks
                print(f"Fraud check error: {e}")
                continue

        return result

    def get_fraud_summary(self, invoice: Invoice) -> dict:
        """
        Get a brief fraud detection summary for display.
        
        Args:
            invoice: Invoice to analyze
            
        Returns:
            Summary dict with key metrics
        """
        result = self.detect_fraud(invoice)
        result_dict = result.to_dict()

        # Extract top concerns
        top_concerns = []
        for flag in sorted(
            result.flags,
            key=lambda f: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].index(f.severity),
            reverse=True
        )[:3]:
            top_concerns.append(flag.message)

        return {
            "invoice_id": invoice.id,
            "risk_score": result_dict["risk_score"],
            "risk_level": result_dict["risk_level"],
            "total_flags": len(result.flags),
            "critical_flags": result_dict["critical_count"],
            "high_flags": result_dict["high_count"],
            "top_concerns": top_concerns,
        }
