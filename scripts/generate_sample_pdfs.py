#!/usr/bin/env python3
"""
Generate Sample Invoice PDFs for FraudEx Testing
"""

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from datetime import datetime
import os

def create_invoice_pdf(filename, invoice_data):
    """Create a PDF invoice with the given data."""
    
    # Create PDF
    pdf = SimpleDocTemplate(
        filename,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18,
    )
    
    # Container for elements
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a5490'),
        spaceAfter=30,
        alignment=TA_CENTER,
    )
    
    heading_style = ParagraphStyle(
        'Heading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#333333'),
    )
    
    # Title
    title = Paragraph("INVOICE", title_style)
    elements.append(title)
    elements.append(Spacer(1, 12))
    
    # Vendor Info
    vendor_data = [
        [Paragraph(f"<b>{invoice_data['vendor_name']}</b>", styles['Normal'])],
        [invoice_data['vendor_address']],
        [f"GSTIN: {invoice_data['vendor_gstin']}"],
        [f"Email: {invoice_data['vendor_email']}"],
        [f"Phone: {invoice_data['vendor_phone']}"],
    ]
    
    vendor_table = Table(vendor_data, colWidths=[5*inch])
    vendor_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#333333')),
    ]))
    
    elements.append(vendor_table)
    elements.append(Spacer(1, 20))
    
    # Bill To
    elements.append(Paragraph("<b>BILL TO:</b>", heading_style))
    elements.append(Spacer(1, 6))
    
    billto_data = [
        [invoice_data['customer_name']],
        [invoice_data['customer_address']],
    ]
    
    billto_table = Table(billto_data, colWidths=[5*inch])
    billto_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
    ]))
    
    elements.append(billto_table)
    elements.append(Spacer(1, 20))
    
    # Invoice Details
    invoice_info = [
        ['Invoice Number:', invoice_data['invoice_number']],
        ['Invoice Date:', invoice_data['invoice_date']],
        ['Due Date:', invoice_data['due_date']],
    ]
    
    info_table = Table(invoice_info, colWidths=[2*inch, 3*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))
    
    elements.append(info_table)
    elements.append(Spacer(1, 20))
    
    # Line Items Header
    items_data = [
        ['DESCRIPTION', 'QTY', 'UNIT PRICE', 'AMOUNT'],
    ]
    
    # Line Items
    for item in invoice_data['items']:
        items_data.append([
            item['description'],
            str(item['qty']),
            f"₹{item['unit_price']:,.2f}",
            f"₹{item['amount']:,.2f}",
        ])
    
    items_table = Table(items_data, colWidths=[2.5*inch, 0.8*inch, 1.2*inch, 1.2*inch])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5490')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
    ]))
    
    elements.append(items_table)
    elements.append(Spacer(1, 20))
    
    # Totals
    totals_data = [
        ['Subtotal:', f"₹{invoice_data['subtotal']:,.2f}"],
        [f"{invoice_data['tax_label']}:", f"₹{invoice_data['tax']:,.2f}"],
        ['', ''],
        ['TOTAL:', f"₹{invoice_data['total']:,.2f}"],
    ]
    
    totals_table = Table(totals_data, colWidths=[3.8*inch, 1.5*inch])
    totals_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('FONTSIZE', (0, 3), (-1, 3), 14),
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('LINEABOVE', (0, 3), (-1, 3), 2, colors.black),
        ('TEXTCOLOR', (0, 3), (-1, 3), colors.HexColor('#1a5490')),
    ]))
    
    elements.append(totals_table)
    
    # Warning message if present
    if 'warning' in invoice_data:
        elements.append(Spacer(1, 30))
        warning_style = ParagraphStyle(
            'Warning',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.red,
            borderColor=colors.red,
            borderWidth=1,
            borderPadding=10,
            backColor=colors.HexColor('#fff5f5'),
        )
        warning = Paragraph(f"<b>⚠️ {invoice_data['warning']}</b>", warning_style)
        elements.append(warning)
    
    # Build PDF
    pdf.build(elements)
    print(f"✓ Created: {filename}")


def main():
    """Generate all sample invoice PDFs."""
    
    output_dir = "../sample_invoices"
    os.makedirs(output_dir, exist_ok=True)
    
    print("🎨 Generating Sample Invoice PDFs...")
    print("=" * 50)
    
    # Invoice 1 - Normal
    create_invoice_pdf(
        f"{output_dir}/invoice_1_normal.pdf",
        {
            'vendor_name': 'ABC SUPPLIERS LTD',
            'vendor_address': '123 Business Park, Andheri East, Mumbai, Maharashtra 400069',
            'vendor_gstin': '27AABCU9603R1ZM',
            'vendor_email': 'contact@abc-suppliers.com',
            'vendor_phone': '+91-9876543210',
            'customer_name': 'XYZ Corporation',
            'customer_address': '456 Corporate Tower, Bangalore, Karnataka 560001',
            'invoice_number': 'INV-2024-001',
            'invoice_date': '15-01-2024',
            'due_date': '15-02-2024',
            'items': [
                {
                    'description': 'Office Supplies - Premium Quality Paper A4 Reams',
                    'qty': 50,
                    'unit_price': 200.00,
                    'amount': 10000.00,
                }
            ],
            'subtotal': 10000.00,
            'tax': 1800.00,
            'tax_label': 'GST @18%',
            'total': 11800.00,
        }
    )
    
    # Invoice 2 - Duplicate
    create_invoice_pdf(
        f"{output_dir}/invoice_2_duplicate.pdf",
        {
            'vendor_name': 'ABC SUPPLIERS LTD',
            'vendor_address': '123 Business Park, Andheri East, Mumbai, Maharashtra 400069',
            'vendor_gstin': '27AABCU9603R1ZM',
            'vendor_email': 'contact@abc-suppliers.com',
            'vendor_phone': '+91-9876543210',
            'customer_name': 'XYZ Corporation',
            'customer_address': '456 Corporate Tower, Bangalore, Karnataka 560001',
            'invoice_number': 'INV-2024-001',  # DUPLICATE!
            'invoice_date': '16-01-2024',
            'due_date': '16-02-2024',
            'items': [
                {
                    'description': 'Office Supplies - Premium Quality Paper A4 Reams',
                    'qty': 50,
                    'unit_price': 200.00,
                    'amount': 10000.00,
                }
            ],
            'subtotal': 10000.00,
            'tax': 1800.00,
            'tax_label': 'GST @18%',
            'total': 11800.00,
            'warning': 'DUPLICATE INVOICE - Same invoice number! Will trigger CRITICAL alert.',
        }
    )
    
    # Invoice 3 - Invalid Tax
    create_invoice_pdf(
        f"{output_dir}/invoice_3_invalid_tax.pdf",
        {
            'vendor_name': 'DEF TRADERS PVT LTD',
            'vendor_address': '789 Market Street, Connaught Place, New Delhi, Delhi 110001',
            'vendor_gstin': '07AABCD1234E1ZF',
            'vendor_email': 'sales@deftraders.com',
            'vendor_phone': '+91-9123456789',
            'customer_name': 'ABC Corporation',
            'customer_address': 'Mumbai, Maharashtra',
            'invoice_number': 'INV-2024-002',
            'invoice_date': '20-01-2024',
            'due_date': '20-02-2024',
            'items': [
                {
                    'description': 'Laptop Computers - HP',
                    'qty': 2,
                    'unit_price': 2500.00,
                    'amount': 5000.00,
                }
            ],
            'subtotal': 5000.00,
            'tax': 750.00,
            'tax_label': 'Tax @15%',  # INVALID!
            'total': 5750.00,
            'warning': 'INVALID TAX RATE - 15% is not a valid GST rate! Will trigger HIGH alert.',
        }
    )
    
    # Invoice 4 - Round Amount
    create_invoice_pdf(
        f"{output_dir}/invoice_4_round_amount.pdf",
        {
            'vendor_name': 'GHI ENTERPRISES',
            'vendor_address': '321 Industrial Area, Sector 18, Gurgaon, Haryana 122015',
            'vendor_gstin': '06AABCE5678F1ZG',
            'vendor_email': 'info@ghienterprises.com',
            'vendor_phone': '+91-9988776655',
            'customer_name': 'Large Corporation Ltd',
            'customer_address': 'Mumbai, Maharashtra',
            'invoice_number': 'INV-2024-003',
            'invoice_date': '25-01-2024',
            'due_date': '25-02-2024',
            'items': [
                {
                    'description': 'Consulting Services',
                    'qty': 1,
                    'unit_price': 100000.00,
                    'amount': 100000.00,
                }
            ],
            'subtotal': 100000.00,
            'tax': 18000.00,
            'tax_label': 'GST @18%',
            'total': 118000.00,
            'warning': 'SUSPICIOUS ROUND AMOUNT - ₹1,00,000 is very round! Will trigger MEDIUM alert.',
        }
    )
    
    # Invoice 5 - Future Date
    create_invoice_pdf(
        f"{output_dir}/invoice_5_future_date.pdf",
        {
            'vendor_name': 'JKL SERVICES LTD',
            'vendor_address': '555 Tech Park, Whitefield, Bangalore, Karnataka 560066',
            'vendor_gstin': '29AABCJ9012K1ZH',
            'vendor_email': 'billing@jklservices.com',
            'vendor_phone': '+91-9876501234',
            'customer_name': 'Tech Startup Inc',
            'customer_address': 'Bangalore, Karnataka',
            'invoice_number': 'INV-2025-001',
            'invoice_date': '31-12-2025',  # FUTURE!
            'due_date': '31-01-2026',
            'items': [
                {
                    'description': 'Software License - Annual',
                    'qty': 1,
                    'unit_price': 8000.00,
                    'amount': 8000.00,
                }
            ],
            'subtotal': 8000.00,
            'tax': 1440.00,
            'tax_label': 'GST @18%',
            'total': 9440.00,
            'warning': 'FUTURE-DATED INVOICE - Date is in the future! Will trigger HIGH alert.',
        }
    )
    
    # Invoice 6 - High Value No Tax
    create_invoice_pdf(
        f"{output_dir}/invoice_6_no_tax.pdf",
        {
            'vendor_name': 'MNO TRADING CO.',
            'vendor_address': '888 Commerce Plaza, Bandra, Mumbai, Maharashtra 400050',
            'vendor_gstin': '27AABMN3456P1ZI',
            'vendor_email': 'accounts@mnotrading.com',
            'vendor_phone': '+91-9123450000',
            'customer_name': 'Big Company Ltd',
            'customer_address': 'Mumbai, Maharashtra',
            'invoice_number': 'INV-2024-004',
            'invoice_date': '28-01-2024',
            'due_date': '28-02-2024',
            'items': [
                {
                    'description': 'Bulk Equipment Order',
                    'qty': 1,
                    'unit_price': 50000.00,
                    'amount': 50000.00,
                }
            ],
            'subtotal': 50000.00,
            'tax': 0.00,  # NO TAX!
            'tax_label': 'GST',
            'total': 50000.00,
            'warning': 'HIGH VALUE WITH NO TAX - ₹50,000 invoice with ₹0 tax! Will trigger HIGH alert.',
        }
    )
    
    print("=" * 50)
    print("✅ All PDF invoices generated successfully!")
    print(f"📁 Location: {output_dir}/")
    print("\n📋 Files created:")
    print("  1. invoice_1_normal.pdf         - ✅ Normal invoice (LOW risk)")
    print("  2. invoice_2_duplicate.pdf      - 🔴 Duplicate (CRITICAL)")
    print("  3. invoice_3_invalid_tax.pdf    - 🟠 Invalid tax rate (HIGH)")
    print("  4. invoice_4_round_amount.pdf   - 🟡 Round amount (MEDIUM)")
    print("  5. invoice_5_future_date.pdf    - 🟠 Future date (HIGH)")
    print("  6. invoice_6_no_tax.pdf         - 🟠 No tax on high value (HIGH)")
    print("\n🚀 Ready to upload to FraudEx!")


if __name__ == "__main__":
    main()
