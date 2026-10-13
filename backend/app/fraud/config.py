"""
Fraud Detection Configuration

Configurable parameters for fraud detection algorithms.
"""

import os
from decimal import Decimal


class FraudConfig:
    """Configuration parameters for fraud detection."""

    # Duplicate & Similarity Detection
    AMOUNT_SIMILARITY_THRESHOLD = float(
        os.getenv("FRAUD_AMOUNT_SIMILARITY_THRESHOLD", "0.05")
    )  # 5% tolerance
    DATE_WINDOW_DAYS = int(
        os.getenv("FRAUD_DATE_WINDOW_DAYS", "7")
    )  # 7 days window

    # Anomaly Detection
    ANOMALY_STD_DEV_MULTIPLIER = float(
        os.getenv("FRAUD_ANOMALY_STD_DEV_MULTIPLIER", "2.0")
    )  # 2 standard deviations
    MIN_VENDOR_HISTORY = int(
        os.getenv("FRAUD_MIN_VENDOR_HISTORY", "5")
    )  # Minimum invoices for reliable stats

    # Vendor Risk Thresholds
    HIGH_REJECTION_RATE_THRESHOLD = float(
        os.getenv("FRAUD_HIGH_REJECTION_RATE_THRESHOLD", "0.30")
    )  # 30% rejection rate
    NEW_VENDOR_INVOICE_THRESHOLD = 3  # < 3 invoices = new vendor

    # Amount Thresholds
    HIGH_VALUE_THRESHOLD = Decimal("10000.00")  # High value invoice
    ROUND_NUMBER_DETECTION = True  # Flag suspiciously round amounts

    # Tax Validation
    VALID_GST_RATES = [0.00, 0.05, 0.12, 0.18, 0.28]  # Valid GST rates for India
    TAX_CALCULATION_TOLERANCE = Decimal("0.05")  # ₹0.05 tolerance for tax calc

    # Date Validation
    MAX_INVOICE_AGE_DAYS = 730  # 2 years
    RAPID_SUBMISSION_WINDOW_MINUTES = 5  # Multiple invoices in 5 minutes
    RAPID_SUBMISSION_COUNT = 5  # 5+ invoices in window

    @classmethod
    def get_config_dict(cls) -> dict:
        """Get all configuration as a dictionary."""
        return {
            "amount_similarity_threshold": cls.AMOUNT_SIMILARITY_THRESHOLD,
            "date_window_days": cls.DATE_WINDOW_DAYS,
            "anomaly_std_dev_multiplier": cls.ANOMALY_STD_DEV_MULTIPLIER,
            "min_vendor_history": cls.MIN_VENDOR_HISTORY,
            "high_rejection_rate_threshold": cls.HIGH_REJECTION_RATE_THRESHOLD,
            "new_vendor_invoice_threshold": cls.NEW_VENDOR_INVOICE_THRESHOLD,
            "high_value_threshold": str(cls.HIGH_VALUE_THRESHOLD),
            "valid_gst_rates": cls.VALID_GST_RATES,
        }
