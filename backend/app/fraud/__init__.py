"""
Fraud Detection Module

Provides comprehensive fraud detection capabilities for invoices including:
- Duplicate invoice detection
- Vendor risk analysis
- Amount anomaly detection
- Tax validation
- Pattern-based fraud checks
"""

from app.fraud.detector import FraudDetector
from app.fraud.models import FraudFlag, FraudDetectionResult, Severity

__all__ = [
    "FraudDetector",
    "FraudFlag",
    "FraudDetectionResult",
    "Severity",
]
