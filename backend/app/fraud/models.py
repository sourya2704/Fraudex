"""
Fraud Detection Data Structures

Core data models for fraud detection results and flags.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


class Severity:
    """Severity levels for fraud flags."""
    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskLevel:
    """Overall risk level classification."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# Severity base scores — what each flag TYPE contributes max
SEVERITY_WEIGHTS = {
    Severity.INFO:     2,
    Severity.LOW:      8,
    Severity.MEDIUM:   18,
    Severity.HIGH:     30,
    Severity.CRITICAL: 55,
}

# Max total score caps per severity bucket (prevents 2 HIGH flags = 100)
SEVERITY_MAX_CONTRIBUTION = {
    Severity.INFO:     5,
    Severity.LOW:      15,
    Severity.MEDIUM:   30,
    Severity.HIGH:     45,
    Severity.CRITICAL: 70,
}


@dataclass
class FraudFlag:
    """
    A single fraud detection flag/warning.
    
    Attributes:
        code: Machine-readable identifier (e.g., "DUPLICATE_INVOICE")
        severity: Severity level (INFO, LOW, MEDIUM, HIGH, CRITICAL)
        message: Human-readable description
        evidence: Supporting data/metrics
        field_name: Related invoice field (optional)
    """
    code: str
    severity: str
    message: str
    evidence: Optional[Dict[str, Any]] = None
    field_name: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
            "evidence": self.evidence or {},
            "field_name": self.field_name,
        }


@dataclass
class FraudDetectionResult:
    """
    Complete fraud detection analysis result.
    
    Aggregates multiple fraud flags into an overall risk assessment.
    """
    invoice_id: int
    flags: List[FraudFlag] = field(default_factory=list)

    def add_flag(self, flag: FraudFlag) -> None:
        """Add a fraud flag to the result."""
        self.flags.append(flag)

    def calculate_risk_score(self) -> float:
        """
        Calculate overall risk score (0-100).

        Design goals:
        - A single UNKNOWN_VENDOR (expected in new invoices) should NOT push
          score above LOW/MEDIUM.
        - A TAX_CALCULATION_MISMATCH alone → MEDIUM range (~20-30).
        - Real fraud signals (DUPLICATE, AMOUNT_SPIKE) → HIGH/CRITICAL.
        - Multiple critical flags needed to reach 75+.

        Formula: per-severity contribution is capped so no single bucket
        can dominate the score.
        """
        if not self.flags:
            return 0.0

        # Count flags by severity
        severity_counts: dict[str, int] = {
            Severity.INFO: 0,
            Severity.LOW: 0,
            Severity.MEDIUM: 0,
            Severity.HIGH: 0,
            Severity.CRITICAL: 0,
        }
        for flag in self.flags:
            if flag.severity in severity_counts:
                severity_counts[flag.severity] += 1

        total_score = 0.0
        for severity, count in severity_counts.items():
            if count == 0:
                continue
            base = SEVERITY_WEIGHTS[severity]
            cap  = SEVERITY_MAX_CONTRIBUTION[severity]
            # Each additional flag of same type adds half the previous contribution
            bucket_score = 0.0
            for i in range(count):
                bucket_score += base * (0.5 ** i)
            total_score += min(bucket_score, cap)

        return round(min(total_score, 100.0), 2)

    def classify_risk_level(self, score: float) -> str:
        """
        Classify risk level based on score.
        
        Args:
            score: Risk score (0-100)
            
        Returns:
            Risk level: LOW, MEDIUM, HIGH, or CRITICAL
        """
        if score >= 75:
            return RiskLevel.CRITICAL
        elif score >= 50:
            return RiskLevel.HIGH
        elif score >= 25:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def get_severity_counts(self) -> Dict[str, int]:
        """Get count of flags by severity level."""
        counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }

        for flag in self.flags:
            severity_lower = flag.severity.lower()
            if severity_lower in counts:
                counts[severity_lower] += 1

        return counts

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        risk_score = self.calculate_risk_score()
        risk_level = self.classify_risk_level(risk_score)
        severity_counts = self.get_severity_counts()

        return {
            "invoice_id": self.invoice_id,
            "risk_score": round(risk_score, 2),
            "risk_level": risk_level,
            "fraud_flags": [flag.to_dict() for flag in self.flags],
            "critical_count": severity_counts["critical"],
            "high_count": severity_counts["high"],
            "medium_count": severity_counts["medium"],
            "low_count": severity_counts["low"],
            "total_flags": len(self.flags),
        }
