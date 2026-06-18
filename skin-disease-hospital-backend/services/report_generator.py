"""
Annotated image layout:
┌────────────────────────────────────────────────────────┐
│  🏥 DermAI Diagnostic Report   Image ID: DA-XXXXXX     │  ← Header
│  Date: 2025-06-16 14:32 UTC                            │
├────────────────────────────────────────────────────────┤
│              [ ORIGINAL SKIN IMAGE ]                   │
├────────────────────────────────────────────────────────┤
│  PATIENT    John Doe           ID: HOSP-2025-00142     │  ← Patient strip
│  DOB        1985-04-12         Gender: Male  Blood: B+ │
├────────────────────────────────────────────────────────┤
│  ▲ CRITICAL   MELANOMA                   87.3% conf.   │  ← Diagnosis
│  ICD-10: C43.9                                         │
│  Action: URGENT — Refer to oncology. Biopsy 48h.      │
├────────────────────────────────────────────────────────┤
│  TOP 5 PROBABILITIES                                   │  ← Bar chart
│  Melanoma          ████████████████████ 87.3%         │
│  Basal Cell Carc.  ███ 6.1%                           │
│  Melanocytic Nevi  ██ 3.8%                            │
│  Seborrheic Ker.   █ 1.5%                             │
│  Eczema            █ 0.9%                             │
├────────────────────────────────────────────────────────┤
│  Model: ResNet50 v3  Submitted by: Dr. Sharma          │  ← Footer
│  ⚠  For clinical assistance only. Not a final DX.     │
└────────────────────────────────────────────────────────┘
"""

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Image as RLImage, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import io
import os
from datetime import datetime
from config import get_settings

settings = get_settings()

C_BG_DARK  = (15,  23,  42)
C_BG_CARD  = (30,  41,  59)
C_BLUE     = (14, 165, 233)
C_GREEN    = (16, 185, 129)
C_YELLOW   = (234, 179,  8)
C_RED      = (239,  68, 68)
C_WHITE    = (241, 245, 249)
C_MUTED    = (148, 163, 184)
C_HEADER   = (7,   89, 133)

SEVERITY_REMAP = {
    "Critical": "Critical",
    "High":     "Severe",
    "Moderate": "Moderate",
    "Low":      "Mild",
}

SEVERITY_EMOJI = {
    "Critical": "🔴",
    "Severe":   "🟠",
    "Moderate": "🟡",
    "Mild":     "🟢",
}

SEVERITY_COLORS = {
    "Critical": C_RED,
    "Severe":   (249, 115, 22),
    "Moderate": C_YELLOW,
    "Mild":     C_GREEN,
}

CANVAS_WIDTH = 900
HEADER_H     = 80
PATIENT_H    = 100
DIAGNOSIS_H  = 110
CHART_H      = 170
FOOTER_H     = 60


def _load_font(size: int, bold: bool = False):
    font_name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    for path in [
        f"/usr/share/fonts/truetype/dejavu/{font_name}",
        f"/usr/share/fonts/dejavu/{font_name}",
        f"/app/fonts/{font_name}",
    ]:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _rect(draw, x0, y0, x1, y1, fill, radius=0):
    if radius:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill)
    else:
        draw.rectangle([x0, y0, x1, y1], fill=fill)


def generate_annotated_image(
    image_bytes: bytes,
    patient: dict,
    prediction: dict,
    image_id: str,
    doctor_name: str = "Unknown",
    department: str = "Dermatology",
) -> bytes:
    orig = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_w = CANVAS_WIDTH - 40
    img_h = int(img_w * orig.height / orig.width)
    orig_resized = orig.resize((img_w, img_h), Image.LANCZOS)
    total_h = HEADER_H + img_h + 20 + PATIENT_H + DIAGNOSIS_H + CHART_H + FOOTER_H

    canvas = Image.new("RGB", (CANVAS_WIDTH, total_h), C_BG_DARK)
    draw = ImageDraw.Draw(canvas)

    f_title = _load_font(22, bold=True)
    f_head  = _load_font(18, bold=True)
    f_sub   = _load_font(15)
    f_small = _load_font(12)
    f_label = _load_font(13, bold=True)

    y = 0
    # Header
    _rect(draw, 0, 0, CANVAS_WIDTH, HEADER_H, C_HEADER)
    draw.text((20, 10), "🏥 DermAI Diagnostic Report", font=f_title, fill=C_WHITE)
    draw.text((20, 46), f"Image ID: DA-{image_id[:8].upper()}", font=f_sub, fill=C_BLUE)
    draw.text((CANVAS_WIDTH - 280, 46),
              f"Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
              font=f_small, fill=C_MUTED)
    y = HEADER_H

    # Image
    canvas.paste(orig_resized, (20, y + 10))
    y += img_h + 20

    # Patient strip
    _rect(draw, 0, y, CANVAS_WIDTH, y + PATIENT_H, C_BG_CARD)
    draw.text((20, y + 10), "PATIENT INFORMATION", font=f_label, fill=C_BLUE)
    col2 = CANVAS_WIDTH // 2
    draw.text((20,   y + 35), f"Name:   {patient.get('full_name', 'N/A')}", font=f_sub, fill=C_WHITE)
    draw.text((20,   y + 60), f"ID:     {patient.get('patient_id', 'N/A')}", font=f_sub, fill=C_WHITE)
    draw.text((col2, y + 35), f"DOB:    {patient.get('date_of_birth', 'N/A')}", font=f_sub, fill=C_WHITE)
    draw.text((col2, y + 60),
              f"Gender: {patient.get('gender', 'N/A')}   Blood: {patient.get('blood_group', 'N/A')}",
              font=f_sub, fill=C_WHITE)
    y += PATIENT_H

    # Diagnosis
    sev_raw = prediction.get("severity", "Low")
    sev = SEVERITY_REMAP.get(sev_raw, sev_raw)
    sev_color = SEVERITY_COLORS.get(sev, C_GREEN)
    _rect(draw, 0, y, CANVAS_WIDTH, y + DIAGNOSIS_H, C_BG_DARK)
    _rect(draw, 20, y + 10, 140, y + 40, sev_color, radius=6)
    draw.text((28, y + 14), f"▲ {sev.upper()}", font=f_label, fill=C_BG_DARK)
    draw.text((155, y + 10), prediction.get("top_prediction", "N/A").upper(), font=f_head, fill=C_WHITE)
    draw.text((CANVAS_WIDTH - 200, y + 10),
              f"{prediction.get('confidence', 0):.1f}% confidence", font=f_sub, fill=sev_color)
    draw.text((20, y + 50), f"ICD-10: {prediction.get('icd_code', 'N/A')}", font=f_small, fill=C_MUTED)
    draw.text((20, y + 68), f"Action: {prediction.get('recommended_action', 'N/A')}", font=f_small, fill=C_WHITE)
    draw.text((20, y + 88),
              f"Description: {prediction.get('description', '')[:100]}", font=f_small, fill=C_MUTED)
    y += DIAGNOSIS_H

    # ── SEVERITY RANKING (replaces probability bar chart) ─────────────────────
    _rect(draw, 0, y, CANVAS_WIDTH, y + CHART_H, C_BG_CARD)
    draw.text((20, y + 10), "TOP 5 CLINICAL ASSESSMENT", font=f_label, fill=C_BLUE)

    from services.model_utils import sort_classes_by_severity
    top5 = sort_classes_by_severity(prediction.get("all_classes", []))[:5]

    for i, cls in enumerate(top5):
        by = y + 40 + i * 26

        from services.model_utils import CLASS_METADATA, SEVERITY_REMAP as _SREMAP
        meta_sev_raw = CLASS_METADATA.get(cls["label"], {}).get("severity", "Low")
        meta_sev = _SREMAP.get(meta_sev_raw, meta_sev_raw)
        sev_color_item = SEVERITY_COLORS.get(meta_sev, C_MUTED)
        emoji = SEVERITY_EMOJI.get(meta_sev, "")

        draw.text((20, by), f"{i+1}.", font=f_small, fill=C_MUTED)
        draw.text((40, by), cls["label"][:36], font=f_small, fill=C_WHITE)
        badge_text = f"{emoji} {meta_sev}"
        draw.text((CANVAS_WIDTH - 160, by), badge_text, font=f_label, fill=sev_color_item)

    y += CHART_H

    # Footer
    _rect(draw, 0, y, CANVAS_WIDTH, y + FOOTER_H, C_HEADER)
    draw.text((20, y + 10),
              f"Model: ResNet50 {prediction.get('model_version', 'v1')} "
              f"| Submitted by: Dr. {doctor_name} | Dept: {department}",
              font=f_small, fill=C_WHITE)
    draw.text((20, y + 32),
              "⚠  AI-assisted report. Final diagnosis must be made by a licensed physician.",
              font=f_small, fill=C_YELLOW)

    buf = io.BytesIO()
    canvas.save(buf, format="PNG", dpi=(300, 300))
    buf.seek(0)
    return buf.read()


def generate_pdf_report(
    annotated_image_path: str,
    patient: dict,
    prediction: dict,
    image_id: str,
    doctor_name: str = "Unknown",
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("Title", parent=styles["Title"],
                                 fontSize=18, textColor=colors.HexColor("#0EA5E9"))
    story.append(Paragraph("🏥 DermAI Hospital — Clinical AI Report", title_style))
    story.append(Spacer(1, 6*mm))

    data = [
        ["Image ID",      f"DA-{image_id[:8].upper()}",
         "Report Date",   datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")],
        ["Patient Name",  patient.get("full_name", "N/A"),
         "Patient ID",    patient.get("patient_id", "N/A")],
        ["DOB",           patient.get("date_of_birth", "N/A"),
         "Gender/Blood",  f"{patient.get('gender','N/A')} / {patient.get('blood_group','N/A')}"],
        ["Diagnosis",     prediction.get("top_prediction", "N/A"),
         "Confidence",    f"{prediction.get('confidence',0):.1f}%"],
        ["Severity",      prediction.get("severity", "N/A"),
         "ICD-10",        prediction.get("icd_code", "N/A")],
        ["Model Version", prediction.get("model_version", "v1"),
         "Submitted By",  f"Dr. {doctor_name}"],
    ]
    t = Table(data, colWidths=[35*mm, 60*mm, 35*mm, 50*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#0F172A")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#0F172A")),
        ("TEXTCOLOR",  (0, 0), (0, -1), colors.HexColor("#0EA5E9")),
        ("TEXTCOLOR",  (2, 0), (2, -1), colors.HexColor("#0EA5E9")),
        ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#1E293B")),
        ("BACKGROUND", (3, 0), (3, -1), colors.HexColor("#1E293B")),
        ("TEXTCOLOR",  (1, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ("FONTSIZE",   (0, 0), (-1, -1), 9),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
    ]))
    story.append(t)
    story.append(Spacer(1, 6*mm))

    if os.path.exists(annotated_image_path):
        # Compute proportional height from source image dimensions
        from PIL import Image as PILImg
        _pil = PILImg.open(annotated_image_path)
        _iw, _ih = _pil.size
        _pil.close()
        avail_w = 170 * mm  # safe max within A4 frame
        max_h = 200 * mm    # cap height so it fits on a page
        aspect = _ih / _iw
        img_h = avail_w * aspect
        if img_h > max_h:
            img_h = max_h
            avail_w = img_h / aspect
        story.append(RLImage(annotated_image_path, width=avail_w, height=img_h))
    story.append(Spacer(1, 4*mm))

    from services.model_utils import CLASS_METADATA, SEVERITY_REMAP as _SREMAP, sort_classes_by_severity

    SEVERITY_EMOJI_PDF = {
        "Critical": "Critical",
        "Severe":   "Severe",
        "Moderate": "Moderate",
        "Mild":     "Mild",
    }

    top5_pdf = sort_classes_by_severity(prediction.get("all_classes", []))[:5]
    prob_data = [["#", "Disease", "Severity"]]
    for i, cls in enumerate(top5_pdf):
        meta_sev_raw = CLASS_METADATA.get(cls["label"], {}).get("severity", "Low")
        meta_sev = _SREMAP.get(meta_sev_raw, meta_sev_raw)
        prob_data.append([str(i + 1), cls["label"], meta_sev])

    prob_table = Table(prob_data, colWidths=[10*mm, 110*mm, 40*mm])
    prob_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  colors.HexColor("#0F172A")),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.HexColor("#0EA5E9")),
        ("BACKGROUND",    (0, 1), (-1, -1), colors.HexColor("#1E293B")),
        ("TEXTCOLOR",     (0, 1), (-1, -1), colors.HexColor("#F1F5F9")),
        ("FONTSIZE",      (0, 0), (-1, -1), 9),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1),
         [colors.HexColor("#1E293B"), colors.HexColor("#0F172A")]),
    ]))
    story.append(prob_table)
    story.append(Spacer(1, 4*mm))

    action_style = ParagraphStyle("Action", parent=styles["Normal"], fontSize=9,
                                  backColor=colors.HexColor("#1E293B"),
                                  textColor=colors.HexColor("#F1F5F9"), borderPad=4)
    story.append(Paragraph(
        f"<b>Recommended Action:</b> {prediction.get('recommended_action', 'N/A')}",
        action_style))
    story.append(Spacer(1, 3*mm))

    disc_style = ParagraphStyle("Disc", parent=styles["Normal"],
                                fontSize=7, textColor=colors.HexColor("#94A3B8"))
    story.append(Paragraph(
        "⚠ This report is generated by an AI model (ResNet50) for clinical assistance only. "
        "It does not constitute a final medical diagnosis. All findings must be reviewed "
        "and confirmed by a licensed physician before clinical action is taken.",
        disc_style))
    doc.build(story)
    buf.seek(0)
    return buf.read()
